import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { BaseRepository, PrismaTxClient } from "./base.repository";

// VN: AttachmentRepository — CHỈ CRUD. Không business logic. Không permission.
// Không audit log. Không transform. Không throw NotFound. Trả thẳng dữ liệu Prisma.
// Service Layer (AttachmentsService) chịu trách nhiệm mọi thứ khác.
@Injectable()
export class AttachmentRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string, tx?: PrismaTxClient) {
    return this.withTx(tx).attachment.findUnique({ where: { id } });
  }

  findByEntity(entityType: string, entityId: string, tx?: PrismaTxClient) {
    return this.withTx(tx).attachment.findMany({
      where: { relatedType: entityType, relatedId: entityId },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: Prisma.AttachmentUncheckedCreateInput, tx?: PrismaTxClient) {
    return this.withTx(tx).attachment.create({ data });
  }

  updateThumbnailUrl(id: string, thumbnailUrl: string, tx?: PrismaTxClient) {
    // VN: fileUrl cột duy nhất hiện có để lưu URL — cột thumbnail sẽ derive từ
    // driveFileId ở Service; method này giữ để tương lai lưu cache nếu cần.
    return this.withTx(tx).attachment.update({
      where: { id },
      data: { fileUrl: thumbnailUrl },
    });
  }

  deleteById(id: string, tx?: PrismaTxClient) {
    return this.withTx(tx).attachment.delete({ where: { id } });
  }

  update(id: string, data: Prisma.AttachmentUpdateInput, tx?: PrismaTxClient) {
    return this.withTx(tx).attachment.update({ where: { id }, data });
  }
}
