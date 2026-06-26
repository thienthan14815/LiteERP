import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { AttachmentsService } from "./attachments.service";
import {
  ConfirmUploadDto,
  CreateUploadUrlDto,
  QueryAttachmentsDto,
} from "./dto/create-upload-url.dto";

@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly svc: AttachmentsService) {}

  @Post("upload-url") @Permissions("attachment:create")
  uploadUrl(@Body() dto: CreateUploadUrlDto) {
    return this.svc.createUploadUrl(dto);
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
