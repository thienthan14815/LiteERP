import { Injectable } from "@nestjs/common";
import { DbService, DrizzleDb } from "../database/db.service";

// VN: BaseRepository giữ layer Repository "sạch" — chỉ CRUD, KHÔNG business logic.
// Service Layer mở transaction qua DbService.transaction() và (tùy chọn) truyền
// handle drizzle xuống; việc route câu lệnh vào transaction đang mở là tự động
// (AsyncLocalStorage trong DbService), nên `db` param chỉ mang tính tài liệu.
// Không log, không validate, không kiểm tra permission.
@Injectable()
export abstract class BaseRepository {
  constructor(protected readonly dbs: DbService) {}

  /** Pick the caller-scoped handle when given; otherwise the shared one. */
  protected withDb(db?: DrizzleDb): DrizzleDb {
    return db ?? this.dbs.db;
  }
}
