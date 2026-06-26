import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ComponentCondition } from "@prisma/client";

export class InspectComponentDto {
  @IsString()
  categoryCode!: string;

  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() serial?: string;

  @IsEnum(ComponentCondition)
  condition!: ComponentCondition;

  @IsOptional() @IsString() notes?: string;
}

export class InspectMachineDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InspectComponentDto)
  components!: InspectComponentDto[];

  @IsOptional() @IsString() notes?: string;
}
