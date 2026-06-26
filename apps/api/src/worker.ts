import "reflect-metadata";
import { Logger } from "@nestjs/common";

// BullMQ worker entrypoint. Phase 0 placeholder — Phase 1+ registers actual
// processors (send-email, generate-report, export-excel, backup-database,
// generate-qr-code, process-image, low-stock-alert — see ARCHITECTURE.md
// section 15).
async function bootstrap() {
  const logger = new Logger("Worker");
  logger.log("Worker starting (no processors registered yet)...");

  // Keep the process alive.
  await new Promise(() => {});
}

bootstrap();
