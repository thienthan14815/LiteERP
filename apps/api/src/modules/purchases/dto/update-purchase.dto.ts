import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdatePurchaseDto {
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() @Min(0) otherCost?: number;
}
