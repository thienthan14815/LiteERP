import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { QueryStockDto } from "./dto/query-stock.dto";
import { AdjustmentDto } from "./dto/adjustment.dto";
import { Permissions } from "../../common/decorators/permissions.decorator";

@Controller("inventory")
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get("stock-transactions")
  @Permissions("inventory:view")
  list(@Query() q: QueryStockDto) {
    return this.svc.listTransactions(q);
  }

  @Get("summary")
  @Permissions("inventory:view")
  summary() {
    return this.svc.summary();
  }

  @Get("value")
  @Permissions("inventory:view")
  value() {
    return this.svc.value();
  }

  @Post("adjustments")
  @Permissions("inventory:adjust")
  adjust(@Body() dto: AdjustmentDto) {
    return this.svc.adjust(dto);
  }
}
