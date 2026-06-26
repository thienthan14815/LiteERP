import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { AssembliesService } from "./assemblies.service";
import { CreateAssemblyDto } from "./dto/create-assembly.dto";
import { UpdateAssemblyDto } from "./dto/update-assembly.dto";
import { QueryAssemblyDto } from "./dto/query-assembly.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("assemblies")
export class AssembliesController {
  constructor(private readonly svc: AssembliesService) {}

  @Get() @Permissions("assembly:view")
  list(@Query() q: QueryAssemblyDto) { return this.svc.list(q); }

  @Post() @Permissions("assembly:create")
  create(@Body() dto: CreateAssemblyDto) { return this.svc.create(dto); }

  @Get(":id") @Permissions("assembly:view")
  get(@Param("id") id: string) { return this.svc.get(id); }

  @Patch(":id") @Permissions("assembly:update")
  update(@Param("id") id: string, @Body() dto: UpdateAssemblyDto) {
    return this.svc.update(id, dto);
  }

  @Post(":id/start") @Permissions("assembly:update")
  start(@Param("id") id: string) { return this.svc.start(id); }

  @Post(":id/complete") @Permissions("assembly:complete")
  complete(@Param("id") id: string) { return this.svc.complete(id); }

  @Post(":id/cancel") @Permissions("assembly:cancel")
  cancel(@Param("id") id: string) { return this.svc.cancel(id); }
}
