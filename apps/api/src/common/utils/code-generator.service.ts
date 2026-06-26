import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

type PrismaTxClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class CodeGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  // Use raw SQL with row-level lock to make the counter increment atomic even
  // across concurrent transactions (Prisma's nested writes don't provide
  // SELECT ... FOR UPDATE). The transaction must be supplied by the caller so
  // the counter increment is rolled back if the parent op fails.
  async next(prefix: string, tx: PrismaTxClient, pad = 6): Promise<string> {
    const client = tx as Prisma.TransactionClient;
    const key = prefix.toUpperCase();
    // Ensure row exists (upsert) — happens outside the lock loop.
    await client.codeCounter.upsert({
      where: { key },
      create: { key, last: 0 },
      update: {},
    });
    const rows = await client.$queryRaw<Array<{ last: number }>>(
      Prisma.sql`SELECT last FROM code_counters WHERE key = ${key} FOR UPDATE`,
    );
    const current = rows[0]?.last ?? 0;
    const next = current + 1;
    await client.codeCounter.update({
      where: { key },
      data: { last: next },
    });
    return `${prefix}${String(next).padStart(pad, "0")}`;
  }
}
