import { IsEnum } from "class-validator";
import { FinishedPcStatus } from "@prisma/client";

export enum TransitionTarget {
  TESTING = "TESTING",
  READY_FOR_SALE = "READY_FOR_SALE",
}

export class TransitionFinishedPcDto {
  @IsEnum(TransitionTarget)
  to!: TransitionTarget;
}

export const TRANSITIONS_ALLOWED: Record<FinishedPcStatus, FinishedPcStatus[]> = {
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
