import { IsEnum, IsString, MaxLength } from "class-validator";
import { DriveFolder } from "../../drive/drive-folder.enum";

// VN: DTO cho POST /attachments/upload-drive. Nhận qua multipart/form-data,
// nên các trường body đều là string (multer để nguyên). class-validator vẫn
// hoạt động vì global ValidationPipe transform=true.
export class UploadDriveDto {
  @IsString()
  @MaxLength(64)
  entityType!: string;

  @IsString()
  @MaxLength(64)
  entityId!: string;

  @IsEnum(DriveFolder)
  folder!: DriveFolder;
}
