import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

// VN: DTO phân bổ giá vốn theo CATEGORY. Nếu 1 category có nhiều
// MachineComponent (vd 2 thanh RAM), cost được chia đều cho từng linh kiện
// trong Service Layer. UI không cần biết MachineComponent.id — chọn theo loại.
export class CostAllocationItemDto {
  @IsString() categoryCode!: string;
  @IsNumber() @Min(0) cost!: number;
  @IsOptional() @IsString() label?: string;
}

export class AllocateCostDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CostAllocationItemDto)
  items!: CostAllocationItemDto[];
}
