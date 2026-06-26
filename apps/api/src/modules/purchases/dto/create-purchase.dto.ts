import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { PurchaseItemType } from "@prisma/client";

export class CreatePurchaseItemDto {
  @IsEnum(PurchaseItemType)
  itemType!: PurchaseItemType;

  @IsString()
  description!: string;

  @IsInt() @IsPositive()
  quantity!: number;

  @IsNumber() @Min(0)
  unitPrice!: number;

  // Required for COMPONENT items — the category to assign to each created
  // Component (so we can pick the right code prefix).
  @IsOptional() @IsString()
  categoryCode?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class CreatePurchaseDto {
  @IsOptional() @IsString()
  supplierId?: string;

  @IsOptional() @IsNumber() @Min(0)
  otherCost?: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}
