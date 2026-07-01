import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { BackupService } from "./backup.service";
import { BackupController } from "./backup.controller";
import { BackupScheduler } from "./backup.scheduler";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [BackupService, BackupScheduler],
  controllers: [BackupController],
  exports: [BackupService],
})
export class BackupModule {}
