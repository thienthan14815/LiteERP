import { IsEnum, IsISO8601, IsOptional, IsString } from "class-validator";
import { PurchaseOrderStatus } from "@app/shared";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryPurchaseDto extends PaginationDto {
  @IsOptional() @IsEnum(PurchaseOrderStatus) status?: PurchaseOrderStatus;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsISO8601() fromDate?: string;
  @IsOptional() @IsISO8601() toDate?: string;
}
