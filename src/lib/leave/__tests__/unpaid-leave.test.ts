import { describe, it, expect } from "vitest";
import {
  countWorkingDaysBetween,
  unpaidWorkingDaysInPeriod,
  sumUnpaidLeaveDaysInPeriod,
} from "@/lib/leave/unpaid-leave";

describe("countWorkingDaysBetween", () => {
  it("counts weekdays only", () => {
    // Mon 2 Jun 2025 – Fri 6 Jun 2025
    const start = new Date(2025, 5, 2);
    const end = new Date(2025, 5, 6);
    expect(countWorkingDaysBetween(start, end)).toBe(5);
  });

  it("excludes weekends spanning two weeks", () => {
    // Mon 2 Jun – Mon 9 Jun 2025 (includes weekend)
    const start = new Date(2025, 5, 2);
    const end = new Date(2025, 5, 9);
    expect(countWorkingDaysBetween(start, end)).toBe(6);
  });

  it("returns zero when end is before start", () => {
    expect(
      countWorkingDaysBetween(new Date(2025, 5, 10), new Date(2025, 5, 2))
    ).toBe(0);
  });
});

describe("unpaidWorkingDaysInPeriod", () => {
  const periodStart = new Date(2025, 5, 1); // Jun 1
  const periodEnd = new Date(2025, 5, 30); // Jun 30

  it("returns full overlap when leave is within period", () => {
    const days = unpaidWorkingDaysInPeriod(
      new Date(2025, 5, 3),
      new Date(2025, 5, 5),
      periodStart,
      periodEnd
    );
    expect(days).toBe(3); // Tue–Thu
  });

  it("clips leave that starts before the period", () => {
    const days = unpaidWorkingDaysInPeriod(
      new Date(2025, 4, 28), // May 28
      new Date(2025, 5, 4), // Jun 4
      periodStart,
      periodEnd
    );
    // Jun 1 is Sunday, Jun 2–4 = 3 working days
    expect(days).toBe(3);
  });

  it("returns zero when leave does not overlap period", () => {
    const days = unpaidWorkingDaysInPeriod(
      new Date(2025, 6, 1),
      new Date(2025, 6, 5),
      periodStart,
      periodEnd
    );
    expect(days).toBe(0);
  });
});

describe("sumUnpaidLeaveDaysInPeriod", () => {
  it("sums multiple overlapping requests", () => {
    const periodStart = new Date(2025, 5, 1);
    const periodEnd = new Date(2025, 5, 30);
    const total = sumUnpaidLeaveDaysInPeriod(
      [
        { startDate: new Date(2025, 5, 2), endDate: new Date(2025, 5, 3) },
        { startDate: new Date(2025, 5, 9), endDate: new Date(2025, 5, 10) },
      ],
      periodStart,
      periodEnd
    );
    expect(total).toBe(4);
  });
});
