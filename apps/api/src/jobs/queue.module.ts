import { Global, Module } from "@nestjs/common";

// Placeholder for BullMQ queue setup. Real queue providers will be registered
// in later phases (send-email, generate-report, export-excel, backup-database,
// generate-qr-code, process-image, low-stock-alert — see ARCHITECTURE.md
// section 15).
@Global()
@Module({
  providers: [],
  exports: [],
})
export class QueueModule {}
