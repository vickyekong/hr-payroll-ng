import { describe, expect, it } from "vitest";
import {
  compileAttendanceStatus,
  isWorkDay,
  parseClockMachineCsv,
  shiftDurationMinutes,
} from "@/lib/attendance/parse-clock-csv";
import { parseTimecardText } from "@/lib/attendance/parse-timecard-text";
import { isShiftAttendanceExempt } from "@/lib/attendance/penalty-exempt";

describe("isShiftAttendanceExempt", () => {
  it("exempts Management department (any casing)", () => {
    expect(isShiftAttendanceExempt("Management")).toBe(true);
    expect(isShiftAttendanceExempt("management")).toBe(true);
    expect(isShiftAttendanceExempt("MANAGEMENT")).toBe(true);
    expect(isShiftAttendanceExempt("Senior Management")).toBe(true);
  });

  it("does not exempt other departments", () => {
    expect(isShiftAttendanceExempt("Floor staff")).toBe(false);
    expect(isShiftAttendanceExempt("Kitchen")).toBe(false);
    expect(isShiftAttendanceExempt("")).toBe(false);
    expect(isShiftAttendanceExempt(null)).toBe(false);
  });
});

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

describe("parseTimecardText", () => {
  it("parses single-line Time Card rows with multiple punches", () => {
    const text = `Time Card
Start Date 2026-07-01 End Date 2026-07-31
100\tAmadi\tFloor staff\t2026-07-11\t2\t01:24:28,22:27:16
101\tOdey\tFloor staff\t2026-07-08\t1\t22:07:53
`;
    const { rows, errors } = parseTimecardText(text);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(3);
    expect(rows[0].deviceUserId).toBe("100");
    expect(rows[0].punchedAt.getHours()).toBe(1);
    expect(rows[0].punchedAt.getMinutes()).toBe(24);
    expect(rows[1].deviceUserId).toBe("100");
    expect(rows[2].deviceUserId).toBe("101");
  });

  it("parses multi-line PDF-style blocks", () => {
    const text = [
      "100",
      "Amadi",
      "Floor staff",
      "2026-07-07",
      "1",
      "17:02:30",
      "100",
      "Amadi",
      "Floor staff",
      "2026-07-09",
      "1",
      "23:00:22",
    ].join("\n");
    const { rows, errors } = parseTimecardText(text);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].deviceUserId).toBe("100");
    expect(rows[1].punchedAt.getHours()).toBe(23);
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
