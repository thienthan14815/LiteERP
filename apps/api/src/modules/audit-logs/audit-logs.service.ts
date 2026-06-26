import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { RequestContextService } from "../../common/context/request-context.service";

export interface AuditRecordInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

type PrismaTxClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContextService,
  ) {}

  async record(input: AuditRecordInput, tx?: PrismaTxClient): Promise<void> {
    const client: PrismaTxClient = tx ?? this.prisma;
    const stored = this.ctx.get();
    await client.auditLog.create({
      data: {
        actorUserId: input.actorId ?? stored?.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeJson:
          input.before === undefined
            ? Prisma.DbNull
            : (input.before as Prisma.InputJsonValue),
        afterJson:
          input.after === undefined ? Prisma.DbNull : (input.after as Prisma.InputJsonValue),
        ip: input.ip ?? stored?.ip ?? null,
        userAgent: input.userAgent ?? stored?.userAgent ?? null,
      },
    });
  }
}
