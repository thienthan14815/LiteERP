import { IsEnum, IsISO8601, IsOptional, IsString } from "class-validator";
import { WarrantyStatus } from "@prisma/client";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryWarrantyDto extends PaginationDto {
  @IsOptional() @IsEnum(WarrantyStatus) status?: WarrantyStatus;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsISO8601() fromDate?: string;
  @IsOptional() @IsISO8601() toDate?: string;
}
