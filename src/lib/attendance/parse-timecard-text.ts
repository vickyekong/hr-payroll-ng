import type { ParsedPunchRow } from "@/lib/attendance/parse-clock-csv";

/**
 * Parse Time Card PDF / report text into punch rows.
 * Supports:
 * - Line-oriented PDF extract: id / name / dept / date / count / times
 * - Single-line rows: `100\tAmadi\tFloor staff\t2026-07-11\t2\t01:24:28,22:27:16`
 */
export function parseTimecardText(text: string): {
  rows: ParsedPunchRow[];
  errors: string[];
} {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedPunchRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  const pushPunch = (
    deviceUserId: string,
    dateStr: string,
    timeStr: string,
    raw: string
  ) => {
    const punchedAt = combineDateAndClockTime(dateStr, timeStr);
    if (!punchedAt) {
      errors.push(`Invalid date/time: ${dateStr} ${timeStr}`);
      return;
    }
    const key = `${deviceUserId}|${punchedAt.toISOString()}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      deviceUserId,
      punchedAt,
      punchType: null,
      rawLine: raw,
    });
  };

  // Pass 1: single-line Time Card rows
  const lineRow =
    /^(\d+)\s+([A-Za-z][A-Za-z'\-]*)\s+(.+?)\s+(20\d{2}-\d{2}-\d{2})\s+(\d+)\s+([\d:,\s]+)$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^Employee ID$/i.test(line) || /^First Name$/i.test(line)) {
      i += 1;
      continue;
    }
    if (/^Time Card$/i.test(line) || /^Start Date/i.test(line)) {
      i += 1;
      continue;
    }
    if (/^\d+\/\d+/.test(line) || /^-- \d+ of \d+ --$/.test(line)) {
      i += 1;
      continue;
    }

    const single = line.match(lineRow);
    if (single) {
      const deviceUserId = single[1];
      const dateStr = single[4];
      const times = single[6]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      for (const t of times) {
        pushPunch(deviceUserId, dateStr, t, line);
      }
      i += 1;
      continue;
    }

    // Pass 2: multi-line PDF blocks (id, name, dept, date, count, times)
    if (/^\d+$/.test(line) && i + 5 < lines.length) {
      const name = lines[i + 1];
      const dept = lines[i + 2];
      const dateStr = lines[i + 3];
      const countStr = lines[i + 4];
      const timesStr = lines[i + 5];

      if (
        /^[A-Za-z][A-Za-z'\-]*$/.test(name) &&
        /staff|dept|department|floor|office|kitchen|bar|security/i.test(dept) &&
        /^20\d{2}-\d{2}-\d{2}$/.test(dateStr) &&
        /^\d+$/.test(countStr) &&
        /\d{1,2}:\d{2}/.test(timesStr)
      ) {
        const times = timesStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const raw = [line, name, dept, dateStr, countStr, timesStr].join(" | ");
        for (const t of times) {
          pushPunch(line, dateStr, t, raw);
        }
        i += 6;
        continue;
      }
    }

    i += 1;
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push(
      "No Time Card punches found. Expected Employee ID, date (YYYY-MM-DD), and punch times."
    );
  }

  return { rows, errors };
}

function combineDateAndClockTime(
  dateStr: string,
  timeStr: string
): Date | null {
  const dm = dateStr.trim().match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  const tm = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!dm || !tm) return null;
  const year = Number(dm[1]);
  const month = Number(dm[2]);
  const day = Number(dm[3]);
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  const second = Number(tm[3] ?? 0);
  const d = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(d.getTime()) ? null : d;
}
