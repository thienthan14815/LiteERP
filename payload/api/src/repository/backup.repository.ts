import { Injectable } from "@nestjs/common";
import { desc, eq, inArray } from "drizzle-orm";
import { BackupKind } from "@app/shared";
import { DbService, DrizzleDb } from "../database/db.service";
import { backupRecords, type BackupRecord } from "../database/schema";
import { createId } from "../database/id";
import { BaseRepository } from "./base.repository";

export type NewBackupRecord = Omit<typeof backupRecords.$inferInsert, "id" | "createdAt"> & {
  id?: string;
};

// VN: BackupRepository — CHỈ CRUD. Không classify, không delete Drive.
// Service Layer (BackupService) chịu trách nhiệm phân loại GFS + gọi DriveService.
@Injectable()
export class BackupRepository extends BaseRepository {
  constructor(dbs: DbService) {
    super(dbs);
  }

  async create(data: NewBackupRecord, db?: DrizzleDb): Promise<BackupRecord> {
    const rows = await this.withDb(db)
      .insert(backupRecords)
      .values({ ...data, id: data.id ?? createId() })
      .returning();
    return rows[0];
  }

  findAllOrderedNewestFirst(db?: DrizzleDb): Promise<BackupRecord[]> {
    return this.withDb(db).select().from(backupRecords).orderBy(desc(backupRecords.createdAt));
  }

  async findById(id: string, db?: DrizzleDb): Promise<BackupRecord | null> {
    const rows = await this.withDb(db)
      .select()
      .from(backupRecords)
      .where(eq(backupRecords.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async updateKind(id: string, kind: BackupKind, db?: DrizzleDb): Promise<BackupRecord | null> {
    const rows = await this.withDb(db)
      .update(backupRecords)
      .set({ kind })
      .where(eq(backupRecords.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async deleteByIds(ids: string[], db?: DrizzleDb): Promise<{ count: number }> {
    if (ids.length === 0) return { count: 0 };
    const rows = await this.withDb(db)
      .delete(backupRecords)
      .where(inArray(backupRecords.id, ids))
      .returning({ id: backupRecords.id });
    return { count: rows.length };
  }

  async deleteById(id: string, db?: DrizzleDb): Promise<void> {
    await this.withDb(db).delete(backupRecords).where(eq(backupRecords.id, id));
  }
}
