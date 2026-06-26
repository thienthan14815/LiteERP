import { IsEnum, IsISO8601, IsOptional, IsString } from "class-validator";
import { SalesOrderStatus } from "@prisma/client";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QuerySaleDto extends PaginationDto {
  @IsOptional() @IsEnum(SalesOrderStatus) status?: SalesOrderStatus;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsISO8601() fromDate?: string;
  @IsOptional() @IsISO8601() toDate?: string;
}
