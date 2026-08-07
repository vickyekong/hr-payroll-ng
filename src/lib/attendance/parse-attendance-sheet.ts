import * as XLSX from "xlsx";

/**
 * L'ORI / Arami-style monthly attendance sheets:
 * - One sheet per month ("FEB 2026", "APRIL 2026", …)
 * - Header "Attendance Sheet" + From/To dates
 * - Day number row, then employee rows: Name | Job | W/A/O/… per day
 *
 * Legend (from workbook):
 *   W = Worked, P = Present, O = Day Off, A = Absent,
 *   UP = Unpaid leave, H = Public holiday, V = Annual leave,
 *   S = Split, D = Double shift, L = Days in lieu
 */

export type SheetDayCode =
  | "W"
  | "P"
  | "O"
  | "A"
  | "UP"
  | "H"
  | "V"
  | "S"
  | "D"
  | "L";

export type AttendanceDayStatusMapped =
  | "PRESENT"
  | "LATE"
  | "PARTIAL"
  | "ABSENT"
  | "ON_LEAVE"
  | "OFF";

export interface ParsedSheetDay {
  employeeName: string;
  jobTitle: string | null;
  workDate: Date;
  code: SheetDayCode;
  status: AttendanceDayStatusMapped;
  /** Deduct a working-day rate for this day */
  penalize: boolean;
  sheetName: string;
  rawLine: string;
}

export interface ParsedAttendanceSheetResult {
  days: ParsedSheetDay[];
  errors: string[];
  sheetsParsed: string[];
  employeeNames: string[];
  periodHints: Array<{ month: number; year: number; dayCount: number }>;
  detected: boolean;
}

const CODE_SET = new Set<string>([
  "W",
  "P",
  "O",
  "A",
  "UP",
  "H",
  "V",
  "S",
  "D",
  "L",
]);

const SECTION_HEADERS = new Set(
  [
    "admin",
    "finance",
    "floor",
    "it",
    "hr",
    "kitchen",
    "bar",
    "housekeeping",
    "security",
    "supervisors",
    "supervisors/managers",
    "managers",
    "management",
    "vip butler",
    "procurement",
    "procurement/store keeper",
    "store keeper",
    "storekeeper",
    "employee name",
    "day&date",
    "attendance sheet",
    "total",
    "no. of employees",
    "month day's detailed",
  ].map((s) => s.toLowerCase())
);

export function mapAttendanceSheetCode(code: string): {
  status: AttendanceDayStatusMapped;
  penalize: boolean;
  label: string;
} | null {
  const c = code.trim().toUpperCase();
  switch (c) {
    case "W":
      return { status: "PRESENT", penalize: false, label: "Worked" };
    case "P":
      return { status: "PRESENT", penalize: false, label: "Present" };
    case "D":
      return { status: "PRESENT", penalize: false, label: "Double shift" };
    case "S":
      return { status: "PARTIAL", penalize: false, label: "Split shift" };
    case "O":
      return { status: "OFF", penalize: false, label: "Day off" };
    case "H":
      return { status: "OFF", penalize: false, label: "Public holiday" };
    case "L":
      return { status: "OFF", penalize: false, label: "Days in lieu" };
    case "A":
      return { status: "ABSENT", penalize: true, label: "Absent" };
    case "UP":
      return { status: "ABSENT", penalize: true, label: "Unpaid leave" };
    case "V":
      return { status: "ON_LEAVE", penalize: false, label: "Annual leave" };
    default:
      return null;
  }
}

function cellStr(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    // Day numbers often come through as 1.0, 2.0
    if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
      return String(Math.round(value));
    }
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function parseFromTo(text: string): { day: number; month: number; year: number } | null {
  const m = text.match(
    /(?:from|to)\s*:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/i
  );
  if (!m) return null;
  return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
}

function parseSheetNamePeriod(
  name: string
): { month: number; year: number } | null {
  const cleaned = name.trim().toUpperCase().replace(/\s+/g, " ");
  const months: Record<string, number> = {
    JAN: 1,
    JANUARY: 1,
    FEB: 2,
    FEBRUARY: 2,
    MAR: 3,
    MARCH: 3,
    APR: 4,
    APRIL: 4,
    MAY: 5,
    JUN: 6,
    JUNE: 6,
    JUL: 7,
    JULY: 7,
    AUG: 8,
    AUGUST: 8,
    SEP: 9,
    SEPT: 9,
    SEPTEMBER: 9,
    OCT: 10,
    OCTOBER: 10,
    NOV: 11,
    NOVEMBER: 11,
    DEC: 12,
    DECEMBER: 12,
  };
  const m = cleaned.match(
    /^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)\s*(20\d{2})$/
  );
  if (!m) return null;
  return { month: months[m[1]], year: Number(m[2]) };
}

function isSectionHeader(name: string, jobTitle: string | null): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (SECTION_HEADERS.has(n)) return true;
  if (n.includes("supervisor") || n.includes("store keeper")) return true;
  // Department-only rows often have no personal job title / look like roles
  if (!jobTitle && !/\s/.test(name) && name.length < 18) {
    // Single-token short labels like "Admin", "Floor", "IT"
    if (!/[a-z]{4,}/i.test(name) || SECTION_HEADERS.has(n)) return true;
  }
  return false;
}

function looksLikePersonName(name: string): boolean {
  const n = name.trim();
  if (n.length < 3) return false;
  if (!/[a-zA-Z]/.test(n)) return false;
  if (CODE_SET.has(n.toUpperCase())) return false;
  if (SECTION_HEADERS.has(n.toLowerCase())) return false;
  // Prefer names with a space (first + last), but allow single given names
  // when they appear with a job title.
  return true;
}

function extractAttendanceCode(raw: string): SheetDayCode | null {
  const t = raw.trim().toUpperCase();
  if (!t || t === "0") return null;
  if (CODE_SET.has(t)) return t as SheetDayCode;
  return null;
}

function isAttendanceSheetGrid(rows: unknown[][]): boolean {
  let hits = 0;
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r] ?? [];
    for (const cell of row) {
      const s = cellStr(cell).toLowerCase();
      if (
        s.includes("attendance sheet") ||
        s.includes("employee name") ||
        s.includes("day&date") ||
        s.includes("month day's detailed")
      ) {
        hits += 1;
      }
    }
  }
  return hits >= 2;
}

function findDayColumns(
  rows: unknown[][]
): { dayRow: number; dayCols: Array<{ col: number; day: number }> } | null {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r] ?? [];
    const dayCols: Array<{ col: number; day: number }> = [];
    for (let c = 0; c < row.length; c++) {
      const s = cellStr(row[c]);
      if (!/^\d{1,2}$/.test(s)) continue;
      const day = Number(s);
      if (day >= 1 && day <= 31) {
        dayCols.push({ col: c, day });
      }
    }
    // A real day header has a contiguous run of calendar days
    if (dayCols.length >= 20) {
      dayCols.sort((a, b) => a.day - b.day || a.col - b.col);
      return { dayRow: r, dayCols };
    }
  }
  return null;
}

function detectNameColumns(
  rows: unknown[][],
  dayStartCol: number
): { nameCol: number; jobCol: number | null } {
  // Prefer the column under "Employee Name"
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < Math.min(row.length, dayStartCol); c++) {
      if (cellStr(row[c]).toLowerCase().includes("employee name")) {
        return {
          nameCol: c,
          jobCol: c + 1 < dayStartCol ? c + 1 : null,
        };
      }
    }
  }
  return { nameCol: 0, jobCol: dayStartCol > 1 ? 1 : null };
}

function parseSheetRows(
  sheetName: string,
  rows: unknown[][],
  fallbackPeriod: { month: number; year: number } | null
): { days: ParsedSheetDay[]; errors: string[] } {
  const days: ParsedSheetDay[] = [];
  const errors: string[] = [];

  if (!isAttendanceSheetGrid(rows)) {
    return { days, errors };
  }

  let period = fallbackPeriod;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (const cell of rows[r] ?? []) {
      const s = cellStr(cell);
      const from = parseFromTo(s);
      if (from && /from/i.test(s)) {
        period = { month: from.month, year: from.year };
      }
    }
  }
  if (!period) {
    errors.push(`${sheetName}: could not detect month/year`);
    return { days, errors };
  }

  const dayInfo = findDayColumns(rows);
  if (!dayInfo) {
    errors.push(`${sheetName}: could not find day-number header row`);
    return { days, errors };
  }

  const dayStartCol = Math.min(...dayInfo.dayCols.map((d) => d.col));
  const { nameCol, jobCol } = detectNameColumns(rows, dayStartCol);
  const dataStart = dayInfo.dayRow + 1;

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const name = cellStr(row[nameCol]);
    const job = jobCol != null ? cellStr(row[jobCol]) || null : null;

    if (!name) continue;
    if (isSectionHeader(name, job)) continue;
    if (!looksLikePersonName(name)) continue;

    const codesOnRow: Array<{ col: number; code: SheetDayCode }> = [];
    for (const { col, day } of dayInfo.dayCols) {
      const code = extractAttendanceCode(cellStr(row[col]));
      if (!code) continue;
      codesOnRow.push({ col, code });
      void day;
    }
    if (codesOnRow.length === 0) continue;

    // Require a job title OR multiple name tokens so we skip leftover headers
    if (!job && !/\s/.test(name)) continue;

    for (const { day } of dayInfo.dayCols) {
      const col = dayInfo.dayCols.find((d) => d.day === day)?.col;
      if (col == null) continue;
      const code = extractAttendanceCode(cellStr(row[col]));
      if (!code) continue;
      const mapped = mapAttendanceSheetCode(code);
      if (!mapped) continue;

      const workDate = new Date(period.year, period.month - 1, day);
      if (
        workDate.getFullYear() !== period.year ||
        workDate.getMonth() !== period.month - 1 ||
        workDate.getDate() !== day
      ) {
        continue; // invalid calendar day for month
      }

      days.push({
        employeeName: name.replace(/\s+/g, " ").trim(),
        jobTitle: job ? job.replace(/\s+/g, " ").trim() : null,
        workDate,
        code,
        status: mapped.status,
        penalize: mapped.penalize,
        sheetName,
        rawLine: `${name}|${job ?? ""}|${day}=${code}`,
      });
    }
  }

  return { days, errors };
}

/** Detect and parse L'ORI-style monthly attendance workbooks. */
export function parseMonthlyAttendanceSheets(
  buffer: ArrayBuffer | Buffer
): ParsedAttendanceSheetResult {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const allDays: ParsedSheetDay[] = [];
  const errors: string[] = [];
  const sheetsParsed: string[] = [];
  const nameSet = new Set<string>();
  const periodCounts = new Map<string, number>();

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    if (!Array.isArray(rows) || rows.length < 8) continue;
    if (!isAttendanceSheetGrid(rows as unknown[][])) continue;

    const fallback = parseSheetNamePeriod(name);
    const parsed = parseSheetRows(name, rows as unknown[][], fallback);
    if (parsed.days.length === 0) {
      errors.push(...parsed.errors);
      continue;
    }
    sheetsParsed.push(name);
    errors.push(...parsed.errors);
    for (const d of parsed.days) {
      allDays.push(d);
      nameSet.add(d.employeeName);
      const key = `${d.workDate.getFullYear()}-${d.workDate.getMonth() + 1}`;
      periodCounts.set(key, (periodCounts.get(key) ?? 0) + 1);
    }
  }

  const periodHints = [...periodCounts.entries()]
    .map(([key, dayCount]) => {
      const [year, month] = key.split("-").map(Number);
      return { month, year, dayCount };
    })
    .sort((a, b) => b.dayCount - a.dayCount);

  return {
    days: allDays,
    errors: errors.slice(0, 30),
    sheetsParsed,
    employeeNames: [...nameSet].sort(),
    periodHints,
    detected: allDays.length > 0,
  };
}

/** Score how well `sheetName` matches an employee full name (0–1). */
export function scoreEmployeeNameMatch(
  sheetName: string,
  firstName: string,
  lastName: string
): number {
  const a = normalizeNameTokens(sheetName);
  const b = normalizeNameTokens(`${firstName} ${lastName}`);
  if (a.length === 0 || b.length === 0) return 0;

  const aJoined = a.join(" ");
  const bJoined = b.join(" ");
  if (aJoined === bJoined) return 1;

  // Exact token set match (order-insensitive)
  if (a.length === b.length && a.every((t) => b.includes(t))) return 0.96;

  const shared = a.filter((t) => b.includes(t));
  const union = new Set([...a, ...b]).size;
  const jaccard = shared.length / union;

  // Soft fuzzy for typos (Emmanauel vs Emmanuel)
  let fuzzyBonus = 0;
  for (const ta of a) {
    if (b.includes(ta)) continue;
    for (const tb of b) {
      if (ta[0] === tb[0] && editDistance(ta, tb) <= 2 && ta.length >= 5) {
        fuzzyBonus += 0.08;
      }
    }
  }

  // Prefer sharing both first and last-ish tokens
  const lastHit =
    a.some((t) => t === b[b.length - 1]) ||
    b.some((t) => t === a[a.length - 1]);
  const firstHit = a[0] === b[0] || shared.includes(a[0]) || shared.includes(b[0]);
  let score = jaccard + fuzzyBonus;
  if (firstHit && lastHit) score += 0.15;
  return Math.min(1, score);
}

function normalizeNameTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .filter((t) => !["mr", "mrs", "miss", "ms", "dr"].includes(t));
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export const ATTENDANCE_SHEET_NOTE_PREFIX = "Attendance sheet:";

export function attendanceSheetNote(code: SheetDayCode): string {
  const mapped = mapAttendanceSheetCode(code);
  return `${ATTENDANCE_SHEET_NOTE_PREFIX} ${mapped?.label ?? code} (${code})`;
}
