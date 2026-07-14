import { Global, Module } from "@nestjs/common";
import { DriveService } from "./drive.service";

// VN: Đánh dấu @Global vì DriveService là dependency chung cho Attachments,
// Backup, và tương lai (AI Agent). Không phát sinh controller — Drive là
// lớp internal, các module khác gọi qua Service Layer.
@Global()
@Module({
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}
