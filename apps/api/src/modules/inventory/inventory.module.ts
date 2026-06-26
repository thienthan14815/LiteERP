import { Global, Module } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryController } from "./inventory.controller";
import { StockTransactionService } from "./stock-transaction.service";

@Global()
@Module({
  providers: [InventoryService, StockTransactionService],
  controllers: [InventoryController],
  exports: [StockTransactionService],
})
export class InventoryModule {}
