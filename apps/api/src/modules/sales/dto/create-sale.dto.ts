import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { SalesItemType } from "@prisma/client";

export class CreateSaleItemDto {
  @IsEnum(SalesItemType)
  itemType!: SalesItemType;

  @IsOptional() @IsString()
  finishedPcId?: string;

  @IsOptional() @IsString()
  componentId?: string;

  @IsNumber() @Min(0)
  unitPrice!: number;

  @IsOptional() @IsInt() @Min(1)
  qty?: number;
}

export class CreateSaleDto {
  @IsString()
  customerId!: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}
