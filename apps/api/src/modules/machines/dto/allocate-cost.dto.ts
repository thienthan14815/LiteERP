import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class CostAllocationEntryDto {
  @IsString() machineComponentId!: string;
  @IsNumber() @Min(0) costPrice!: number;
}

export class AllocateCostDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CostAllocationEntryDto)
  allocations!: CostAllocationEntryDto[];
}
