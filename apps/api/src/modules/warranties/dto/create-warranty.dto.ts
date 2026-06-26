import { IsISO8601, IsOptional, IsString, MinLength } from "class-validator";

export class CreateWarrantyDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() salesOrderId?: string;
  @IsOptional() @IsString() finishedPcId?: string;
  @IsOptional() @IsString() componentId?: string;
  @IsString() @MinLength(3) issue!: string;
  @IsOptional() @IsISO8601() receivedAt?: string;
  @IsOptional() @IsString() notes?: string;
}
