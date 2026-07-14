import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { CreateSaleItemDto } from "./create-sale.dto";

export class UpdateSaleDto {
  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsString()
  orderName?: string;

  @IsOptional() @IsString()
  sellerName?: string;

  @IsOptional() @IsString()
  platform?: string;

  @IsOptional() @IsString()
  salesUrl?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items?: CreateSaleItemDto[];
}
