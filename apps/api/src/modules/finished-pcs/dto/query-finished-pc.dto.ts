import { IsEnum, IsOptional } from "class-validator";
import { FinishedPcStatus } from "@prisma/client";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryFinishedPcDto extends PaginationDto {
  @IsOptional() @IsEnum(FinishedPcStatus) status?: FinishedPcStatus;
}
