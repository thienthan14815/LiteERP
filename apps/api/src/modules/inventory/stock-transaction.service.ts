import { HttpStatus, Injectable } from "@nestjs/common";
import { ComponentStatus, Prisma, StockTxnType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { RequestContextService } from "../../common/context/request-context.service";
import { BusinessError } from "../../common/exceptions/business.exception";

type PrismaTxClient = Prisma.TransactionClient | PrismaService;

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
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContextService,
  ) {}

  async create(input: StockTxnInput, tx?: PrismaTxClient) {
    const client = (tx ?? this.prisma) as PrismaTxClient;
    const component = await (client as Prisma.TransactionClient).component.findUnique({
      where: { id: input.componentId },
    });
    if (!component) {
      throw new BusinessError(
        "COMPONENT_NOT_FOUND",
        `Component ${input.componentId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    const userId = this.ctx.getUserId();
    const txn = await (client as Prisma.TransactionClient).stockTransaction.create({
      data: {
        type: input.type,
        componentId: input.componentId,
        quantity: input.quantity ?? 1,
        reason: input.reason,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        notes: input.notes ?? null,
        createdById: userId ?? null,
      },
    });
    if (input.newComponentStatus && input.newComponentStatus !== component.status) {
      await (client as Prisma.TransactionClient).component.update({
        where: { id: input.componentId },
        data: { status: input.newComponentStatus },
      });
    }
    return txn;
  }

  // Convenience wrappers for Phase 2 status-only transitions.
  async reserve(componentId: string, refType: string, refId: string, tx: PrismaTxClient) {
    return this.create(
      {
        componentId,
        type: StockTxnType.ADJUSTMENT,
        reason: "Reserved for assembly",
        refType,
        refId,
        newComponentStatus: ComponentStatus.RESERVED,
      },
      tx,
    );
  }

  async releaseReservation(
    componentId: string,
    refType: string,
    refId: string,
    reason: string,
    tx: PrismaTxClient,
  ) {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;
    const component = await client.component.findUnique({ where: { id: componentId } });
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
      tx,
    );
  }

  /**
   * Atomically transition a component from `fromStatus` to `toStatus`, returning
   * true on success or false if the component is no longer in `fromStatus`.
   * Also appends a stock transaction row for audit.
   */
  async tryTransitionComponent(
    componentId: string,
    fromStatus: ComponentStatus,
    toStatus: ComponentStatus,
    txnInput: Omit<StockTxnInput, "componentId" | "newComponentStatus">,
    tx: PrismaTxClient,
  ): Promise<boolean> {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient;
    const updated = await client.component.updateMany({
      where: { id: componentId, status: fromStatus },
      data: { status: toStatus },
    });
    if (updated.count !== 1) {
      return false;
    }
    const userId = this.ctx.getUserId();
    await client.stockTransaction.create({
      data: {
        type: txnInput.type,
        componentId,
        quantity: txnInput.quantity ?? 1,
        reason: txnInput.reason,
        refType: txnInput.refType ?? null,
        refId: txnInput.refId ?? null,
        notes: txnInput.notes ?? null,
        createdById: userId ?? null,
      },
    });
    return true;
  }

  async reserveAtomic(
    componentId: string,
    refType: string,
    refId: string,
    tx: PrismaTxClient,
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
      tx,
    );
  }
}
