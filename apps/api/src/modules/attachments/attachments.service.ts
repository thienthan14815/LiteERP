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
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
} from "./dto/create-upload-url.dto";

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

  async createUploadUrl(dto: CreateUploadUrlDto) {
    if (!this.bucket) {
      throw new BusinessError(
        "S3_NOT_CONFIGURED",
        "S3 bucket not configured",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const key = this.buildKey(dto.relatedType, dto.relatedId, dto.fileName);
    const attachment = await this.prisma.attachment.create({
      data: {
        fileName: dto.fileName,
        fileUrl: key,
        fileType: dto.fileType ?? inferFileType(dto.mimeType),
        mimeType: dto.mimeType,
        size: 0,
        relatedType: dto.relatedType,
        relatedId: dto.relatedId,
        createdById: this.ctx.getUserId() ?? null,
      },
    });
    const put = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.mimeType,
    });
    const url = await getSignedUrl(this.client, put, { expiresIn: UPLOAD_URL_TTL });
    await this.audit.record({
      action: "attachment.upload_url",
      entityType: "Attachment",
      entityId: attachment.id,
      after: { key, relatedType: dto.relatedType, relatedId: dto.relatedId },
    });
    return { attachmentId: attachment.id, uploadUrl: url, key, expiresIn: UPLOAD_URL_TTL };
  }

  async confirm(id: string, dto: ConfirmUploadDto) {
    const a = await this.prisma.attachment.findUnique({ where: { id } });
    if (!a) {
      throw new NotFoundException({ code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found" });
    }
    const updated = await this.prisma.attachment.update({
      where: { id },
      data: { size: dto.size },
    });
    await this.audit.record({
      action: "attachment.confirm",
      entityType: "Attachment",
      entityId: id,
      before: a,
      after: updated,
    });
    return updated;
  }

  async list(relatedType: string, relatedId: string) {
    return this.prisma.attachment.findMany({
      where: { relatedType, relatedId },
      orderBy: { createdAt: "desc" },
    });
  }

  async downloadUrl(id: string) {
    const a = await this.prisma.attachment.findUnique({ where: { id } });
    if (!a) {
      throw new NotFoundException({ code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found" });
    }
    const get = new GetObjectCommand({ Bucket: this.bucket, Key: a.fileUrl });
    const url = await getSignedUrl(this.client, get, { expiresIn: DOWNLOAD_URL_TTL });
    return { url, expiresIn: DOWNLOAD_URL_TTL, fileName: a.fileName, mimeType: a.mimeType };
  }

  async softDelete(id: string) {
    const a = await this.prisma.attachment.findUnique({ where: { id } });
    if (!a) {
      throw new NotFoundException({ code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found" });
    }
    // Best-effort remove from MinIO; row stays (no deletedAt column in schema yet).
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: a.fileUrl }));
    } catch (err) {
      this.logger.warn(`Failed to remove S3 object ${a.fileUrl}: ${(err as Error).message}`);
    }
    await this.prisma.attachment.delete({ where: { id } });
    await this.audit.record({
      action: "attachment.delete",
      entityType: "Attachment",
      entityId: id,
      before: a,
    });
    return { id, deleted: true };
  }
}

function inferFileType(mime: string): string {
  if (mime.startsWith("image/")) return "photo";
  if (mime === "application/pdf") return "invoice";
  return "file";
}
