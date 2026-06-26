import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateSupplierDto {
  @IsOptional() @IsString() @MaxLength(32) code?: string;

  @IsString() @MaxLength(255) name!: string;

  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(512) address?: string;
  @IsOptional() @IsString() @MaxLength(64) taxCode?: string;
  @IsOptional() @IsString() notes?: string;
}
