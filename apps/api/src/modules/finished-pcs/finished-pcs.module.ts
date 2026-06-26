import { Module } from "@nestjs/common";
import { FinishedPcsService } from "./finished-pcs.service";
import { FinishedPcsController } from "./finished-pcs.controller";

@Module({
  providers: [FinishedPcsService],
  controllers: [FinishedPcsController],
})
export class FinishedPcsModule {}
