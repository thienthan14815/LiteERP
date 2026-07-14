import { IsEnum } from "class-validator";
import { FinishedPcStatus } from "@app/shared";

export enum TransitionTarget {
  TESTING = "TESTING",
  READY_FOR_SALE = "READY_FOR_SALE",
}

export class TransitionFinishedPcDto {
  @IsEnum(TransitionTarget)
  to!: TransitionTarget;
}

// SQLite stores status as string, so index by string to avoid narrowing pain.
export const TRANSITIONS_ALLOWED: Record<string, FinishedPcStatus[]> = {
  DRAFT: [],
  ASSEMBLING: [FinishedPcStatus.TESTING],
  TESTING: [FinishedPcStatus.READY_FOR_SALE],
  READY_FOR_SALE: [FinishedPcStatus.TESTING],
  SOLD: [],
  WARRANTY: [],
  RETURNED: [],
  DEFECTIVE: [],
  SCRAPPED: [],
};
