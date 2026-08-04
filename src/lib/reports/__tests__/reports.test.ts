import { describe, it, expect } from "vitest";
import { buildCsv, escapeCsvCell, formatNairaFromKobo } from "@/lib/reports/csv";
import { nairaToKobo } from "@/lib/money";
import { buildRemittanceSchedule, sumRemittances } from "@/lib/reports/remittances";

describe("CSV helpers", () => {
  it("escapes cells with commas and quotes", () => {
    expect(escapeCsvCell('say "hello", world')).toBe('"say ""hello"", world"');
  });

  it("builds CSV with headers and rows", () => {
    const csv = buildCsv(
      ["A", "B"],
      [
        [1, 2],
        ["x", "y"],
      ]
    );
    expect(csv).toBe("A,B\n1,2\nx,y");
  });

  it("formats kobo as naira string", () => {
    expect(formatNairaFromKobo(nairaToKobo(1234.5))).toBe("1234.50");
  });
});

describe("Remittance totals", () => {
  it("sums payslip statutory amounts", () => {
    const totals = sumRemittances([
      {
        payeKobo: nairaToKobo(100_000),
        pensionEmployeeKobo: nairaToKobo(50_000),
        pensionEmployerKobo: nairaToKobo(60_000),
        nhfKobo: nairaToKobo(10_000),
        nsitfKobo: nairaToKobo(5_000),
      },
      {
        payeKobo: nairaToKobo(80_000),
        pensionEmployeeKobo: nairaToKobo(40_000),
        pensionEmployerKobo: nairaToKobo(50_000),
        nhfKobo: nairaToKobo(8_000),
        nsitfKobo: nairaToKobo(4_000),
      },
    ]);

    expect(totals.paye).toBe(nairaToKobo(180_000));
    expect(totals.pensionEmployee).toBe(nairaToKobo(90_000));
    expect(totals.pensionEmployer).toBe(nairaToKobo(110_000));
  });

  it("builds remittance schedule rows", () => {
    const schedule = buildRemittanceSchedule(
      {
        paye: nairaToKobo(100_000),
        pensionEmployee: nairaToKobo(50_000),
        pensionEmployer: nairaToKobo(60_000),
        nhf: nairaToKobo(10_000),
        nsitf: nairaToKobo(5_000),
      },
      "January 2026"
    );
    expect(schedule).toHaveLength(5);
    expect(schedule[0].body).toContain("PAYE");
    expect(schedule[0].notes).toContain("January 2026");
  });
});
