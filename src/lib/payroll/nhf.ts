import { applyRateBps } from "@/lib/money";
import type { Kobo } from "@/lib/money";

export function calculateNhf(
  basicSalaryKobo: Kobo,
  nhfEnabled: boolean,
  nhfRateBps: number
): Kobo {
  if (!nhfEnabled) return 0n;
  return applyRateBps(basicSalaryKobo, nhfRateBps);
}
