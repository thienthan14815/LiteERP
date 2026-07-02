import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { BusinessError } from "../../common/exceptions/business.exception";
import { BackupService } from "./backup.service";

// Rule 3 + audit: mọi thao tác backup/restore đi qua Service Layer. Controller
// không chạm Prisma. `system:admin` không có trong seed hiện tại — ADMIN role
// được bypass PermissionsGuard.
@Controller("backup")
export class BackupController {
  constructor(private readonly svc: BackupService) {}

  @Post("run")
  @Permissions("system:admin")
  run() {
    return this.svc.dumpAndUpload();
  }

  @Get()
  @Permissions("system:admin")
  list() {
    return this.svc.list();
  }

  @Delete(":id")
  @Permissions("system:admin")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }

  // Multipart .zip (chứa .sql) hoặc .sql thuần. Max 200MB.
  @Post("restore")
  @Permissions("system:admin")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  restore(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BusinessError(
        "RESTORE_INVALID_FILE",
        "Thiếu file — dùng form-data key 'file'",
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.svc.restore(file);
  }
}
