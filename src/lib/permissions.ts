import type { UserRole } from "@prisma/client";

/**
 * Two similar logins — both run people, payroll, leave, desk, and reports.
 * Super Admin also clears sensitive actions:
 *   - approve payroll (after HR submits)
 *   - approve sensitive staff change requests
 *   - statutory rates (tax / pension config)
 *
 * Both Super Admin and HR can open Settings (e.g. Google Workspace).
 * FINANCE / EMPLOYEE remain in the DB enum for legacy rows but are not
 * first-class portals (blocked at login).
 */
export const PORTAL_ROLES = ["SUPER_ADMIN", "HR_ADMIN"] as const;
export type PortalRole = (typeof PORTAL_ROLES)[number];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 4,
  HR_ADMIN: 3,
  FINANCE: 2,
  EMPLOYEE: 1,
};

/** Map legacy roles onto the two-portal model for permissions. */
export function effectivePortalRole(role: UserRole): PortalRole | null {
  if (role === "SUPER_ADMIN" || role === "FINANCE") return "SUPER_ADMIN";
  if (role === "HR_ADMIN") return "HR_ADMIN";
  return null; // EMPLOYEE — no portal
}

export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export const PERMISSIONS = {
  /** Settings page + Google Workspace / company integrations */
  manageCompanySettings: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  /** PAYE bands and statutory rates — Super Admin only */
  manageStatutoryRates: ["SUPER_ADMIN"] as UserRole[],
  manageEmployees: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  /** Salary / allowance edits on staff records */
  manageCompensation: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  /** Clock machine, shifts, attendance compile */
  manageAttendance: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  /** Company inbox triage, assign, draft replies */
  manageHrDesk: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  runPayroll: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  /** Final payroll sign-off — Super Admin only (HR submits for approval) */
  approvePayroll: ["SUPER_ADMIN"] as UserRole[],
  /** Sensitive staff data changes — Super Admin signs off after HR logs them */
  approveChangeRequests: ["SUPER_ADMIN"] as UserRole[],
  viewReports: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"] as UserRole[],
  viewAuditLog: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"] as UserRole[],
  /** Month-range CSV export of the audit log */
  exportAuditLog: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  manageLeave: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  viewPayslips: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"] as UserRole[],
};

export function can(
  userRole: UserRole,
  permission: keyof typeof PERMISSIONS
): boolean {
  return PERMISSIONS[permission].includes(userRole);
}

export function portalLabel(role: UserRole): string {
  const portal = effectivePortalRole(role);
  if (portal === "SUPER_ADMIN") return "Super Admin";
  if (portal === "HR_ADMIN") return "HR";
  return "No access";
}

export function homePathForRole(role: UserRole): string {
  if (effectivePortalRole(role)) return "/dashboard";
  return "/login";
}
