import { Injectable } from "@nestjs/common";
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
      throw new BusinessError("COMPONENT_NOT_FOUND", `Component ${input.componentId} not found`, 404 as any);
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
}
