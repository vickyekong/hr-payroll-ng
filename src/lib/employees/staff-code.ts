/**
 * Build a unique staff / employee code from a clock-machine device ID.
 * Always ends with the device number so badge ↔ staff matching stays obvious.
 *
 * Examples: 100 → STAFF-100, 003 → STAFF-3 (leading zeros stripped for the suffix)
 */
export function staffCodeFromClockId(clockDeviceId: string): string {
  const raw = clockDeviceId.trim();
  if (!raw) throw new Error("Clock device ID is required");

  // Prefer numeric suffix without leading zeros; keep alphanumeric badges as-is.
  const numeric = raw.replace(/^0+/, "") || raw;
  return `STAFF-${numeric}`;
}

export function normalizeClockDeviceId(clockDeviceId: string): string {
  const raw = clockDeviceId.trim();
  const stripped = raw.replace(/^0+/, "");
  return stripped || raw;
}
