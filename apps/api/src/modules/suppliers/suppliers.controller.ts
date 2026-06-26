import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly svc: SuppliersService) {}

  @Get() @Permissions("supplier:view")
  list(@Query() q: PaginationDto) { return this.svc.list(q); }

  @Post() @Permissions("supplier:create")
  create(@Body() dto: CreateSupplierDto) { return this.svc.create(dto); }

  @Get(":id") @Permissions("supplier:view")
  get(@Param("id") id: string) { return this.svc.get(id); }

  @Patch(":id") @Permissions("supplier:update")
  update(@Param("id") id: string, @Body() dto: UpdateSupplierDto) { return this.svc.update(id, dto); }

  @Delete(":id") @Permissions("supplier:update")
  remove(@Param("id") id: string) { return this.svc.remove(id); }
}
