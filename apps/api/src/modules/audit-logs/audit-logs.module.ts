import { Global, Module } from "@nestjs/common";
import { AuditLogService } from "./audit-logs.service";
import { AuditLogsController } from "./audit-logs.controller";

@Global()
@Module({
  providers: [AuditLogService],
  controllers: [AuditLogsController],
  exports: [AuditLogService],
})
export class AuditLogsModule {}
