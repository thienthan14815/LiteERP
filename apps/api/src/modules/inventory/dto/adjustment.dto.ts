import { IsEnum, IsOptional, IsString } from "class-validator";
import { ComponentStatus, StockTxnType } from "@prisma/client";

export class AdjustmentDto {
  @IsString()
  componentId!: string;

  @IsEnum(StockTxnType)
  type!: StockTxnType;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsEnum(ComponentStatus)
  newStatus?: ComponentStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
