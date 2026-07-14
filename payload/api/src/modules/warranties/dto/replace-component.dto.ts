import { IsOptional, IsString } from "class-validator";

export class ReplaceComponentDto {
  @IsString() removedComponentId!: string;
  @IsString() replacementComponentId!: string;
  @IsOptional() @IsString() notes?: string;
}
