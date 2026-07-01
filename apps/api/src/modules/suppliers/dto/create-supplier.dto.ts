import { IsEnum, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { SupplierCategory } from "@prisma/client";

export class CreateSupplierDto {
  @IsOptional() @IsString() @MaxLength(32) code?: string;

  @IsString() @MaxLength(255) name!: string;

  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(512) fbUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(512) marketplaceUrl?: string;

  @IsOptional() @IsEnum(SupplierCategory) category?: SupplierCategory;

  @IsOptional() @IsString() notes?: string;
}
