import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, ne } from "drizzle-orm";
import { MasterOptionType } from "@app/shared";
import { DbService } from "../../database/db.service";
import { masterOptions } from "../../database/schema";
import { createId } from "../../database/id";
import { AuditLogService } from "../audit-logs/audit-logs.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import {
  CreateMasterOptionDto,
  UpdateMasterOptionDto,
} from "./dto/master-option.dto";

@Injectable()
export class MasterOptionsService {
  constructor(
    private readonly dbs: DbService,
    private readonly audit: AuditLogService,
  ) {}

  async list(type?: MasterOptionType) {
    const where = type ? eq(masterOptions.type, type) : undefined;
    return this.dbs.db
      .select()
      .from(masterOptions)
      .where(where)
      .orderBy(asc(masterOptions.type), asc(masterOptions.name));
  }

  async create(dto: CreateMasterOptionDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BusinessError("MASTER_OPTION_NAME_REQUIRED", "Name is required", HttpStatus.BAD_REQUEST);
    }
    return this.dbs.transaction(async (db) => {
      const dupRows = await db
        .select()
        .from(masterOptions)
        .where(and(eq(masterOptions.type, dto.type), eq(masterOptions.name, name)))
        .limit(1);
      if (dupRows[0]) {
        throw new BusinessError(
          "MASTER_OPTION_DUPLICATE",
          `"${name}" đã tồn tại`,
          HttpStatus.CONFLICT,
        );
      }
      const inserted = await db
        .insert(masterOptions)
        .values({ id: createId(), type: dto.type, name, notes: dto.notes ?? null })
        .returning();
      const item = inserted[0];
      await this.audit.record(
        { action: "master_option.create", entityType: "MasterOption", entityId: item.id, after: item },
        db,
      );
      return item;
    });
  }

  async update(id: string, dto: UpdateMasterOptionDto) {
    const beforeRows = await this.dbs.db
      .select()
      .from(masterOptions)
      .where(eq(masterOptions.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "MASTER_OPTION_NOT_FOUND", message: "Not found" });
    const name = dto.name?.trim();
    if (name && name !== before.name) {
      const dupRows = await this.dbs.db
        .select()
        .from(masterOptions)
        .where(
          and(
            eq(masterOptions.type, before.type),
            eq(masterOptions.name, name),
            ne(masterOptions.id, id),
          ),
        )
        .limit(1);
      if (dupRows[0]) {
        throw new BusinessError(
          "MASTER_OPTION_DUPLICATE",
          `"${name}" đã tồn tại`,
          HttpStatus.CONFLICT,
        );
      }
    }
    return this.dbs.transaction(async (db) => {
      const updated = await db
        .update(masterOptions)
        .set({
          name: name ?? before.name,
          notes: dto.notes !== undefined ? dto.notes : before.notes,
          updatedAt: new Date(),
        })
        .where(eq(masterOptions.id, id))
        .returning();
      const item = updated[0];
      await this.audit.record(
        { action: "master_option.update", entityType: "MasterOption", entityId: id, before, after: item },
        db,
      );
      return item;
    });
  }

  async remove(id: string) {
    const beforeRows = await this.dbs.db
      .select()
      .from(masterOptions)
      .where(eq(masterOptions.id, id))
      .limit(1);
    const before = beforeRows[0];
    if (!before) throw new NotFoundException({ code: "MASTER_OPTION_NOT_FOUND", message: "Not found" });
    await this.dbs.transaction(async (db) => {
      await db.delete(masterOptions).where(eq(masterOptions.id, id));
      await this.audit.record(
        { action: "master_option.delete", entityType: "MasterOption", entityId: id, before },
        db,
      );
    });
    return { success: true };
  }
}
