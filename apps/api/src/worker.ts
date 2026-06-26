import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { startNotificationsWorker } from "./jobs/queues/notifications.queue";
import { startReportsWorker } from "./jobs/queues/reports.queue";
import { startExportsWorker } from "./jobs/queues/exports.queue";
import { startMaintenanceWorker } from "./jobs/queues/maintenance.queue";
import { startImagesWorker } from "./jobs/queues/images.queue";

async function bootstrap() {
  const logger = new Logger("Worker");
  const workers = [
    startNotificationsWorker(),
    startReportsWorker(),
    startExportsWorker(),
    startMaintenanceWorker(),
    startImagesWorker(),
  ];
  logger.log(`Started ${workers.length} BullMQ workers`);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, draining workers...`);
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await new Promise(() => {});
}

bootstrap();
