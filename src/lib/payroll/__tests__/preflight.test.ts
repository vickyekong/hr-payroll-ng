import { describe, expect, it } from "vitest";
import {
  detectDuplicateBankAccounts,
  detectMissingPaymentFields,
  detectNetPayVariances,
  detectZeroOrNegativeNet,
} from "@/lib/payroll/preflight";
import { createZipStore } from "@/lib/exports/zip";

describe("payroll preflight detectors", () => {
  it("flags duplicate bank accounts", () => {
    const exceptions = detectDuplicateBankAccounts([
      {
        id: "1",
        employeeCode: "E1",
        firstName: "Ada",
        lastName: "Okeke",
        bankAccountNumber: "0123456789",
      },
      {
        id: "2",
        employeeCode: "E2",
        firstName: "Chidi",
        lastName: "Bello",
        bankAccountNumber: "012-345-6789",
      },
    ]);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].severity).toBe("block");
    expect(exceptions[0].code).toBe("DUPLICATE_BANK");
  });

  it("blocks missing bank and warns on missing TIN/RSA", () => {
    const meta = new Map([
      ["1", { pensionEmployeeKobo: 50_000n, nhfKobo: 10_000n }],
    ]);
    const exceptions = detectMissingPaymentFields(
      [
        {
          id: "1",
          employeeCode: "E1",
          firstName: "Ada",
          lastName: "Okeke",
          bankName: null,
          bankAccountNumber: null,
          tin: null,
          rsaPin: null,
          nhfNumber: null,
        },
      ],
      meta
    );
    expect(exceptions.some((e) => e.code === "MISSING_BANK")).toBe(true);
    expect(exceptions.some((e) => e.code === "MISSING_TIN")).toBe(true);
    expect(exceptions.some((e) => e.code === "MISSING_RSA")).toBe(true);
    expect(exceptions.some((e) => e.code === "MISSING_NHF")).toBe(true);
  });

  it("warns on net pay spikes over 25%", () => {
    const prior = new Map([["1", 100_000_00n]]);
    const exceptions = detectNetPayVariances(
      [
        {
          employeeId: "1",
          employeeCode: "E1",
          name: "Ada Okeke",
          netPayKobo: 140_000_00n,
        },
      ],
      prior
    );
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].code).toBe("NET_PAY_VARIANCE");
    expect(exceptions[0].severity).toBe("warn");
  });

  it("does not warn under threshold", () => {
    const prior = new Map([["1", 100_000_00n]]);
    const exceptions = detectNetPayVariances(
      [
        {
          employeeId: "1",
          employeeCode: "E1",
          name: "Ada Okeke",
          netPayKobo: 110_000_00n,
        },
      ],
      prior
    );
    expect(exceptions).toHaveLength(0);
  });

  it("flags zero net pay", () => {
    const exceptions = detectZeroOrNegativeNet([
      {
        employeeId: "1",
        employeeCode: "E1",
        name: "Ada",
        netPayKobo: 0n,
      },
    ]);
    expect(exceptions[0].code).toBe("ZERO_NET");
  });
});

describe("zip store", () => {
  it("builds a zip with local file header signature", () => {
    const zip = createZipStore([
      { name: "a.csv", content: "hello,world\n1,2\n" },
    ]);
    // PK\x03\x04
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    expect(zip.length).toBeGreaterThan(30);
  });
});
