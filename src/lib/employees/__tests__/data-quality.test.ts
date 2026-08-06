import { describe, expect, it } from "vitest";
import {
  displayName,
  findIdentityGaps,
  isOmittedOrPlaceholderName,
  isPlaceholderLabel,
  inspectEmployeeRecord,
} from "@/lib/employees/data-quality";

describe("omitted / placeholder names", () => {
  it("flags empty, N/A, Unknown, Test, and single initials", () => {
    expect(isOmittedOrPlaceholderName("")).toBe(true);
    expect(isOmittedOrPlaceholderName("  ")).toBe(true);
    expect(isOmittedOrPlaceholderName("N/A")).toBe(true);
    expect(isOmittedOrPlaceholderName("Unknown")).toBe(true);
    expect(isOmittedOrPlaceholderName("test")).toBe(true);
    expect(isOmittedOrPlaceholderName("-")).toBe(true);
    expect(isOmittedOrPlaceholderName("A")).toBe(true);
    expect(isOmittedOrPlaceholderName("123")).toBe(true);
  });

  it("accepts real names", () => {
    expect(isOmittedOrPlaceholderName("Ada")).toBe(false);
    expect(isOmittedOrPlaceholderName("Okafor-Bello")).toBe(false);
    expect(isOmittedOrPlaceholderName("Chioma")).toBe(false);
  });

  it("builds a safe display name", () => {
    expect(displayName("N/A", "Unknown", "E001")).toBe("E001");
    expect(displayName("Ada", "Okeke")).toBe("Ada Okeke");
    expect(displayName("Ada", "")).toBe("Ada");
  });

  it("inspects a broken employee record", () => {
    const issues = inspectEmployeeRecord({
      firstName: "N/A",
      lastName: "",
      department: "dept",
      jobTitle: "TBD",
      employeeCode: "E1",
    });
    expect(issues.some((i) => i.code === "OMITTED_FULL_NAME")).toBe(true);
    expect(issues.some((i) => i.code === "PLACEHOLDER_DEPARTMENT")).toBe(true);
    expect(issues.some((i) => i.code === "PLACEHOLDER_JOB_TITLE")).toBe(true);
  });

  it("finds identity gaps for payroll", () => {
    const gaps = findIdentityGaps([
      {
        id: "1",
        employeeCode: "E9",
        firstName: "Unknown",
        lastName: "Staff",
        department: "Ops",
        jobTitle: "Clerk",
      },
    ]);
    expect(gaps.some((e) => e.code === "OMITTED_NAME")).toBe(true);
    expect(gaps[0].severity).toBe("block");
  });

  it("treats blank department as placeholder", () => {
    expect(isPlaceholderLabel("")).toBe(true);
    expect(isPlaceholderLabel("Finance")).toBe(false);
  });
});
