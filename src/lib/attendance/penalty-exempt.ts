/**
 * Attendance regulation vs pay-penalty rules.
 *
 * - Management: not shift-regulated (no punch scoring).
 * - Admin + Finance (except Cashier): still tracked, but no attendance pay penalties.
 * - Cashiers always take attendance penalties even if under Finance.
 */

const MANAGEMENT_PATTERN = /\bmanagement\b/i;
const ADMIN_PATTERN = /\badmin(?:istration|istrative)?\b/i;
const FINANCE_PATTERN =
  /\bfinance\b|\baccounts?\b|\baccount(?:ant|ing)\b|\bhead account\b|\bjunior account\b|\bcost account/i;
const CASHIER_PATTERN = /\bcashier\b/i;

function blob(
  department: string | null | undefined,
  jobTitle?: string | null | undefined
): string {
  return `${department ?? ""} ${jobTitle ?? ""}`.trim();
}

export function isCashierRole(
  department: string | null | undefined,
  jobTitle?: string | null | undefined
): boolean {
  return CASHIER_PATTERN.test(blob(department, jobTitle));
}

/** Departments not regulated by clock-in shifts (no late/absent scoring). */
export function isShiftAttendanceExempt(
  department: string | null | undefined,
  jobTitle?: string | null | undefined
): boolean {
  const text = blob(department, jobTitle);
  if (!text) return false;
  return MANAGEMENT_PATTERN.test(text);
}

/**
 * No missed-shift / unpaid-leave attendance deduction on payroll.
 * Cashiers are never exempt.
 */
export function isAttendancePenaltyExempt(
  department: string | null | undefined,
  jobTitle?: string | null | undefined
): boolean {
  const text = blob(department, jobTitle);
  if (!text) return false;
  if (isCashierRole(department, jobTitle)) return false;
  if (MANAGEMENT_PATTERN.test(text)) return true;
  if (ADMIN_PATTERN.test(text)) return true;
  if (FINANCE_PATTERN.test(text)) return true;
  return false;
}
