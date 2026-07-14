import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DbService, DrizzleDb } from "../database/db.service";
import { attachments, type Attachment } from "../database/schema";
import { createId } from "../database/id";
import { BaseRepository } from "./base.repository";

export type NewAttachment = Omit<typeof attachments.$inferInsert, "id" | "createdAt"> & {
  id?: string;
};

// VN: AttachmentRepository — CHỈ CRUD. Không business logic. Không permission.
// Không audit log. Không transform. Không throw NotFound. Trả thẳng row DB.
// Service Layer (AttachmentsService) chịu trách nhiệm mọi thứ khác.
@Injectable()
export class AttachmentRepository extends BaseRepository {
  constructor(dbs: DbService) {
    super(dbs);
  }

  async findById(id: string, db?: DrizzleDb): Promise<Attachment | null> {
    const rows = await this.withDb(db).select().from(attachments).where(eq(attachments.id, id)).limit(1);
    return rows[0] ?? null;
  }

  findByEntity(entityType: string, entityId: string, db?: DrizzleDb): Promise<Attachment[]> {
    return this.withDb(db)
      .select()
      .from(attachments)
      .where(and(eq(attachments.relatedType, entityType), eq(attachments.relatedId, entityId)))
      .orderBy(desc(attachments.createdAt));
  }

  async create(data: NewAttachment, db?: DrizzleDb): Promise<Attachment> {
    const rows = await this.withDb(db)
      .insert(attachments)
      .values({ ...data, id: data.id ?? createId() })
      .returning();
    return rows[0];
  }

  async updateThumbnailUrl(id: string, thumbnailUrl: string, db?: DrizzleDb): Promise<Attachment | null> {
    // VN: fileUrl cột duy nhất hiện có để lưu URL — cột thumbnail sẽ derive từ
    // driveFileId ở Service; method này giữ để tương lai lưu cache nếu cần.
    const rows = await this.withDb(db)
      .update(attachments)
      .set({ fileUrl: thumbnailUrl })
      .where(eq(attachments.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async deleteById(id: string, db?: DrizzleDb): Promise<void> {
    await this.withDb(db).delete(attachments).where(eq(attachments.id, id));
  }

  async update(
    id: string,
    data: Partial<typeof attachments.$inferInsert>,
    db?: DrizzleDb,
  ): Promise<Attachment | null> {
    const rows = await this.withDb(db)
      .update(attachments)
      .set(data)
      .where(eq(attachments.id, id))
      .returning();
    return rows[0] ?? null;
  }
}
