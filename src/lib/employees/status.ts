export const EMPLOYEE_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "ON_LEAVE", label: "Leave" },
  { value: "SICK_LEAVE", label: "Sick leave" },
  { value: "FIRED", label: "Fired" },
] as const;

export type EmployeeStatusValue =
  (typeof EMPLOYEE_STATUS_OPTIONS)[number]["value"];

export const EMPLOYEE_SEX_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

export type EmployeeSexValue = (typeof EMPLOYEE_SEX_OPTIONS)[number]["value"];

export function employeeStatusLabel(status: string): string {
  return (
    EMPLOYEE_STATUS_OPTIONS.find((o) => o.value === status)?.label ??
    status.replaceAll("_", " ")
  );
}

export function employeeSexLabel(sex: string | null | undefined): string {
  if (!sex) return "—";
  return EMPLOYEE_SEX_OPTIONS.find((o) => o.value === sex)?.label ?? sex;
}
