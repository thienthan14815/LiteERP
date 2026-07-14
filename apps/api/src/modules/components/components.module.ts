import { Module } from "@nestjs/common";
import { ComponentsService } from "./components.service";
import { ComponentsController } from "./components.controller";
import { AttachmentsModule } from "../attachments/attachments.module";

@Module({
  imports: [AttachmentsModule],
  providers: [ComponentsService],
  controllers: [ComponentsController],
})
export class ComponentsModule {}
