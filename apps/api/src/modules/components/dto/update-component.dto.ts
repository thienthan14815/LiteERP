import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ComponentCondition } from "@prisma/client";

export class UpdateComponentDto {
  @IsOptional() @IsEnum(ComponentCondition) condition?: ComponentCondition;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @IsString() notes?: string;
}
