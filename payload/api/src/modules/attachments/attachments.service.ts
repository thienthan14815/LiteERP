import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DbService } from "../../database/db.service";
import { RequestContextService } from "../../common/context/request-context.service";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import type { AppConfig } from "../../config/configuration";
import { AttachmentRepository } from "../../repository/attachment.repository";
import { DriveService } from "../drive/drive.service";
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
} from "./dto/create-upload-url.dto";
import { UploadDriveDto } from "./dto/upload-drive.dto";
import type { AttachmentResponse } from "./dto/attachment.response";

// VN: AttachmentsService — hai backend:
//  - Drive (primary, dùng cho các entity đã bật Drive).
//  - Local FS (fallback + dùng khi chạy standalone không có Google creds).
// Không còn S3/MinIO. `fileUrl` giờ chứa path tương đối tính từ UPLOAD_DIR
// (dấu hiệu nhận biết: driveFileId == null).

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly dbs: DbService,
    private readonly audit: AuditLogService,
    private readonly ctx: RequestContextService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly repo: AttachmentRepository,
    private readonly drive: DriveService,
  ) {
    this.uploadDir = resolve(
      this.config.get("uploadDir", { infer: true }) as string,
    );
  }

  private buildRelPath(
    relatedType: string,
    relatedId: string,
    fileName: string,
  ): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ts = Date.now();
    return `${relatedType.toLowerCase()}/${relatedId}/${ts}-${safeName}`;
  }

  private absPath(relPath: string): string {
    return join(this.uploadDir, relPath);
  }

  // ---------------------------------------------------------------------------
  // Drive-backed upload (multipart/form-data) — unchanged from Phase 1.5.
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
    if (!dto.entityType || !dto.entityId) {
      throw new BusinessError(
        "ENTITY_REQUIRED",
        "entityType and entityId are required",
        HttpStatus.BAD_REQUEST,
      );
    }

    const uploaded = await this.drive.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      dto.folder,
    );

    try {
      const row = await this.dbs.transaction(async (db) => {
        const created = await this.repo.create(
          {
            fileName: file.originalname,
            fileUrl: uploaded.driveFileId,
            fileType: inferFileType(file.mimetype),
            mimeType: file.mimetype,
            size: uploaded.sizeBytes,
            relatedType: dto.entityType,
            relatedId: dto.entityId,
            driveFileId: uploaded.driveFileId,
            createdById: this.ctx.getUserId() ?? null,
          },
          db,
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
          db,
        );
        return created;
      });
      return this.toResponse(row, uploaded.thumbnailUrl, uploaded.previewUrl);
    } catch (err) {
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

  // ---------------------------------------------------------------------------
  // Local FS upload (multipart) — thay S3 presigned flow.
  // ---------------------------------------------------------------------------
  async uploadLocal(
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
    if (!dto.entityType || !dto.entityId) {
      throw new BusinessError(
        "ENTITY_REQUIRED",
        "entityType and entityId are required",
        HttpStatus.BAD_REQUEST,
      );
    }

    const relPath = this.buildRelPath(
      dto.entityType,
      dto.entityId,
      file.originalname,
    );
    const abs = this.absPath(relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, file.buffer);

    try {
      const row = await this.dbs.transaction(async (db) => {
        const created = await this.repo.create(
          {
            fileName: file.originalname,
            fileUrl: relPath,
            fileType: inferFileType(file.mimetype),
            mimeType: file.mimetype,
            size: file.size,
            relatedType: dto.entityType,
            relatedId: dto.entityId,
            createdById: this.ctx.getUserId() ?? null,
          },
          db,
        );
        await this.audit.record(
          {
            action: "attachment.upload",
            entityType: "Attachment",
            entityId: created.id,
            after: {
              relatedType: dto.entityType,
              relatedId: dto.entityId,
              path: relPath,
              sizeBytes: file.size,
            },
          },
          db,
        );
        return created;
      });
      return this.toResponse(row);
    } catch (err) {
      try {
        await unlink(abs);
      } catch (cleanupErr) {
        this.logger.error(
          `Failed to cleanup local file ${abs}: ${(cleanupErr as Error).message}`,
        );
      }
      throw err;
    }
  }

  // Legacy shape kept so any lingering client code doesn't 404. The two-step
  // presigned flow is gone (SQLite/standalone build has no S3 backend). Point
  // callers at /upload-drive or /upload-local instead.
  async createUploadUrl(_dto: CreateUploadUrlDto) {
    throw new BusinessError(
      "UPLOAD_URL_UNSUPPORTED",
      "Presigned upload URLs are not supported. Use POST /attachments/upload-drive or /attachments/upload-local instead.",
      HttpStatus.GONE,
    );
  }

  async confirm(_id: string, _dto: ConfirmUploadDto) {
    throw new BusinessError(
      "UPLOAD_URL_UNSUPPORTED",
      "Presigned upload confirmation is not supported. Use the direct multipart upload endpoints.",
      HttpStatus.GONE,
    );
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

  async list(relatedType: string, relatedId: string) {
    const rows = await this.repo.findByEntity(relatedType, relatedId);
    return rows.map((r) => this.toResponse(r));
  }

  // Stream local file. Drive-backed rows return the Drive preview URL — Drive
  // has its own auth model, so we don't proxy through the API for those.
  async download(id: string): Promise<
    | { kind: "stream"; file: StreamableFile; fileName: string; mimeType: string }
    | { kind: "redirect"; url: string; fileName: string; mimeType: string }
  > {
    const a = await this.repo.findById(id);
    if (!a) {
      throw new NotFoundException({
        code: "ATTACHMENT_NOT_FOUND",
        message: "Attachment not found",
      });
    }
    if (a.driveFileId) {
      return {
        kind: "redirect",
        url: this.drive.getPreviewUrl(a.driveFileId),
        fileName: a.fileName,
        mimeType: a.mimeType,
      };
    }
    const abs = this.absPath(a.fileUrl);
    const stream = createReadStream(abs);
    return {
      kind: "stream",
      file: new StreamableFile(stream, { type: a.mimeType }),
      fileName: a.fileName,
      mimeType: a.mimeType,
    };
  }

  async softDelete(id: string) {
    const a = await this.repo.findById(id);
    if (!a) {
      throw new NotFoundException({
        code: "ATTACHMENT_NOT_FOUND",
        message: "Attachment not found",
      });
    }
    await this.dbs.transaction(async (db) => {
      await this.repo.deleteById(id, db);
      await this.audit.record(
        {
          action: "attachment.delete",
          entityType: "Attachment",
          entityId: id,
          before: a,
        },
        db,
      );
    });
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
        await unlink(this.absPath(a.fileUrl));
      } catch (err) {
        this.logger.warn(
          `Failed to remove local file ${a.fileUrl}: ${(err as Error).message}`,
        );
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
