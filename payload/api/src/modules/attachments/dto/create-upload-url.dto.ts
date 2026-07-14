import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateUploadUrlDto {
  @IsString() @MaxLength(255) fileName!: string;
  @IsString() @MaxLength(255) mimeType!: string;
  @IsString() @MaxLength(64) relatedType!: string;
  @IsString() @MaxLength(64) relatedId!: string;
  @IsOptional() @IsString() @MaxLength(64) fileType?: string;
}

export class ConfirmUploadDto {
  @Type(() => Number) @IsInt() @Min(0) size!: number;
}

export class QueryAttachmentsDto {
  @IsString() relatedType!: string;
  @IsString() relatedId!: string;
}
