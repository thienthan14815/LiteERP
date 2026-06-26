import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { CreateAssemblyItemDto } from "./create-assembly.dto";

export class UpdateAssemblyDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsNumber() @Min(0)
  repairCost?: number;

  @IsOptional() @IsNumber() @Min(0)
  cleaningCost?: number;

  @IsOptional() @IsNumber() @Min(0)
  assemblyCost?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAssemblyItemDto)
  items?: CreateAssemblyItemDto[];
}
