import { HttpStatus, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PrismaService } from "../../database/prisma.service";
import { RequestContextService } from "../../common/context/request-context.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import type { AppConfig } from "../../config/configuration";
import { AttachmentRepository } from "../../repository/attachment.repository";
import { DriveService } from "../drive/drive.service";
import { DriveFolder } from "../drive/drive-folder.enum";
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
} from "./dto/create-upload-url.dto";
import { UploadDriveDto } from "./dto/upload-drive.dto";
import type { AttachmentResponse } from "./dto/attachment.response";

// VN: AttachmentsService = Service Layer. Business logic ở đây:
//  - Kiểm tra entity tồn tại (stub, cần bổ sung ở phase sau)
//  - Mở transaction bao trọn upload + audit
//  - Gọi DriveService để đẩy binary lên Drive
//  - Gọi AttachmentRepository để lưu metadata (KHÔNG dùng prisma trực tiếp
//    cho các bảng nghiệp vụ; hai method legacy S3 giữ nguyên vì đang chạy).
//  - Chuẩn hoá response DTO (KHÔNG lộ driveFileId ra frontend).
const UPLOAD_URL_TTL = 60 * 10; // 10 min
const DOWNLOAD_URL_TTL = 60 * 5; // 5 min

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly ctx: RequestContextService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly repo: AttachmentRepository,
    private readonly drive: DriveService,
  ) {
    const s3 = this.config.get("s3", { infer: true }) as AppConfig["s3"];
    this.bucket = s3.bucket;
    this.client = new S3Client({
      endpoint: s3.endpoint || undefined,
      region: s3.region || "us-east-1",
      forcePathStyle: true,
      credentials: s3.accessKey
        ? { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey }
        : undefined,
    });
  }

  private buildKey(relatedType: string, relatedId: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ts = Date.now();
    return `${relatedType.toLowerCase()}/${relatedId}/${ts}-${safeName}`;
  }

  // ---------------------------------------------------------------------------
  // NEW: Drive-backed upload (multipart/form-data)
  // ---------------------------------------------------------------------------
  async uploadToDrive(
    file: Express.Multer.File | undefined,
    dto: UploadDriveDto,
  ): Promise<AttachmentResponse> {
    if (!file) {
      throw new BusinessError(
        "FILE_REQUIRED",
        "Multipart field 'file' is required",
        HttpStatus.BAD_REQUEST,
      );
    }
    // VN: TODO(phase2) — validate entity tồn tại theo entityType. Hiện tại
    // chỉ chấp nhận mọi string; sẽ thay bằng lookup qua repository tương ứng
    // (MachineRepository, SalesOrderRepository, ...) khi các repository đó ra đời.
    if (!dto.entityType || !dto.entityId) {
      throw new BusinessError(
        "ENTITY_REQUIRED",
        "entityType and entityId are required",
        HttpStatus.BAD_REQUEST,
      );
    }

    // 1) Upload binary lên Drive TRƯỚC transaction — Drive không rollback được.
    //    Nếu bước sau (DB write) fail, ta chủ động xoá file trên Drive để tránh
    //    orphan (best-effort). Không đặt upload trong tx vì tx SQL không nên
    //    ôm network call dài.
    const uploaded = await this.drive.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      dto.folder,
    );

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await this.repo.create(
          {
            fileName: file.originalname,
            fileUrl: uploaded.driveFileId, // giữ cột legacy — chứa drive id để backward-compat
            fileType: inferFileType(file.mimetype),
            mimeType: file.mimetype,
            size: uploaded.sizeBytes,
            relatedType: dto.entityType,
            relatedId: dto.entityId,
            driveFileId: uploaded.driveFileId,
            createdById: this.ctx.getUserId() ?? null,
          },
          tx,
        );
        await this.audit.record(
          {
            action: "attachment.upload",
            entityType: "Attachment",
            entityId: created.id,
            after: {
              relatedType: dto.entityType,
              relatedId: dto.entityId,
              folder: dto.folder,
              sizeBytes: uploaded.sizeBytes,
            },
          },
          tx,
        );
        return created;
      });
      return this.toResponse(row, uploaded.thumbnailUrl, uploaded.previewUrl);
    } catch (err) {
      // Rollback Drive to avoid orphan.
      this.logger.warn(
        `DB write failed after Drive upload — attempting Drive cleanup for ${uploaded.driveFileId}`,
      );
      try {
        await this.drive.deleteFile(uploaded.driveFileId);
      } catch (cleanupErr) {
        this.logger.error(
          `Failed to cleanup Drive file ${uploaded.driveFileId}: ${(cleanupErr as Error).message}`,
        );
      }
      throw err;
    }
  }

  private toResponse(
    row: {
      id: string;
      relatedType: string;
      relatedId: string;
      fileName: string;
      mimeType: string;
      size: number;
      driveFileId: string | null;
      createdAt: Date;
    },
    thumbnailUrlHint?: string,
    previewUrlHint?: string,
  ): AttachmentResponse {
    let thumbnailUrl: string | null = null;
    let previewUrl: string | null = null;
    if (row.driveFileId) {
      thumbnailUrl = thumbnailUrlHint ?? this.drive.getThumbnailUrl(row.driveFileId);
      previewUrl = previewUrlHint ?? this.drive.getPreviewUrl(row.driveFileId);
    }
    return {
      id: row.id,
      entityType: row.relatedType,
      entityId: row.relatedId,
      filename: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.size,
      thumbnailUrl,
      previewUrl,
      createdAt: row.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Legacy S3/MinIO flow — refactor để dùng AttachmentRepository thay vì Prisma
  // trực tiếp cho bảng attachments. Behaviour giữ nguyên.
  // ---------------------------------------------------------------------------
  async createUploadUrl(dto: CreateUploadUrlDto) {
    if (!this.bucket) {
      throw new BusinessError(
        "S3_NOT_CONFIGURED",
        "S3 bucket not configured",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const key = this.buildKey(dto.relatedType, dto.relatedId, dto.fileName);
    const attachment = await this.prisma.$transaction(async (tx) => {
      const row = await this.repo.create(
        {
          fileName: dto.fileName,
          fileUrl: key,
          fileType: dto.fileType ?? inferFileType(dto.mimeType),
          mimeType: dto.mimeType,
          size: 0,
          relatedType: dto.relatedType,
          relatedId: dto.relatedId,
          createdById: this.ctx.getUserId() ?? null,
        },
        tx,
      );
      await this.audit.record(
        {
          action: "attachment.upload_url",
          entityType: "Attachment",
          entityId: row.id,
          after: { key, relatedType: dto.relatedType, relatedId: dto.relatedId },
        },
        tx,
      );
      return row;
    });
    const put = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.mimeType,
    });
    const url = await getSignedUrl(this.client, put, { expiresIn: UPLOAD_URL_TTL });
    return { attachmentId: attachment.id, uploadUrl: url, key, expiresIn: UPLOAD_URL_TTL };
  }

  async confirm(id: string, dto: ConfirmUploadDto) {
    const a = await this.repo.findById(id);
    if (!a) {
      throw new NotFoundException({ code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found" });
    }
    return this.prisma.$transaction(async (tx) => {
      // ARCHITECTURE rule: chỉ Repository được chạm ORM. Không dùng tx.attachment.* trực tiếp.
      const updated = await this.repo.update(id, { size: dto.size }, tx);
      await this.audit.record(
        {
          action: "attachment.confirm",
          entityType: "Attachment",
          entityId: id,
          before: a,
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  async list(relatedType: string, relatedId: string) {
    return this.repo.findByEntity(relatedType, relatedId);
  }

  async downloadUrl(id: string) {
    const a = await this.repo.findById(id);
    if (!a) {
      throw new NotFoundException({ code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found" });
    }
    const get = new GetObjectCommand({ Bucket: this.bucket, Key: a.fileUrl });
    const url = await getSignedUrl(this.client, get, { expiresIn: DOWNLOAD_URL_TTL });
    return { url, expiresIn: DOWNLOAD_URL_TTL, fileName: a.fileName, mimeType: a.mimeType };
  }

  async softDelete(id: string) {
    const a = await this.repo.findById(id);
    if (!a) {
      throw new NotFoundException({ code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found" });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.repo.deleteById(id, tx);
      await this.audit.record(
        {
          action: "attachment.delete",
          entityType: "Attachment",
          entityId: id,
          before: a,
        },
        tx,
      );
    });
    // Best-effort cleanup on remote storage AFTER commit. If cleanup fails the
    // DB delete still holds — DB row is the source of truth. We route by which
    // remote storage the row lived on.
    if (a.driveFileId) {
      try {
        await this.drive.deleteFile(a.driveFileId);
      } catch (err) {
        this.logger.warn(
          `Failed to remove Drive file ${a.driveFileId}: ${(err as Error).message}`,
        );
      }
    } else {
      try {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: a.fileUrl }));
      } catch (err) {
        this.logger.warn(`Failed to remove S3 object ${a.fileUrl}: ${(err as Error).message}`);
      }
    }
    return { id, deleted: true };
  }
}

function inferFileType(mime: string): string {
  if (mime.startsWith("image/")) return "photo";
  if (mime === "application/pdf") return "invoice";
  return "file";
}
