import { BadRequestException } from "@nestjs/common";
import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";

// Server-side upload guardrails. The client-declared mimetype is NOT trusted
// as authorization to store arbitrary content: only these types are accepted,
// and the total size is capped to prevent disk-fill DoS on the device.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_UPLOAD_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_UPLOAD_MIME.has(mime);
}

/**
 * Reduce a caller-supplied value to a single safe path segment. Returns null if
 * nothing usable survives (caller should reject). Strips leading dots so
 * "..", "../x" etc. can never traverse out of the upload directory.
 */
export function sanitizePathSegment(raw: string): string | null {
  const cleaned = (raw ?? "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
  if (!cleaned || cleaned === "_") return null;
  return cleaned;
}

// Reusable FileInterceptor options for attachment endpoints.
export const attachmentMulterOptions: MulterOptions = {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME.has(file.mimetype)) {
      cb(
        new BadRequestException({
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: `File type '${file.mimetype}' is not allowed. Allowed: images and PDF.`,
        }),
        false,
      );
      return;
    }
    cb(null, true);
  },
};
