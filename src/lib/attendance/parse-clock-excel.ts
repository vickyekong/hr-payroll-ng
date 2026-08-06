import * as XLSX from "xlsx";
import {
  parseClockMachineCsv,
  type ParsedPunchRow,
} from "@/lib/attendance/parse-clock-csv";
import { parseTimecardText } from "@/lib/attendance/parse-timecard-text";

/**
 * Parse Excel (.xlsx / .xls) clock or Time Card exports into punch rows.
 * Tries sheet-as-CSV (ZKTeco-style) first, then Time Card column layout.
 */
export function parseClockExcel(buffer: ArrayBuffer | Buffer): {
  rows: ParsedPunchRow[];
  errors: string[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  if (!workbook.SheetNames.length) {
    return { rows: [], errors: ["Excel workbook has no sheets"] };
  }

  const allRows: ParsedPunchRow[] = [];
  const allErrors: string[] = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    // 1) Standard CSV-style punch export
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const csvParsed = parseClockMachineCsv(csv);
    if (csvParsed.rows.length > 0) {
      allRows.push(...csvParsed.rows);
      allErrors.push(...csvParsed.errors);
      continue;
    }

    // 2) Time Card column layout (Employee ID, Date, Time / Times)
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    const timecard = parseTimecardSheetRows(json);
    if (timecard.rows.length > 0) {
      allRows.push(...timecard.rows);
      allErrors.push(...timecard.errors);
      continue;
    }

    // 3) Fall back to dumping sheet text for Time Card PDF-style paste
    const textParsed = parseTimecardText(csv);
    if (textParsed.rows.length > 0) {
      allRows.push(...textParsed.rows);
      allErrors.push(...textParsed.errors);
    }
  }

  if (allRows.length === 0) {
    return {
      rows: [],
      errors:
        allErrors.length > 0
          ? allErrors.slice(0, 20)
          : [
              "Could not read punches from Excel. Use columns like AcNo + DateTime, or Employee ID + Date + Time.",
            ],
    };
  }

  return { rows: allRows, errors: allErrors.slice(0, 20) };
}

function parseTimecardSheetRows(
  records: Record<string, unknown>[]
): { rows: ParsedPunchRow[]; errors: string[] } {
  const rows: ParsedPunchRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const keys = Object.keys(rec);
    const norm = Object.fromEntries(
      keys.map((k) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), rec[k]])
    );

    const deviceUserId = String(
      norm.employeeid ??
        norm.employeecode ??
        norm.acno ??
        norm.userid ??
        norm.id ??
        norm.pin ??
        ""
    ).trim();

    const dateRaw = String(
      norm.date ?? norm.workdate ?? norm.punchdate ?? ""
    ).trim();
    const timeRaw = String(
      norm.time ?? norm.times ?? norm.punchtime ?? norm.datetime ?? ""
    ).trim();

    if (!deviceUserId || (!dateRaw && !timeRaw)) continue;

    // Combined datetime in one cell
    if (!dateRaw && timeRaw) {
      const d = new Date(timeRaw);
      if (!Number.isNaN(d.getTime())) {
        const key = `${deviceUserId}|${d.toISOString()}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            deviceUserId,
            punchedAt: d,
            punchType: null,
            rawLine: JSON.stringify(rec),
          });
        }
        continue;
      }
    }

    const dateStr = normalizeExcelDate(dateRaw);
    const times = timeRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (!dateStr || times.length === 0) {
      // Maybe datetime already in dateRaw
      const combined = new Date(`${dateRaw} ${timeRaw}`.trim());
      if (!Number.isNaN(combined.getTime())) {
        const key = `${deviceUserId}|${combined.toISOString()}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            deviceUserId,
            punchedAt: combined,
            punchType: null,
            rawLine: JSON.stringify(rec),
          });
        }
      } else {
        errors.push(`Row ${i + 2}: could not parse date/time`);
      }
      continue;
    }

    for (const t of times) {
      const punchedAt = combine(dateStr, t);
      if (!punchedAt) {
        errors.push(`Row ${i + 2}: invalid time ${t}`);
        continue;
      }
      const key = `${deviceUserId}|${punchedAt.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        deviceUserId,
        punchedAt,
        punchType: null,
        rawLine: JSON.stringify(rec),
      });
    }
  }

  return { rows, errors };
}

function normalizeExcelDate(value: string): string | null {
  const v = value.trim();
  const iso = v.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function combine(dateStr: string, timeStr: string): Date | null {
  const tm = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const dm = dateStr.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (!tm || !dm) {
    const d = new Date(`${dateStr} ${timeStr}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
    Number(tm[3] ?? 0)
  );
}
