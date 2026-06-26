import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { UpdateSaleDto } from "./dto/update-sale.dto";
import { QuerySaleDto } from "./dto/query-sale.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("sales")
export class SalesController {
  constructor(private readonly svc: SalesService) {}

  @Get() @Permissions("sale:view")
  list(@Query() q: QuerySaleDto) { return this.svc.list(q); }

  @Post() @Permissions("sale:create")
  create(@Body() dto: CreateSaleDto) { return this.svc.create(dto); }

  @Get(":id") @Permissions("sale:view")
  get(@Param("id") id: string) { return this.svc.get(id); }

  @Patch(":id") @Permissions("sale:update")
  update(@Param("id") id: string, @Body() dto: UpdateSaleDto) {
    return this.svc.update(id, dto);
  }

  @Post(":id/confirm") @Permissions("sale:create")
  confirm(@Param("id") id: string) { return this.svc.confirm(id); }

  @Post(":id/cancel") @Permissions("sale:cancel")
  cancel(@Param("id") id: string) { return this.svc.cancel(id); }
}
