import { IsEnum, IsOptional, IsString } from "class-validator";
import { MachineStatus } from "@app/shared";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryMachineDto extends PaginationDto {
  @IsOptional() @IsEnum(MachineStatus) status?: MachineStatus;
  @IsOptional() @IsString() serial?: string;
}
