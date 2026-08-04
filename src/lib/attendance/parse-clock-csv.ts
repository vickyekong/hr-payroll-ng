/** Parse common clock-machine CSV / TSV punch exports (ZKTeco-style and variants). */

export interface ParsedPunchRow {
  deviceUserId: string;
  punchedAt: Date;
  punchType: "IN" | "OUT" | null;
  rawLine: string;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === "," || ch === "\t" || ch === ";") && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // 2026-08-04 08:15:00 / 2026/08/04 08:15
  const isoish = trimmed.replace(/\//g, "-");
  const direct = new Date(isoish);
  if (!Number.isNaN(direct.getTime())) return direct;

  // 04/08/2026 08:15 (DD/MM/YYYY common in NG exports)
  const m = trimmed.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] ?? 0);
    // Prefer DMY when day > 12
    if (day > 12) {
      return new Date(year, month - 1, day, hour, minute, second);
    }
    // Ambiguous: treat as DMY (Nigeria)
    return new Date(year, month - 1, day, hour, minute, second);
  }

  return null;
}

function normalizePunchType(value: string | undefined): "IN" | "OUT" | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (["IN", "I", "0", "CHECKIN", "CHECK IN", "C/IN"].includes(v)) return "IN";
  if (["OUT", "O", "1", "CHECKOUT", "CHECK OUT", "C/OUT"].includes(v))
    return "OUT";
  return null;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const candidate of candidates) {
    const key = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = normalized.indexOf(key);
    if (idx >= 0) return idx;
  }
  // partial match
  for (let i = 0; i < normalized.length; i++) {
    for (const candidate of candidates) {
      const key = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalized[i].includes(key) || key.includes(normalized[i])) return i;
    }
  }
  return -1;
}

export function parseClockMachineCsv(csvText: string): {
  rows: ParsedPunchRow[];
  errors: string[];
} {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ["File is empty"] };
  }

  const headerCells = splitCsvLine(lines[0]);
  const looksLikeHeader = headerCells.some((c) =>
    /acno|user|badge|enroll|pin|id|time|date|name|status|punch/i.test(c)
  );

  let startIndex = 0;
  let deviceIdx = 0;
  let timeIdx = 1;
  let typeIdx = -1;

  if (looksLikeHeader) {
    startIndex = 1;
    deviceIdx = findColumnIndex(headerCells, [
      "acno",
      "ac no",
      "enrollnumber",
      "enroll",
      "deviceuserid",
      "userid",
      "user id",
      "badge",
      "badgeid",
      "pin",
      "id",
      "empcode",
      "employeeid",
    ]);
    timeIdx = findColumnIndex(headerCells, [
      "datetime",
      "date time",
      "punchtime",
      "time",
      "checktime",
      "timestamp",
      "date",
    ]);
    // Some exports split date + time
    const dateOnlyIdx = findColumnIndex(headerCells, ["date"]);
    const timeOnlyIdx = findColumnIndex(headerCells, ["time"]);
    typeIdx = findColumnIndex(headerCells, [
      "status",
      "punchstate",
      "state",
      "inout",
      "type",
      "checktype",
    ]);

    if (deviceIdx < 0) deviceIdx = 0;
    if (timeIdx < 0) {
      if (dateOnlyIdx >= 0 && timeOnlyIdx >= 0) {
        timeIdx = -2; // special combine mode
      } else {
        timeIdx = Math.min(1, headerCells.length - 1);
      }
    }

    const rows: ParsedPunchRow[] = [];
    const errors: string[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      const deviceUserId = (cells[deviceIdx] ?? "").replace(/^0+/, "") || cells[deviceIdx];
      if (!deviceUserId) {
        errors.push(`Line ${i + 1}: missing device user ID`);
        continue;
      }

      let punchedAt: Date | null = null;
      if (timeIdx === -2) {
        punchedAt = parseDateTime(
          `${cells[dateOnlyIdx] ?? ""} ${cells[timeOnlyIdx] ?? ""}`.trim()
        );
      } else {
        punchedAt = parseDateTime(cells[timeIdx] ?? "");
      }

      if (!punchedAt) {
        errors.push(`Line ${i + 1}: invalid date/time`);
        continue;
      }

      rows.push({
        deviceUserId: String(deviceUserId).trim(),
        punchedAt,
        punchType: normalizePunchType(typeIdx >= 0 ? cells[typeIdx] : undefined),
        rawLine: lines[i],
      });
    }

    return { rows, errors };
  }

  // No header: assume deviceId, datetime[, type]
  const rows: ParsedPunchRow[] = [];
  const errors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const deviceUserId = (cells[0] ?? "").trim();
    const punchedAt = parseDateTime(cells[1] ?? "");
    if (!deviceUserId || !punchedAt) {
      errors.push(`Line ${i + 1}: expected deviceId, datetime`);
      continue;
    }
    rows.push({
      deviceUserId,
      punchedAt,
      punchType: normalizePunchType(cells[2]),
      rawLine: lines[i],
    });
  }
  return { rows, errors };
}

export function isWorkDay(workDays: string, date: Date): boolean {
  // JS: Sun=0 … Sat=6 → map to Mon=0 … Sun=6
  const jsDay = date.getDay();
  const monFirst = jsDay === 0 ? 6 : jsDay - 1;
  return workDays[monFirst] === "1";
}

export function parseHm(hm: string): { hours: number; minutes: number } {
  const [h, m] = hm.split(":").map(Number);
  return { hours: h || 0, minutes: m || 0 };
}

export function combineDateAndTime(date: Date, hm: string): Date {
  const { hours, minutes } = parseHm(hm);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

export function shiftDurationMinutes(startTime: string, endTime: string): number {
  const start = parseHm(startTime);
  const end = parseHm(endTime);
  let mins =
    end.hours * 60 + end.minutes - (start.hours * 60 + start.minutes);
  if (mins <= 0) mins += 24 * 60; // overnight
  return mins;
}

export type CompiledDayStatus =
  | "PRESENT"
  | "LATE"
  | "PARTIAL"
  | "ABSENT"
  | "ON_LEAVE"
  | "OFF";

export function compileAttendanceStatus(options: {
  expected: boolean;
  onLeave: boolean;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  shiftStart: Date;
  graceMinutes: number;
  minPresentMinutes: number;
  expectedMinutes: number;
}): {
  status: CompiledDayStatus;
  workedMinutes: number;
  lateMinutes: number;
} {
  if (!options.expected) {
    return { status: "OFF", workedMinutes: 0, lateMinutes: 0 };
  }
  if (options.onLeave) {
    return { status: "ON_LEAVE", workedMinutes: 0, lateMinutes: 0 };
  }
  if (!options.clockInAt) {
    return { status: "ABSENT", workedMinutes: 0, lateMinutes: 0 };
  }

  const lateMs = options.clockInAt.getTime() - options.shiftStart.getTime();
  const lateMinutes =
    lateMs > options.graceMinutes * 60_000
      ? Math.floor(lateMs / 60_000) - options.graceMinutes
      : 0;

  let workedMinutes = 0;
  if (options.clockOutAt && options.clockOutAt > options.clockInAt) {
    workedMinutes = Math.floor(
      (options.clockOutAt.getTime() - options.clockInAt.getTime()) / 60_000
    );
  }

  if (workedMinutes > 0 && workedMinutes < options.minPresentMinutes) {
    return { status: "PARTIAL", workedMinutes, lateMinutes };
  }
  if (lateMinutes > 0) {
    return { status: "LATE", workedMinutes, lateMinutes };
  }
  return {
    status: "PRESENT",
    workedMinutes: workedMinutes || options.expectedMinutes,
    lateMinutes: 0,
  };
}
