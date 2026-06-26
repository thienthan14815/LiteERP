import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("users")
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  @Permissions("user:view")
  list(@Query() q: PaginationDto) {
    return this.svc.list(q);
  }

  @Post()
  @Permissions("user:create")
  create(@Body() dto: CreateUserDto) {
    return this.svc.create(dto);
  }

  @Get(":id")
  @Permissions("user:view")
  get(@Param("id") id: string) {
    return this.svc.get(id);
  }

  @Patch(":id")
  @Permissions("user:update")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @Permissions("user:delete")
  remove(@Param("id") id: string) {
    return this.svc.softDelete(id);
  }
}
