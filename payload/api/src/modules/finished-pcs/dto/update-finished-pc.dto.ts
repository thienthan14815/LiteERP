import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateFinishedPcDto {
  @IsOptional() @IsNumber() @Min(0)
  suggestedPrice?: number;

  @IsOptional() @IsString()
  notes?: string;
}
