import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { FinishedPcsService } from "./finished-pcs.service";
import { QueryFinishedPcDto } from "./dto/query-finished-pc.dto";
import { UpdateFinishedPcDto } from "./dto/update-finished-pc.dto";
import { TransitionFinishedPcDto } from "./dto/transition-finished-pc.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("finished-pcs")
export class FinishedPcsController {
  constructor(private readonly svc: FinishedPcsService) {}

  @Get() @Permissions("finished_pc:view")
  list(@Query() q: QueryFinishedPcDto) { return this.svc.list(q); }

  @Get(":id") @Permissions("finished_pc:view")
  get(@Param("id") id: string) { return this.svc.get(id); }

  @Patch(":id") @Permissions("finished_pc:update")
  update(@Param("id") id: string, @Body() dto: UpdateFinishedPcDto) {
    return this.svc.update(id, dto);
  }

  @Post(":id/transition") @Permissions("finished_pc:update")
  transition(@Param("id") id: string, @Body() dto: TransitionFinishedPcDto) {
    return this.svc.transition(id, dto);
  }

  @Post(":id/scrap") @Permissions("finished_pc:update")
  scrap(@Param("id") id: string) { return this.svc.scrap(id); }
}
