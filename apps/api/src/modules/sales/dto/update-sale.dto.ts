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
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items?: CreateSaleItemDto[];
}
