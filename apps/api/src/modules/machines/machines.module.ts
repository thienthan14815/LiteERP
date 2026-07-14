import { Module } from "@nestjs/common";
import { MachinesService } from "./machines.service";
import { MachinesController } from "./machines.controller";
import { AttachmentsModule } from "../attachments/attachments.module";

@Module({
  imports: [AttachmentsModule],
  providers: [MachinesService],
  controllers: [MachinesController],
})
export class MachinesModule {}
