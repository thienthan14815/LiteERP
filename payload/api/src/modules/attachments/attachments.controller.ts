import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { AttachmentsService } from "./attachments.service";
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
  QueryAttachmentsDto,
} from "./dto/create-upload-url.dto";
import { UploadDriveDto } from "./dto/upload-drive.dto";

@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly svc: AttachmentsService) {}

  @Post("upload-url") @Permissions("attachment:create")
  uploadUrl(@Body() dto: CreateUploadUrlDto) {
    return this.svc.createUploadUrl(dto);
  }

  // VN: Drive multipart upload — primary path cho các entity đã bật Drive.
  @Post("upload-drive")
  @Permissions("attachment:create")
  @UseInterceptors(FileInterceptor("file"))
  uploadDrive(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDriveDto,
  ) {
    return this.svc.uploadToDrive(file, dto);
  }

  // VN: Local FS upload — dùng khi standalone (không Google creds) hoặc khi
  // entity không cần Drive backup.
  @Post("upload-local")
  @Permissions("attachment:create")
  @UseInterceptors(FileInterceptor("file"))
  uploadLocal(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDriveDto,
  ) {
    return this.svc.uploadLocal(file, dto);
  }

  @Post(":id/confirm") @Permissions("attachment:create")
  confirm(@Param("id") id: string, @Body() dto: ConfirmUploadDto) {
    return this.svc.confirm(id, dto);
  }

  @Get() @Permissions("attachment:view")
  list(@Query() q: QueryAttachmentsDto) {
    return this.svc.list(q.relatedType, q.relatedId);
  }

  // Stream local files inline; redirect to Drive preview for Drive-backed rows.
  @Get(":id/download") @Permissions("attachment:view")
  async download(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.svc.download(id);
    if (result.kind === "redirect") {
      res.redirect(302, result.url);
      return undefined;
    }
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(result.fileName)}"`,
    );
    return result.file;
  }

  @Delete(":id") @Permissions("attachment:delete")
  remove(@Param("id") id: string) {
    return this.svc.softDelete(id);
  }
}
