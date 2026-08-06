import type { ParsedPunchRow } from "@/lib/attendance/parse-clock-csv";
import { parseTimecardText } from "@/lib/attendance/parse-timecard-text";

/**
 * Extract text from a clock / Time Card PDF and parse punches.
 */
export async function parseClockPdf(
  buffer: ArrayBuffer | Buffer
): Promise<{ rows: ParsedPunchRow[]; errors: string[] }> {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  let text = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data });
    const result = await parser.getText();
    text = result.text ?? "";
    await parser.destroy?.();
  } catch (err) {
    return {
      rows: [],
      errors: [
        `Could not read PDF: ${err instanceof Error ? err.message : "parse failed"}`,
      ],
    };
  }

  if (!text.trim()) {
    return { rows: [], errors: ["PDF contained no extractable text"] };
  }

  return parseTimecardText(text);
}
