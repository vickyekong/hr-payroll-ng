import { describe, expect, it } from "vitest";

// Lightweight pure helpers mirrored for scoring behaviour
function scoreFlags(flags: string[]): number {
  let score = 0;
  for (const f of flags) {
    if (f.includes("missed")) score += 25;
    else if (f.includes("late")) score += 10;
    else if (f.includes("leave")) score += 8;
    else if (f.includes("clock")) score += 12;
    else if (f.includes("shift")) score += 12;
    else if (f.includes("suspended") || f.includes("sick")) score += 15;
    else score += 5;
  }
  return Math.min(100, score);
}

describe("staff intelligence scoring", () => {
  it("ranks missed shifts above late days", () => {
    expect(scoreFlags(["3 missed shifts this month"])).toBeGreaterThan(
      scoreFlags(["3 late days"])
    );
  });

  it("caps at 100", () => {
    expect(
      scoreFlags([
        "5 missed shifts this month",
        "5 missed shifts this month",
        "5 missed shifts this month",
        "5 missed shifts this month",
        "suspended",
      ])
    ).toBe(100);
  });
});
