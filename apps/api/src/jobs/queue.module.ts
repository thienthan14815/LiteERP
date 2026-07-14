import { Global, Module } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { NotificationsQueueService } from "./queues/notifications.queue";
import { ReportsQueueService } from "./queues/reports.queue";
import { ExportsQueueService } from "./queues/exports.queue";
import { MaintenanceQueueService } from "./queues/maintenance.queue";
import { ImagesQueueService } from "./queues/images.queue";

const providers = [
  JobsService,
  NotificationsQueueService,
  ReportsQueueService,
  ExportsQueueService,
  MaintenanceQueueService,
  ImagesQueueService,
];

@Global()
@Module({
  providers,
  exports: providers,
})
export class QueueModule {}
