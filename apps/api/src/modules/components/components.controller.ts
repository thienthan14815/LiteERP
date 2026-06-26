import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ComponentsService } from "./components.service";
import { QueryComponentDto } from "./dto/query-component.dto";
import { UpdateComponentDto } from "./dto/update-component.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("components")
export class ComponentsController {
  constructor(private readonly svc: ComponentsService) {}

  @Get() @Permissions("component:view")
  list(@Query() q: QueryComponentDto) { return this.svc.list(q); }

  @Get("by-serial/:serial") @Permissions("component:view")
  bySerial(@Param("serial") serial: string) { return this.svc.getBySerial(serial); }

  @Get(":id") @Permissions("component:view")
  get(@Param("id") id: string) { return this.svc.get(id); }

  @Patch(":id") @Permissions("component:update")
  update(@Param("id") id: string, @Body() dto: UpdateComponentDto) {
    return this.svc.update(id, dto);
  }

  @Post(":id/scrap") @Permissions("component:update")
  scrap(@Param("id") id: string) { return this.svc.scrap(id); }
}
