import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateRoleDto {
  @IsOptional() @IsString() @MaxLength(128) name?: string;
  @IsOptional() @IsString() @MaxLength(512) description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes?: string[];
}
