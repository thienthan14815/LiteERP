import { IsEnum, IsOptional, IsString } from "class-validator";
import { ComponentCondition } from "@prisma/client";

export class UpdateComponentDto {
  @IsOptional() @IsEnum(ComponentCondition) condition?: ComponentCondition;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() notes?: string;
}
