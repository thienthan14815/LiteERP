import { IsOptional, IsString, IsEnum, IsISO8601 } from "class-validator";
import { StockTxnType } from "@prisma/client";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryStockDto extends PaginationDto {
  @IsOptional() @IsEnum(StockTxnType) type?: StockTxnType;
  @IsOptional() @IsString() componentId?: string;
  @IsOptional() @IsString() refType?: string;
  @IsOptional() @IsString() refId?: string;
  @IsOptional() @IsISO8601() fromDate?: string;
  @IsOptional() @IsISO8601() toDate?: string;
}
