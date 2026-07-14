import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

// VN: Sửa metadata cơ bản. KHÔNG đổi status (dùng endpoint riêng: inspect,
// disassemble, mark-ready-for-sale). KHÔNG đổi machineComponents (dùng inspect).
export class UpdateMachineDto {
  @IsOptional() @IsString() @MaxLength(128) serial?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  // Machine.cost là giá mua vào (Decimal). Cho phép sửa nếu nhập sai lúc mua.
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) purchasePrice?: number;
}
