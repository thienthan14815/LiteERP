import { Injectable } from "@nestjs/common";
import { BackupKind, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { BaseRepository, PrismaTxClient } from "./base.repository";

// VN: BackupRepository — CHỈ CRUD. Không classify, không delete Drive.
// Service Layer (BackupService) chịu trách nhiệm phân loại GFS + gọi DriveService.
@Injectable()
export class BackupRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  create(data: Prisma.BackupRecordUncheckedCreateInput, tx?: PrismaTxClient) {
    return this.withTx(tx).backupRecord.create({ data });
  }

  findAllOrderedNewestFirst(tx?: PrismaTxClient) {
    return this.withTx(tx).backupRecord.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string, tx?: PrismaTxClient) {
    return this.withTx(tx).backupRecord.findUnique({ where: { id } });
  }

  updateKind(id: string, kind: BackupKind, tx?: PrismaTxClient) {
    return this.withTx(tx).backupRecord.update({
      where: { id },
      data: { kind },
    });
  }

  deleteByIds(ids: string[], tx?: PrismaTxClient) {
    if (ids.length === 0) return { count: 0 };
    return this.withTx(tx).backupRecord.deleteMany({
      where: { id: { in: ids } },
    });
  }

  deleteById(id: string, tx?: PrismaTxClient) {
    return this.withTx(tx).backupRecord.delete({ where: { id } });
  }
}
