import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ComponentCondition } from "@app/shared";

export class UpdateComponentDto {
  @IsOptional() @IsEnum(ComponentCondition) condition?: ComponentCondition;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() @Min(0) costPrice?: number;
}
