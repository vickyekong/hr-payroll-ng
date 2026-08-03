/** All monetary values stored as kobo (1 Naira = 100 kobo) */

export type Kobo = bigint;

export function nairaToKobo(naira: number | string): Kobo {
  const value = typeof naira === "string" ? parseFloat(naira) : naira;
  return BigInt(Math.round(value * 100));
}

export function koboToNaira(kobo: Kobo): number {
  return Number(kobo) / 100;
}

export function formatNaira(kobo: Kobo): string {
  const naira = koboToNaira(kobo);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(naira);
}

export function applyRateBps(amount: Kobo, rateBps: number): Kobo {
  return (amount * BigInt(rateBps)) / 10000n;
}

export function sumKobo(...amounts: Kobo[]): Kobo {
  return amounts.reduce((acc, val) => acc + val, 0n);
}

export function maxKobo(a: Kobo, b: Kobo): Kobo {
  return a > b ? a : b;
}

export function minKobo(a: Kobo, b: Kobo): Kobo {
  return a < b ? a : b;
}
