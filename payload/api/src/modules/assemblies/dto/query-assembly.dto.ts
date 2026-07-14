import { IsEnum, IsISO8601, IsOptional } from "class-validator";
import { AssemblyStatus } from "@app/shared";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryAssemblyDto extends PaginationDto {
  @IsOptional() @IsEnum(AssemblyStatus) status?: AssemblyStatus;
  @IsOptional() @IsISO8601() fromDate?: string;
  @IsOptional() @IsISO8601() toDate?: string;
}
