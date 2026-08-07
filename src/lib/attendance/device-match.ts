/** Normalize device / staff codes for matching: "001", "1", "STAFF-001" → shared keys. */
export function deviceMatchKeys(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const keys = new Set<string>([trimmed, trimmed.toUpperCase()]);
  const noZeros = trimmed.replace(/^0+/, "") || trimmed;
  keys.add(noZeros);
  keys.add(noZeros.toUpperCase());

  const staff = trimmed.match(/^(?:STAFF[-\s]?)?(\d+)$/i);
  if (staff) {
    const n = String(Number(staff[1]));
    keys.add(n);
    keys.add(staff[1]);
    keys.add(`STAFF-${n.padStart(3, "0")}`);
    keys.add(`STAFF-${n}`);
  }
  return [...keys];
}
