import { IsEnum, IsOptional, IsString } from "class-validator";
import { WarrantyStatus } from "@app/shared";

export class TransitionWarrantyDto {
  @IsEnum(WarrantyStatus) to!: WarrantyStatus;
  @IsOptional() @IsString() notes?: string;
}

// SQLite stores status as string, so index by string to avoid narrowing pain.
export const WARRANTY_TRANSITIONS: Record<string, WarrantyStatus[]> = {
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
