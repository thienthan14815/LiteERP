-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "drive_file_id" TEXT;

-- CreateIndex
CREATE INDEX "attachments_drive_file_id_idx" ON "attachments"("drive_file_id");
