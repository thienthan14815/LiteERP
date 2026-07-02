import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { MasterOptionsService } from "./master-options.service";
import {
  CreateMasterOptionDto,
  QueryMasterOptionDto,
  UpdateMasterOptionDto,
} from "./dto/master-option.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("master-options")
export class MasterOptionsController {
  constructor(private readonly svc: MasterOptionsService) {}

  @Get() @Permissions("sale:view")
  list(@Query() q: QueryMasterOptionDto) {
    return this.svc.list(q.type);
  }

  @Post() @Permissions("sale:create")
  create(@Body() dto: CreateMasterOptionDto) {
    return this.svc.create(dto);
  }

  @Patch(":id") @Permissions("sale:update")
  update(@Param("id") id: string, @Body() dto: UpdateMasterOptionDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id") @Permissions("sale:cancel")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
}
