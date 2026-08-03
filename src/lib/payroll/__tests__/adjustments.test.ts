import { describe, it, expect } from "vitest";
import { nairaToKobo } from "@/lib/money";
import { aggregateAdjustments, mergeAdjustments } from "@/lib/payroll/adjustments";

describe("aggregateAdjustments", () => {
  it("sums bonuses and deductions by type", () => {
    const result = aggregateAdjustments([
      { type: "BONUS", amountKobo: nairaToKobo(50_000) },
      { type: "BONUS", amountKobo: nairaToKobo(25_000) },
      { type: "LOAN_DEDUCTION", amountKobo: nairaToKobo(-20_000) },
      { type: "ADVANCE", amountKobo: nairaToKobo(-10_000) },
      { type: "UNPAID_LEAVE", amountKobo: nairaToKobo(-5_000) },
    ]);

    expect(result.bonusKobo).toBe(nairaToKobo(75_000));
    expect(result.loanDeductionKobo).toBe(nairaToKobo(20_000));
    expect(result.advanceDeductionKobo).toBe(nairaToKobo(10_000));
    expect(result.unpaidLeaveDeductionKobo).toBe(nairaToKobo(5_000));
  });

  it("returns zeros for empty input", () => {
    const result = aggregateAdjustments([]);
    expect(result.bonusKobo).toBe(0n);
    expect(result.loanDeductionKobo).toBe(0n);
  });
});

describe("mergeAdjustments", () => {
  it("combines leave and manual adjustments", () => {
    const merged = mergeAdjustments(
      { unpaidLeaveDeductionKobo: nairaToKobo(30_000) },
      { bonusKobo: nairaToKobo(50_000), loanDeductionKobo: nairaToKobo(10_000) }
    );

    expect(merged.unpaidLeaveDeductionKobo).toBe(nairaToKobo(30_000));
    expect(merged.bonusKobo).toBe(nairaToKobo(50_000));
    expect(merged.loanDeductionKobo).toBe(nairaToKobo(10_000));
  });
});
