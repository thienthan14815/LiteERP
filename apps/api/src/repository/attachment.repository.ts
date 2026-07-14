import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
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

  findByRelated(relatedTypes: string[], relatedId: string, db?: DrizzleDb): Promise<Attachment[]> {
    return this.withDb(db)
      .select()
      .from(attachments)
      .where(and(inArray(attachments.relatedType, relatedTypes), eq(attachments.relatedId, relatedId)))
      .orderBy(desc(attachments.createdAt));
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

  /**
   * Còn row KHÁC trỏ cùng file lưu trữ không? (ảnh phiếu mua được copy sang
   * máy dưới dạng row mới dùng chung driveFileId/fileUrl — chỉ xóa file vật
   * lý khi row cuối cùng bị xóa.)
   */
  async anotherRowSharesStorage(
    id: string,
    driveFileId: string | null,
    fileUrl: string,
    db?: DrizzleDb,
  ): Promise<boolean> {
    const cond = driveFileId
      ? eq(attachments.driveFileId, driveFileId)
      : eq(attachments.fileUrl, fileUrl);
    const rows = await this.withDb(db)
      .select({ id: attachments.id })
      .from(attachments)
      .where(and(cond, ne(attachments.id, id)))
      .limit(1);
    return rows.length > 0;
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
