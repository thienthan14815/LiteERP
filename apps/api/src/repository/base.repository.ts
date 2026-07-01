import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

// VN: BaseRepository giữ layer Repository "sạch" — chỉ CRUD, KHÔNG business logic.
// Service Layer sẽ mở transaction và truyền `tx` (Prisma.TransactionClient) xuống
// qua tham số của từng phương thức. Repository chỉ chọn client (prisma vs tx) và
// gọi thẳng Prisma. Không log, không validate, không kiểm tra permission.
export type PrismaTxClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * withTx picks the transactional client passed by Service; falls back to the
   * shared PrismaService when no transaction is active. Repository methods must
   * ALWAYS route their queries through this helper — never touch `this.prisma`
   * directly.
   */
  protected withTx(tx?: PrismaTxClient): PrismaTxClient {
    return tx ?? this.prisma;
  }
}
