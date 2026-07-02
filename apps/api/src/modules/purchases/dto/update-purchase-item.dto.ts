import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from "class-validator";
import { PurchaseItemType } from "@prisma/client";

export class UpdatePurchaseItemDto {
  @IsOptional() @IsEnum(PurchaseItemType)
  itemType?: PurchaseItemType;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  model?: string;

  @IsOptional() @IsString()
  serial?: string;

  @IsOptional() @IsInt() @IsPositive()
  quantity?: number;

  @IsOptional() @IsNumber() @Min(0)
  unitPrice?: number;

  @IsOptional() @IsString()
  categoryCode?: string;

  @IsOptional() @IsString()
  notes?: string;
}
