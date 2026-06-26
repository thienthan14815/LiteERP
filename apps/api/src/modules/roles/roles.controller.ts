import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("roles")
export class RolesController {
  constructor(private readonly svc: RolesService) {}

  @Get()
  @Permissions("role:assign")
  list() {
    return this.svc.list();
  }

  @Post()
  @Permissions("role:assign")
  create(@Body() dto: CreateRoleDto) {
    return this.svc.create(dto);
  }

  @Patch(":id")
  @Permissions("role:assign")
  update(@Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @Permissions("role:assign")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
}
