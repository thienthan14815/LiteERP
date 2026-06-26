import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export enum AssemblyRole {
  CPU = "CPU",
  MB = "MB",
  RAM = "RAM",
  SSD = "SSD",
  HDD = "HDD",
  GPU = "GPU",
  PSU = "PSU",
  CASE = "CASE",
  FAN = "FAN",
  OTHER = "OTHER",
}

export class CreateAssemblyItemDto {
  @IsString()
  componentId!: string;

  @IsEnum(AssemblyRole)
  role!: AssemblyRole;
}

export class CreateAssemblyDto {
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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAssemblyItemDto)
  items!: CreateAssemblyItemDto[];
}
