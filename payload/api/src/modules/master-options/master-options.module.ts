import { Module } from "@nestjs/common";
import { MasterOptionsService } from "./master-options.service";
import { MasterOptionsController } from "./master-options.controller";

@Module({
  providers: [MasterOptionsService],
  controllers: [MasterOptionsController],
})
export class MasterOptionsModule {}
