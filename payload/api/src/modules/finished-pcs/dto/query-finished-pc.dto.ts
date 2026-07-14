import { IsEnum, IsOptional } from "class-validator";
import { FinishedPcStatus } from "@app/shared";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryFinishedPcDto extends PaginationDto {
  @IsOptional() @IsEnum(FinishedPcStatus) status?: FinishedPcStatus;
}
