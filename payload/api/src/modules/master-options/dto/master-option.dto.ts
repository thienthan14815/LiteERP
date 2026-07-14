import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { MasterOptionType } from "@app/shared";

export class CreateMasterOptionDto {
  @IsEnum(MasterOptionType)
  type!: MasterOptionType;

  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class UpdateMasterOptionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class QueryMasterOptionDto {
  @IsOptional() @IsEnum(MasterOptionType)
  type?: MasterOptionType;
}
