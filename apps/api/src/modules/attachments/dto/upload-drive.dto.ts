import { IsEnum, IsString, Matches, MaxLength } from "class-validator";
import { DriveFolder } from "../../drive/drive-folder.enum";

// VN: DTO cho POST /attachments/upload-drive. Nhận qua multipart/form-data,
// nên các trường body đều là string (multer để nguyên). class-validator vẫn
// hoạt động vì global ValidationPipe transform=true.
//
// entityType/entityId được ghép vào đường dẫn lưu file → chỉ cho phép ký tự
// an toàn (chống path traversal ../). Service vẫn sanitize lần nữa (defence in
// depth), nhưng chặn ngay ở DTO cho thông báo lỗi rõ ràng.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export class UploadDriveDto {
  @IsString()
  @MaxLength(64)
  @Matches(SAFE_SEGMENT, {
    message: "entityType chỉ được chứa chữ, số, dấu . _ -",
  })
  entityType!: string;

  @IsString()
  @MaxLength(64)
  @Matches(SAFE_SEGMENT, {
    message: "entityId chỉ được chứa chữ, số, dấu . _ -",
  })
  entityId!: string;

  @IsEnum(DriveFolder)
  folder!: DriveFolder;
}
