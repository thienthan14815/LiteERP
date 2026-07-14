import { IsOptional, IsString, IsISO8601 } from "class-validator";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryAuditLogsDto extends PaginationDto {
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsISO8601() fromDate?: string;
  @IsOptional() @IsISO8601() toDate?: string;
}
