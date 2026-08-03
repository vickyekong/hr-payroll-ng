import { applyRateBps } from "@/lib/money";
import type { Kobo } from "@/lib/money";

export function calculateNsitf(
  grossPayKobo: Kobo,
  nsitfRateBps: number
): Kobo {
  return applyRateBps(grossPayKobo, nsitfRateBps);
}
