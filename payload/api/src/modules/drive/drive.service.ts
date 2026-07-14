import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Readable } from "node:stream";
import { drive_v3, google } from "googleapis";
import { BusinessError } from "../../common/exceptions/business.exception";
import type { AppConfig } from "../../config/configuration";
import { DRIVE_FOLDER_PATH, DriveFolder } from "./drive-folder.enum";

// VN: DriveService là lớp DUY NHẤT được phép nói chuyện với Google Drive API.
// Tuân theo ARCHITECTURE_forSQL.md:
//  - Drive là Object Storage cho binary (ảnh, PDF, backup...). Không DB.
//  - drive_file_id / OAuth token / URL nội bộ KHÔNG được lộ ra frontend.
//  - Nếu chưa cấu hình credentials -> DEGRADED mode: module vẫn load, upload
//    ném lỗi rõ ràng DRIVE_NOT_CONFIGURED, không crash app.
export interface DriveUploadResult {
  driveFileId: string;
  thumbnailUrl: string;
  previewUrl: string;
  sizeBytes: number;
}

interface DriveCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  rootFolderId: string;
}

const DEFAULT_THUMBNAIL_SIZE = 400;

@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private readonly credentials: DriveCredentials | null;
  private readonly configured: boolean;
  private client: drive_v3.Drive | null = null;
  // VN: Cache DriveFolder -> folderId trong process. Phase 1 in-memory là đủ.
  // TODO(phase2): persist mapping xuống bảng `drive_folder_cache` để tránh gọi
  // lại API mỗi lần restart.
  private readonly folderIdCache = new Map<DriveFolder, string>();

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID ?? "";
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? "";
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? "";
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "";

    if (!clientId || !clientSecret || !refreshToken || !rootFolderId) {
      this.credentials = null;
      this.configured = false;
      this.logger.warn(
        "Google Drive credentials missing — DriveService running in DEGRADED mode. Uploads will fail with DRIVE_NOT_CONFIGURED until env vars are set.",
      );
    } else {
      this.credentials = { clientId, clientSecret, refreshToken, rootFolderId };
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    folder: DriveFolder,
  ): Promise<DriveUploadResult> {
    this.ensureConfigured();
    const drive = this.getDrive();
    const parentId = await this.resolveFolderId(folder);

    // VN: googleapis chấp nhận stream. Wrap Buffer -> Readable để tránh nạp
    // lại toàn bộ file vào RAM lần nữa (buffer đã ở trong RAM rồi, nhưng
    // Readable.from tránh copy).
    const media = {
      mimeType,
      body: Readable.from(buffer),
    };

    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [parentId],
        mimeType,
      },
      media,
      fields: "id,size",
      supportsAllDrives: false,
    });

    const driveFileId = res.data.id;
    if (!driveFileId) {
      throw new BusinessError(
        "DRIVE_UPLOAD_FAILED",
        "Google Drive did not return a file id",
        HttpStatus.BAD_GATEWAY,
      );
    }
    const reportedSize = res.data.size ? Number(res.data.size) : buffer.byteLength;

    // File ảnh/attachment cần public-with-link để `<img src=thumbnailUrl>` load
    // được trực tiếp từ trình duyệt (Drive mặc định là private → thumbnail
    // trả placeholder). Backup KHÔNG public — chỉ chủ Drive xem được.
    if (folder !== DriveFolder.BACKUP) {
      try {
        await drive.permissions.create({
          fileId: driveFileId,
          requestBody: { role: "reader", type: "anyone" },
        });
      } catch (err) {
        this.logger.warn(
          `Không set được permission public cho ${driveFileId}: ${(err as Error).message}. Thumbnail có thể không load.`,
        );
      }
    }

    return {
      driveFileId,
      thumbnailUrl: this.getThumbnailUrl(driveFileId),
      previewUrl: this.getPreviewUrl(driveFileId),
      sizeBytes: reportedSize,
    };
  }

  async deleteFile(driveFileId: string): Promise<void> {
    this.ensureConfigured();
    const drive = this.getDrive();
    try {
      await drive.files.delete({ fileId: driveFileId });
    } catch (err) {
      // VN: 404 nghĩa là file đã biến mất -> coi như xoá thành công (idempotent).
      const code = (err as { code?: number }).code;
      if (code === 404) {
        this.logger.warn(`Drive file ${driveFileId} already gone (404), treating as deleted`);
        return;
      }
      throw err;
    }
  }

  /**
   * List file trong 1 folder (không đệ quy). Dùng cho retention: đếm được
   * số file thực tế trên Drive so với DB để phát hiện drift.
   */
  async listFilesInFolder(
    folder: DriveFolder,
  ): Promise<Array<{ driveFileId: string; name: string; sizeBytes: number; createdAt: Date }>> {
    this.ensureConfigured();
    const drive = this.getDrive();
    const folderId = await this.resolveFolderId(folder);
    const out: Array<{ driveFileId: string; name: string; sizeBytes: number; createdAt: Date }> = [];
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, size, createdTime)",
        pageSize: 100,
        pageToken,
      });
      for (const f of res.data.files ?? []) {
        if (!f.id) continue;
        out.push({
          driveFileId: f.id,
          name: f.name ?? "",
          sizeBytes: f.size ? Number(f.size) : 0,
          createdAt: f.createdTime ? new Date(f.createdTime) : new Date(0),
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  }

  // VN: getThumbnailUrl là pure — không gọi API. Dùng endpoint public của Drive
  // (thumbnail?id=...&sz=w400). Frontend chỉ nhận URL này, không thấy raw file id
  // nếu Service đảm bảo không log ra response DTO khác.
  getThumbnailUrl(driveFileId: string, size: number = DEFAULT_THUMBNAIL_SIZE): string {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w${size}`;
  }

  getPreviewUrl(driveFileId: string): string {
    return `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview`;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private ensureConfigured(): void {
    if (!this.configured || !this.credentials) {
      throw new BusinessError(
        "DRIVE_NOT_CONFIGURED",
        "Google Drive integration is not configured. Set GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN / GOOGLE_DRIVE_ROOT_FOLDER_ID in your .env and restart the API.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private getDrive(): drive_v3.Drive {
    if (this.client) return this.client;
    if (!this.credentials) {
      throw new BusinessError(
        "DRIVE_NOT_CONFIGURED",
        "Google Drive integration is not configured",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const oauth = new google.auth.OAuth2(
      this.credentials.clientId,
      this.credentials.clientSecret,
    );
    oauth.setCredentials({ refresh_token: this.credentials.refreshToken });
    this.client = google.drive({ version: "v3", auth: oauth });
    return this.client;
  }

  // VN: Lazy resolve subfolder. Nếu không tồn tại thì tạo mới. Cache lại.
  private async resolveFolderId(folder: DriveFolder): Promise<string> {
    const cached = this.folderIdCache.get(folder);
    if (cached) return cached;
    if (!this.credentials) {
      throw new BusinessError(
        "DRIVE_NOT_CONFIGURED",
        "Google Drive not configured",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const path = DRIVE_FOLDER_PATH[folder];
    const drive = this.getDrive();
    let parentId = this.credentials.rootFolderId;
    for (const segment of path) {
      parentId = await this.getOrCreateSubfolder(drive, parentId, segment);
    }
    this.folderIdCache.set(folder, parentId);
    return parentId;
  }

  private async getOrCreateSubfolder(
    drive: drive_v3.Drive,
    parentId: string,
    name: string,
  ): Promise<string> {
    const escaped = name.replace(/'/g, "\\'");
    const q = `name = '${escaped}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const found = await drive.files.list({
      q,
      fields: "files(id,name)",
      pageSize: 1,
      spaces: "drive",
    });
    const first = found.data.files?.[0];
    if (first?.id) return first.id;

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    if (!created.data.id) {
      throw new BusinessError(
        "DRIVE_FOLDER_CREATE_FAILED",
        `Failed to create Drive folder '${name}'`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    return created.data.id;
  }
}
