import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  compileAttendanceStatus,
  isWorkDay,
  parseClockMachineCsv,
  shiftDurationMinutes,
} from "@/lib/attendance/parse-clock-csv";
import { parseTimecardText } from "@/lib/attendance/parse-timecard-text";
import { isShiftAttendanceExempt, isAttendancePenaltyExempt } from "@/lib/attendance/penalty-exempt";
import { deviceMatchKeys } from "@/lib/attendance/device-match";
import {
  mapAttendanceSheetCode,
  parseMonthlyAttendanceSheets,
  scoreEmployeeNameMatch,
} from "@/lib/attendance/parse-attendance-sheet";

describe("deviceMatchKeys", () => {
  it("links STAFF codes to bare device numbers", () => {
    const keys = deviceMatchKeys("STAFF-042");
    expect(keys).toEqual(
      expect.arrayContaining(["STAFF-042", "42", "042", "STAFF-42"])
    );
    expect(deviceMatchKeys("1")).toEqual(
      expect.arrayContaining(["1", "STAFF-001"])
    );
  });
});

describe("isShiftAttendanceExempt", () => {
  it("exempts Management from shift regulation", () => {
    expect(isShiftAttendanceExempt("Management")).toBe(true);
    expect(isShiftAttendanceExempt("management")).toBe(true);
    expect(isShiftAttendanceExempt("MANAGEMENT")).toBe(true);
    expect(isShiftAttendanceExempt("Senior Management")).toBe(true);
  });

  it("does not treat Admin/Finance as shift-exempt", () => {
    expect(isShiftAttendanceExempt("Admin", "Admin Assistant")).toBe(false);
    expect(isShiftAttendanceExempt("Finance", "Head Account")).toBe(false);
    expect(isShiftAttendanceExempt("Floor staff")).toBe(false);
    expect(isShiftAttendanceExempt("")).toBe(false);
    expect(isShiftAttendanceExempt(null)).toBe(false);
  });
});

describe("isAttendancePenaltyExempt", () => {
  it("exempts Admin and Finance, but not cashiers", () => {
    expect(isAttendancePenaltyExempt("Admin", "Admin Assistant")).toBe(true);
    expect(isAttendancePenaltyExempt("Administration", "HR Admin")).toBe(true);
    expect(isAttendancePenaltyExempt("Finance", "Head Account")).toBe(true);
    expect(isAttendancePenaltyExempt("", "Cost Accountant")).toBe(true);
    expect(isAttendancePenaltyExempt("", "Junior Account")).toBe(true);
    expect(isAttendancePenaltyExempt("Finance", "Cashier")).toBe(false);
    expect(isAttendancePenaltyExempt("", "Cashier")).toBe(false);
    expect(isAttendancePenaltyExempt("Floor", "Waiter")).toBe(false);
    expect(isAttendancePenaltyExempt("Management")).toBe(true);
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
});

describe("shift helpers", () => {
  it("detects work days from bitmask", () => {
    expect(isWorkDay("1111100", new Date(2026, 7, 3))).toBe(true); // Mon
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

describe("mapAttendanceSheetCode", () => {
  it("maps L'ORI legend codes", () => {
    expect(mapAttendanceSheetCode("W")?.status).toBe("PRESENT");
    expect(mapAttendanceSheetCode("A")?.penalize).toBe(true);
    expect(mapAttendanceSheetCode("UP")?.penalize).toBe(true);
    expect(mapAttendanceSheetCode("O")?.status).toBe("OFF");
    expect(mapAttendanceSheetCode("V")?.status).toBe("ON_LEAVE");
    expect(mapAttendanceSheetCode("H")?.status).toBe("OFF");
  });
});

describe("scoreEmployeeNameMatch", () => {
  it("matches exact and fuzzy names", () => {
    expect(
      scoreEmployeeNameMatch("Prosper Obande", "Prosper", "Obande")
    ).toBeGreaterThan(0.9);
    expect(
      scoreEmployeeNameMatch("Emmanauel Alben", "Emmanuel", "Alben")
    ).toBeGreaterThan(0.55);
    expect(
      scoreEmployeeNameMatch("Totally Different", "Prosper", "Obande")
    ).toBeLessThan(0.4);
  });
});

describe("parseMonthlyAttendanceSheets", () => {
  it("parses L'ORI-style monthly day-code grids", () => {
    const aoa = [
      ["", "L'ORI Hospitality"],
      [],
      [
        "",
        "No. Of Employees:",
        "Attendance Sheet",
        "",
        "",
        "",
        "",
        "",
        "",
        "Month Day's Detailed",
      ],
      ["", "From: 1/4/2026"],
      ["", "To: 30/4/2026"],
      ["", "Employee Name", "", "Day&Date"],
      [
        "",
        "",
        "",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
        "Mon",
        "Tue",
        "Wed",
      ],
      [
        "",
        "",
        "",
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
      ],
      ["", "Admin"],
      [
        "",
        "Amaka",
        "Admin Assistant",
        "W",
        "W",
        "W",
        "W",
        "O",
        "W",
        "W",
        "W",
        "W",
        "W",
        "W",
        "O",
        "W",
        "W",
        "W",
        "W",
        "W",
        "W",
        "O",
        "W",
        "W",
        "W",
        "W",
        "W",
        "W",
        "O",
        "W",
        "W",
        "W",
        "W",
      ],
      [
        "",
        "Olaoti Fumilayo",
        "HR",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "A",
        "W",
        "O",
        "W",
        "W",
        "W",
        "W",
        "W",
        "W",
        "O",
        "W",
        "W",
        "W",
        "W",
        "W",
        "W",
        "O",
        "W",
        "W",
        "W",
        "W",
      ],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "APRIL 2026");
    const buffer = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const result = parseMonthlyAttendanceSheets(buffer);
    expect(result.detected).toBe(true);
    expect(result.sheetsParsed).toEqual(["APRIL 2026"]);
    expect(result.employeeNames).toEqual(
      expect.arrayContaining(["Amaka", "Olaoti Fumilayo"])
    );
    const amakaPresent = result.days.filter(
      (d) => d.employeeName === "Amaka" && d.code === "W"
    );
    expect(amakaPresent.length).toBeGreaterThan(15);
    const olaotiAbsent = result.days.filter(
      (d) => d.employeeName === "Olaoti Fumilayo" && d.code === "A"
    );
    expect(olaotiAbsent.length).toBe(10);
    expect(olaotiAbsent[0].penalize).toBe(true);
    expect(result.periodHints[0]).toMatchObject({ month: 4, year: 2026 });
  });
});
