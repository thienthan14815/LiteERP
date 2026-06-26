import { IsEnum, IsOptional, IsString } from "class-validator";
import { WarrantyStatus } from "@prisma/client";

export class TransitionWarrantyDto {
  @IsEnum(WarrantyStatus) to!: WarrantyStatus;
  @IsOptional() @IsString() notes?: string;
}

export const WARRANTY_TRANSITIONS: Record<WarrantyStatus, WarrantyStatus[]> = {
  RECEIVED: [WarrantyStatus.INSPECTING],
  INSPECTING: [WarrantyStatus.REPAIRING, WarrantyStatus.REPLACED, WarrantyStatus.REJECTED],
  REPAIRING: [WarrantyStatus.REPLACED, WarrantyStatus.COMPLETED, WarrantyStatus.REJECTED],
  REPLACED: [WarrantyStatus.COMPLETED],
  COMPLETED: [],
  REJECTED: [],
};

export const TERMINAL_STATUSES: WarrantyStatus[] = [
  WarrantyStatus.COMPLETED,
  WarrantyStatus.REJECTED,
];
