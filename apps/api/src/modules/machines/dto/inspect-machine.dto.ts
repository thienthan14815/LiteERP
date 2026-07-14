import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { ComponentCondition } from "@app/shared";

export class InspectComponentDto {
  @IsString()
  categoryCode!: string;

  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() serial?: string;

  @IsEnum(ComponentCondition)
  condition!: ComponentCondition;

  // Số lượng linh kiện giống hệt nhau trên 1 dòng (mặc định 1). Serial (nếu
  // nhập) được ghi chung cho cả lô như thông tin tham khảo.
  @IsOptional() @IsInt() @Min(1) quantity?: number;

  // Giá vốn ban đầu cho MỖI linh kiện (đơn giá, không phải tổng của dòng).
  // Định giá ngay tại bước kiểm tra — không còn bước "phân bổ giá vốn" riêng.
  @IsOptional() @IsNumber() @Min(0) cost?: number;

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
