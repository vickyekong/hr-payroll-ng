import { describe, expect, it } from "vitest";
import {
  normalizeClockDeviceId,
  staffCodeFromClockId,
} from "@/lib/employees/staff-code";

describe("staffCodeFromClockId", () => {
  it("builds STAFF-{id} ending with the clock number", () => {
    expect(staffCodeFromClockId("100")).toBe("STAFF-100");
    expect(staffCodeFromClockId("3")).toBe("STAFF-3");
    expect(staffCodeFromClockId("007")).toBe("STAFF-7");
  });

  it("normalizes leading zeros on device ids", () => {
    expect(normalizeClockDeviceId("007")).toBe("7");
    expect(normalizeClockDeviceId("100")).toBe("100");
  });
});
