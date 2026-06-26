import { IsEnum, IsOptional, IsString } from "class-validator";
import { ComponentCondition, ComponentStatus } from "@prisma/client";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryComponentDto extends PaginationDto {
  @IsOptional() @IsEnum(ComponentStatus) status?: ComponentStatus;
  @IsOptional() @IsEnum(ComponentCondition) condition?: ComponentCondition;
  @IsOptional() @IsString() categoryCode?: string;
  @IsOptional() @IsString() categoryId?: string;
}
