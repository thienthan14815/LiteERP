import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("customers")
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Get() @Permissions("customer:view")
  list(@Query() q: PaginationDto) { return this.svc.list(q); }

  @Post() @Permissions("customer:create")
  create(@Body() dto: CreateCustomerDto) { return this.svc.create(dto); }

  @Get(":id") @Permissions("customer:view")
  get(@Param("id") id: string) { return this.svc.get(id); }

  @Patch(":id") @Permissions("customer:update")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto) { return this.svc.update(id, dto); }

  @Delete(":id") @Permissions("customer:update")
  remove(@Param("id") id: string) { return this.svc.remove(id); }
}
