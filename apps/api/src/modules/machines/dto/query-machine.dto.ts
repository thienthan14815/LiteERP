import { IsEnum, IsOptional, IsString } from "class-validator";
import { MachineStatus } from "@prisma/client";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryMachineDto extends PaginationDto {
  @IsOptional() @IsEnum(MachineStatus) status?: MachineStatus;
  @IsOptional() @IsString() serial?: string;
}
