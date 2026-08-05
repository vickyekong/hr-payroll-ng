import { describe, expect, it } from "vitest";
import {
  detectDepartmentPressure,
  detectEarlyAttritionRisk,
  detectLeaveSpike,
  percentChange,
} from "@/lib/intelligence/risk-signals";
import {
  combineBaselineWithScenario,
  forecastHireScenario,
} from "@/lib/forecasting/payroll-scenario";
import { mapStatutoryConfig } from "@/lib/payroll/config-mapper";

describe("risk signals", () => {
  it("computes percent change", () => {
    expect(percentChange(140, 100)).toBe(40);
    expect(percentChange(5, 0)).toBe(100);
    expect(percentChange(0, 0)).toBe(null);
  });

  it("flags department absence spikes", () => {
    const signals = detectDepartmentPressure(
      [
        {
          department: "Marketing",
          headcount: 8,
          absentDays: 10,
          lateDays: 4,
          scheduledDays: 160,
        },
      ],
      [
        {
          department: "Marketing",
          headcount: 8,
          absentDays: 5,
          lateDays: 2,
          scheduledDays: 160,
        },
      ]
    );
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].department).toBe("Marketing");
    expect(signals[0].kind === "burnout" || signals[0].kind === "dept_pressure").toBe(
      true
    );
  });

  it("flags leave spikes", () => {
    const signal = detectLeaveSpike(9, 4);
    expect(signal).not.toBeNull();
    expect(signal!.kind).toBe("leave_spike");
  });

  it("flags early attrition for poor new-hire attendance", () => {
    const start = new Date();
    start.setDate(start.getDate() - 45);
    const signals = detectEarlyAttritionRisk([
      {
        employeeId: "1",
        employeeCode: "E1",
        name: "New Hire",
        department: "Ops",
        startDate: start,
        absentDays: 6,
        lateDays: 2,
        scheduledDays: 20,
      },
    ]);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe("attrition");
  });
});

describe("payroll forecast", () => {
  it("scales employer cost by headcount", () => {
    const config = mapStatutoryConfig(null);
    const one = forecastHireScenario(config, {
      headcount: 1,
      basicNaira: 300_000,
      housingNaira: 50_000,
      transportNaira: 30_000,
    });
    const five = forecastHireScenario(config, {
      headcount: 5,
      basicNaira: 300_000,
      housingNaira: 50_000,
      transportNaira: 30_000,
    });
    expect(BigInt(five.monthly.employerCostKobo)).toBe(
      BigInt(one.monthly.employerCostKobo) * 5n
    );
    expect(BigInt(five.perHire.grossKobo)).toBe(BigInt(one.perHire.grossKobo));
  });

  it("adds scenario onto baseline", () => {
    const config = mapStatutoryConfig(null);
    const scenario = forecastHireScenario(config, {
      headcount: 2,
      basicNaira: 200_000,
    });
    const combined = combineBaselineWithScenario(
      {
        headcount: 10,
        monthlyGrossKobo: "100000000",
        monthlyNetKobo: "80000000",
        monthlyEmployerCostKobo: "110000000",
      },
      scenario
    );
    expect(combined.projectedHeadcount).toBe(12);
    expect(BigInt(combined.projectedEmployerCostKobo)).toBe(
      110000000n + BigInt(scenario.monthly.employerCostKobo)
    );
  });
});
