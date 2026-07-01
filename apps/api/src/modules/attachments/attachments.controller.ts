import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
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

  // VN: NEW — multipart upload trực tiếp qua Drive. Frontend chỉ nhận
  // thumbnailUrl / previewUrl, không thấy driveFileId.
  @Post("upload-drive")
  @Permissions("attachment:create")
  @UseInterceptors(FileInterceptor("file"))
  uploadDrive(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDriveDto,
  ) {
    return this.svc.uploadToDrive(file, dto);
  }

  @Post(":id/confirm") @Permissions("attachment:create")
  confirm(@Param("id") id: string, @Body() dto: ConfirmUploadDto) {
    return this.svc.confirm(id, dto);
  }

  @Get() @Permissions("attachment:view")
  list(@Query() q: QueryAttachmentsDto) {
    return this.svc.list(q.relatedType, q.relatedId);
  }

  @Get(":id/download-url") @Permissions("attachment:view")
  download(@Param("id") id: string) {
    return this.svc.downloadUrl(id);
  }

  @Delete(":id") @Permissions("attachment:delete")
  remove(@Param("id") id: string) {
    return this.svc.softDelete(id);
  }
}
