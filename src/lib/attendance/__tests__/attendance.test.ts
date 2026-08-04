import { describe, expect, it } from "vitest";
import {
  compileAttendanceStatus,
  isWorkDay,
  parseClockMachineCsv,
  shiftDurationMinutes,
} from "@/lib/attendance/parse-clock-csv";

describe("parseClockMachineCsv", () => {
  it("parses ZKTeco-style header export", () => {
    const csv = `AcNo,Name,DateTime,Status
001,Adaeze,2026-08-04 08:02:00,IN
001,Adaeze,2026-08-04 17:05:00,OUT
002,Chidi,04/08/2026 09:30,I
`;
    const { rows, errors } = parseClockMachineCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(3);
    expect(rows[0].deviceUserId).toBe("001");
    expect(rows[0].punchType).toBe("IN");
    expect(rows[2].punchType).toBe("IN");
  });
});

describe("shift helpers", () => {
  it("detects weekdays", () => {
    // 2026-08-03 is Monday
    expect(isWorkDay("1111100", new Date(2026, 7, 3))).toBe(true);
    expect(isWorkDay("1111100", new Date(2026, 7, 8))).toBe(false); // Sat
  });

  it("computes duration", () => {
    expect(shiftDurationMinutes("08:00", "17:00")).toBe(540);
  });
});

describe("compileAttendanceStatus", () => {
  const shiftStart = new Date(2026, 7, 4, 8, 0, 0);

  it("marks absent when no clock-in", () => {
    const result = compileAttendanceStatus({
      expected: true,
      onLeave: false,
      clockInAt: null,
      clockOutAt: null,
      shiftStart,
      graceMinutes: 15,
      minPresentMinutes: 240,
      expectedMinutes: 540,
    });
    expect(result.status).toBe("ABSENT");
  });

  it("marks late after grace", () => {
    const result = compileAttendanceStatus({
      expected: true,
      onLeave: false,
      clockInAt: new Date(2026, 7, 4, 8, 40, 0),
      clockOutAt: new Date(2026, 7, 4, 17, 0, 0),
      shiftStart,
      graceMinutes: 15,
      minPresentMinutes: 240,
      expectedMinutes: 540,
    });
    expect(result.status).toBe("LATE");
    expect(result.lateMinutes).toBe(25);
  });
});
