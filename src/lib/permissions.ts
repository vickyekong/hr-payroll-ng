import type { UserRole } from "@prisma/client";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 4,
  HR_ADMIN: 3,
  FINANCE: 2,
  EMPLOYEE: 1,
};

export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export const PERMISSIONS = {
  manageCompanySettings: ["SUPER_ADMIN"] as UserRole[],
  manageStatutoryRates: ["SUPER_ADMIN"] as UserRole[],
  manageEmployees: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  runPayroll: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  approvePayroll: ["SUPER_ADMIN", "FINANCE"] as UserRole[],
  viewReports: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"] as UserRole[],
  viewAuditLog: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"] as UserRole[],
  manageLeave: ["SUPER_ADMIN", "HR_ADMIN"] as UserRole[],
  viewOwnPayslips: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE", "EMPLOYEE"] as UserRole[],
};

export function can(userRole: UserRole, permission: keyof typeof PERMISSIONS): boolean {
  return PERMISSIONS[permission].includes(userRole);
}
