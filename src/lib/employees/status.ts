export const EMPLOYEE_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "ON_LEAVE", label: "Leave" },
  { value: "SICK_LEAVE", label: "Sick leave" },
  { value: "FIRED", label: "Fired" },
  { value: "RESIGNED", label: "Resigned" },
] as const;

export type EmployeeStatusValue =
  (typeof EMPLOYEE_STATUS_OPTIONS)[number]["value"];

/** Staff who have left the company (not on payroll / books). */
export function isEmploymentEnded(status: string): boolean {
  return status === "FIRED" || status === "RESIGNED";
}

export const EMPLOYEE_SEX_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

export type EmployeeSexValue = (typeof EMPLOYEE_SEX_OPTIONS)[number]["value"];

export function employeeStatusLabel(status: string): string {
  return (
    EMPLOYEE_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
    status.replace(/_/g, " ")
  );
}

export function employeeSexLabel(sex: string | null | undefined): string {
  if (!sex) return "—";
  return EMPLOYEE_SEX_OPTIONS.find((o) => o.value === sex)?.label ?? sex;
}
