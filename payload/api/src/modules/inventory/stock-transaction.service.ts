import { HttpStatus, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { ComponentStatus, StockTxnType } from "@app/shared";
import { DbService, DrizzleDb } from "../../database/db.service";
import { components, stockTransactions } from "../../database/schema";
import { createId } from "../../database/id";
import { RequestContextService } from "../../common/context/request-context.service";
import { BusinessError } from "../../common/exceptions/business.exception";

export interface StockTxnInput {
  componentId: string;
  type: StockTxnType;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  notes?: string | null;
  // If set, the Component's status is updated to this enum value alongside the
  // stock transaction. Only this service is allowed to mutate Component.status.
  newComponentStatus?: ComponentStatus;
  quantity?: number;
}

@Injectable()
export class StockTransactionService {
  constructor(
    private readonly dbs: DbService,
    private readonly ctx: RequestContextService,
  ) {}

  async create(input: StockTxnInput, db?: DrizzleDb) {
    const client = db ?? this.dbs.db;
    const componentRows = await client
      .select()
      .from(components)
      .where(eq(components.id, input.componentId))
      .limit(1);
    const component = componentRows[0];
    if (!component) {
      throw new BusinessError(
        "COMPONENT_NOT_FOUND",
        `Component ${input.componentId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    const userId = this.ctx.getUserId();
    const txnRows = await client
      .insert(stockTransactions)
      .values({
        id: createId(),
        type: input.type,
        componentId: input.componentId,
        quantity: input.quantity ?? 1,
        reason: input.reason,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        notes: input.notes ?? null,
        createdById: userId ?? null,
      })
      .returning();
    const txn = txnRows[0];
    if (input.newComponentStatus && input.newComponentStatus !== component.status) {
      await client
        .update(components)
        .set({ status: input.newComponentStatus, updatedAt: new Date() })
        .where(eq(components.id, input.componentId));
    }
    return txn;
  }

  // Convenience wrappers for Phase 2 status-only transitions.
  async reserve(componentId: string, refType: string, refId: string, db: DrizzleDb) {
    return this.create(
      {
        componentId,
        type: StockTxnType.ADJUSTMENT,
        reason: "Reserved for assembly",
        refType,
        refId,
        newComponentStatus: ComponentStatus.RESERVED,
      },
      db,
    );
  }

  async releaseReservation(
    componentId: string,
    refType: string,
    refId: string,
    reason: string,
    db: DrizzleDb,
  ) {
    const client = db ?? this.dbs.db;
    const componentRows = await client
      .select()
      .from(components)
      .where(eq(components.id, componentId))
      .limit(1);
    const component = componentRows[0];
    if (!component || component.status !== ComponentStatus.RESERVED) {
      return null;
    }
    return this.create(
      {
        componentId,
        type: StockTxnType.ADJUSTMENT,
        reason,
        refType,
        refId,
        newComponentStatus: ComponentStatus.IN_STOCK,
      },
      db,
    );
  }

  /**
   * Atomically transition a component from `fromStatus` to `toStatus`, returning
   * true on success or false if the component is no longer in `fromStatus`.
   * Also appends a stock transaction row for audit.
   */
  async tryTransitionComponent(
    componentId: string,
    fromStatus: ComponentStatus | string,
    toStatus: ComponentStatus,
    txnInput: Omit<StockTxnInput, "componentId" | "newComponentStatus">,
    db: DrizzleDb,
  ): Promise<boolean> {
    const client = db ?? this.dbs.db;
    const updated = await client
      .update(components)
      .set({ status: toStatus, updatedAt: new Date() })
      .where(and(eq(components.id, componentId), eq(components.status, fromStatus)))
      .returning({ id: components.id });
    if (updated.length !== 1) {
      return false;
    }
    const userId = this.ctx.getUserId();
    await client.insert(stockTransactions).values({
      id: createId(),
      type: txnInput.type,
      componentId,
      quantity: txnInput.quantity ?? 1,
      reason: txnInput.reason,
      refType: txnInput.refType ?? null,
      refId: txnInput.refId ?? null,
      notes: txnInput.notes ?? null,
      createdById: userId ?? null,
    });
    return true;
  }

  async reserveAtomic(
    componentId: string,
    refType: string,
    refId: string,
    db: DrizzleDb,
  ): Promise<boolean> {
    return this.tryTransitionComponent(
      componentId,
      ComponentStatus.IN_STOCK,
      ComponentStatus.RESERVED,
      {
        type: StockTxnType.ADJUSTMENT,
        reason: "Reserved for assembly",
        refType,
        refId,
      },
      db,
    );
  }
}
