import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { PurchasesService } from "./purchases.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";
import { QueryPurchaseDto } from "./dto/query-purchase.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("purchases")
export class PurchasesController {
  constructor(private readonly svc: PurchasesService) {}

  @Get() @Permissions("purchase:view")
  list(@Query() q: QueryPurchaseDto) { return this.svc.list(q); }

  @Post() @Permissions("purchase:create")
  create(@Body() dto: CreatePurchaseDto) { return this.svc.create(dto); }

  @Get(":id") @Permissions("purchase:view")
  get(@Param("id") id: string) { return this.svc.get(id); }

  @Patch(":id") @Permissions("purchase:update")
  update(@Param("id") id: string, @Body() dto: UpdatePurchaseDto) { return this.svc.update(id, dto); }

  @Post(":id/confirm") @Permissions("purchase:confirm")
  confirm(@Param("id") id: string) { return this.svc.confirm(id); }

  @Post(":id/cancel") @Permissions("purchase:cancel")
  cancel(@Param("id") id: string) { return this.svc.cancel(id); }
}
