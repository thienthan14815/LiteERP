import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { WarrantiesService } from "./warranties.service";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CreateWarrantyDto } from "./dto/create-warranty.dto";
import { QueryWarrantyDto } from "./dto/query-warranty.dto";
import { TransitionWarrantyDto } from "./dto/transition-warranty.dto";
import { ReplaceComponentDto } from "./dto/replace-component.dto";

@Controller("warranties")
export class WarrantiesController {
  constructor(private readonly svc: WarrantiesService) {}

  @Get() @Permissions("warranty:view")
  list(@Query() q: QueryWarrantyDto) {
    return this.svc.list(q);
  }

  @Post() @Permissions("warranty:create")
  create(@Body() dto: CreateWarrantyDto) {
    return this.svc.create(dto);
  }

  @Get(":id") @Permissions("warranty:view")
  get(@Param("id") id: string) {
    return this.svc.get(id);
  }

  @Patch(":id/status") @Permissions("warranty:update")
  transition(@Param("id") id: string, @Body() dto: TransitionWarrantyDto) {
    return this.svc.transition(id, dto);
  }

  @Post(":id/replace-component") @Permissions("warranty:update")
  replace(@Param("id") id: string, @Body() dto: ReplaceComponentDto) {
    return this.svc.replaceComponent(id, dto);
  }

  @Post(":id/cancel") @Permissions("warranty:update")
  cancel(@Param("id") id: string) {
    return this.svc.cancel(id);
  }
}
