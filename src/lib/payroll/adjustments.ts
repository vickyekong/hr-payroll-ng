import type { PayrollAdjustments } from "./types";

export interface AdjustmentRecord {
  type: string;
  amountKobo: bigint;
}

/** Sum payroll adjustment rows into engine input (amounts stored signed in DB). */
export function aggregateAdjustments(
  records: AdjustmentRecord[]
): PayrollAdjustments {
  let bonusKobo = 0n;
  let loanDeductionKobo = 0n;
  let advanceDeductionKobo = 0n;
  let unpaidLeaveDeductionKobo = 0n;
  let otherDeductionsKobo = 0n;

  for (const record of records) {
    const abs =
      record.amountKobo < 0n ? -record.amountKobo : record.amountKobo;
    switch (record.type) {
      case "BONUS":
        bonusKobo += abs;
        break;
      case "LOAN_DEDUCTION":
        loanDeductionKobo += abs;
        break;
      case "ADVANCE":
        advanceDeductionKobo += abs;
        break;
      case "UNPAID_LEAVE":
        unpaidLeaveDeductionKobo += abs;
        break;
      case "ATTENDANCE_PENALTY":
        otherDeductionsKobo += abs;
        break;
    }
  }

  return {
    bonusKobo,
    loanDeductionKobo,
    advanceDeductionKobo,
    unpaidLeaveDeductionKobo,
    otherDeductionsKobo,
  };
}

export function mergeAdjustments(
  base: PayrollAdjustments,
  extra: PayrollAdjustments
): PayrollAdjustments {
  return {
    bonusKobo: (base.bonusKobo ?? 0n) + (extra.bonusKobo ?? 0n),
    loanDeductionKobo:
      (base.loanDeductionKobo ?? 0n) + (extra.loanDeductionKobo ?? 0n),
    advanceDeductionKobo:
      (base.advanceDeductionKobo ?? 0n) + (extra.advanceDeductionKobo ?? 0n),
    unpaidLeaveDeductionKobo:
      (base.unpaidLeaveDeductionKobo ?? 0n) +
      (extra.unpaidLeaveDeductionKobo ?? 0n),
    otherDeductionsKobo:
      (base.otherDeductionsKobo ?? 0n) + (extra.otherDeductionsKobo ?? 0n),
  };
}
