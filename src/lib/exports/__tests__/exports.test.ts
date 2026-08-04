import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvCell } from "@/lib/reports/csv";

describe("export CSV helpers", () => {
  it("escapes commas and quotes", () => {
    expect(escapeCsvCell('Acme, "NG"')).toBe('"Acme, ""NG"""');
  });

  it("builds csv with headers and rows", () => {
    const csv = buildCsv(
      ["Code", "Name"],
      [
        ["EMP-001", "Adaeze"],
        ["EMP-002", 'Eze, Chidi'],
      ]
    );
    expect(csv).toBe('Code,Name\nEMP-001,Adaeze\nEMP-002,"Eze, Chidi"');
  });
});
