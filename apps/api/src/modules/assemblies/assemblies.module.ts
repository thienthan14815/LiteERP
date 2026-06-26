import { Module } from "@nestjs/common";
import { AssembliesService } from "./assemblies.service";
import { AssembliesController } from "./assemblies.controller";

@Module({
  providers: [AssembliesService],
  controllers: [AssembliesController],
})
export class AssembliesModule {}
