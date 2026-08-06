import { describe, expect, it } from "vitest";
import {
  brandToCssVars,
  darkenHex,
  hexToRgbChannels,
  lightenHex,
  normalizeHex,
} from "@/lib/company-brand";

describe("company-brand", () => {
  it("normalizes hex colors", () => {
    expect(normalizeHex("#14919B")).toBe("#14919b");
    expect(normalizeHex("bad")).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });

  it("converts hex to RGB channels", () => {
    expect(hexToRgbChannels("#14919b")).toBe("20 145 155");
    expect(hexToRgbChannels("#0b2e33")).toBe("11 46 51");
  });

  it("darkens and lightens", () => {
    expect(darkenHex("#14919b", 0)).toBe("#14919b");
    expect(lightenHex("#000000", 1)).toBe("#ffffff");
  });

  it("maps brand to CSS vars with defaults", () => {
    const vars = brandToCssVars({
      name: "Acme",
      logoUrl: null,
      brandAccentHex: null,
      brandInkHex: null,
    });
    expect(vars["--lagoon"]).toBe("20 145 155");
    expect(vars["--ink"]).toBe("11 46 51");
  });

  it("applies custom accent and ink", () => {
    const vars = brandToCssVars({
      name: "Acme",
      logoUrl: null,
      brandAccentHex: "#c45c26",
      brandInkHex: "#1a1a2e",
    });
    expect(vars["--lagoon"]).toBe("196 92 38");
    expect(vars["--ink"]).toBe("26 26 46");
  });
});
