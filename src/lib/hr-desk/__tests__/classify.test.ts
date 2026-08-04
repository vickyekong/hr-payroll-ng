import { describe, expect, it } from "vitest";
import {
  classifyHrMail,
  extractLeaveDates,
  inferLeaveType,
} from "@/lib/hr-desk/classify";

describe("classifyHrMail", () => {
  it("detects leave requests", () => {
    expect(classifyHrMail("Annual leave request", "I need time off")).toBe(
      "LEAVE"
    );
  });

  it("detects payroll queries", () => {
    expect(classifyHrMail("Payslip question", "About my salary")).toBe(
      "PAYROLL"
    );
  });
});

describe("leave helpers", () => {
  it("infers sick leave", () => {
    expect(inferLeaveType("Sick leave", "")).toBe("SICK");
  });

  it("extracts date ranges", () => {
    const dates = extractLeaveDates("Please approve 12/08/2026 - 16/08/2026");
    expect(dates?.days).toBe(5);
  });
});
