import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { MachinesService } from "./machines.service";
import { QueryMachineDto } from "./dto/query-machine.dto";
import { InspectMachineDto } from "./dto/inspect-machine.dto";
import { AllocateCostDto } from "./dto/allocate-cost.dto";
import { UpdateMachineDto } from "./dto/update-machine.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("machines")
export class MachinesController {
  constructor(private readonly svc: MachinesService) {}

  @Get() @Permissions("machine:view")
  list(@Query() q: QueryMachineDto) { return this.svc.list(q); }

  @Get(":id") @Permissions("machine:view")
  get(@Param("id") id: string) { return this.svc.get(id); }

  @Patch(":id") @Permissions("machine:update")
  update(@Param("id") id: string, @Body() dto: UpdateMachineDto) {
    return this.svc.update(id, dto);
  }

  @Post(":id/inspect") @Permissions("machine:inspect")
  inspect(@Param("id") id: string, @Body() dto: InspectMachineDto) {
    return this.svc.inspect(id, dto);
  }

  @Post(":id/allocate-cost") @Permissions("machine:allocate_cost")
  allocate(@Param("id") id: string, @Body() dto: AllocateCostDto) {
    return this.svc.allocateCost(id, dto);
  }

  @Post(":id/disassemble") @Permissions("machine:disassemble")
  disassemble(@Param("id") id: string) {
    return this.svc.disassemble(id);
  }

  @Post(":id/mark-ready-for-sale") @Permissions("machine:mark_ready")
  ready(@Param("id") id: string) {
    return this.svc.markReadyForSale(id);
  }
}
