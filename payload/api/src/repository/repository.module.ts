import { Global, Module } from "@nestjs/common";
import { AttachmentRepository } from "./attachment.repository";
import { BackupRepository } from "./backup.repository";

// VN: RepositoryModule tập trung mọi repository. Đánh dấu @Global để Service
// Layer có thể inject trực tiếp mà không phải import lại. Repository mới thêm
// vào providers + exports là dùng được ngay.
@Global()
@Module({
  providers: [AttachmentRepository, BackupRepository],
  exports: [AttachmentRepository, BackupRepository],
})
export class RepositoryModule {}
