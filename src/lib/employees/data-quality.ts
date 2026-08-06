/** Detect incomplete or placeholder staff data (omitted names, dummy values, etc.). */

const PLACEHOLDER_EXACT = new Set(
  [
    "",
    "-",
    "--",
    "—",
    ".",
    "..",
    "n/a",
    "na",
    "n.a",
    "n.a.",
    "none",
    "nil",
    "null",
    "undefined",
    "unknown",
    "unnamed",
    "no name",
    "noname",
    "tbd",
    "tba",
    "temp",
    "temporary",
    "test",
    "xxx",
    "xxxx",
    "placeholder",
    "firstname",
    "lastname",
    "first name",
    "last name",
    "employee",
    "staff",
    "new employee",
    "new staff",
  ].map((s) => s.toLowerCase())
);

const PLACEHOLDER_CONTAINS = [
  "n/a",
  "unknown",
  "unnamed",
  "no name",
  "firstname",
  "lastname",
  "placeholder",
];

export type DataQualityIssueCode =
  | "OMITTED_FIRST_NAME"
  | "OMITTED_LAST_NAME"
  | "OMITTED_FULL_NAME"
  | "PLACEHOLDER_DEPARTMENT"
  | "PLACEHOLDER_JOB_TITLE"
  | "PLACEHOLDER_EMPLOYEE_CODE"
  | "MISSING_SEX"
  | "MISSING_BANK"
  | "MISSING_TIN"
  | "MISSING_RSA"
  | "MISSING_CLOCK_ID";

export interface DataQualityIssue {
  code: DataQualityIssueCode;
  field: string;
  message: string;
  severity: "block" | "warn" | "info";
}

export function normalizePersonName(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** True when a name looks omitted, dummy, or not a real personal name. */
export function isOmittedOrPlaceholderName(
  raw: string | null | undefined
): boolean {
  const value = normalizePersonName(raw);
  if (!value) return true;

  const lower = value.toLowerCase();
  if (PLACEHOLDER_EXACT.has(lower)) return true;
  if (PLACEHOLDER_CONTAINS.some((p) => lower === p || lower.includes(p))) {
    return true;
  }

  // Only punctuation / digits
  if (!/[a-zA-Z]/.test(value)) return true;

  // Single character (initial only) or repeated same letter (aaa)
  if (value.length === 1) return true;
  if (/^(.)\1{2,}$/i.test(value.replace(/\s/g, ""))) return true;

  // All digits / codes like "001"
  if (/^\d+$/.test(value)) return true;

  return false;
}

export function isPlaceholderLabel(raw: string | null | undefined): boolean {
  const value = normalizePersonName(raw);
  if (!value) return true;
  const lower = value.toLowerCase();
  if (PLACEHOLDER_EXACT.has(lower)) return true;
  if (["dept", "department", "title", "role", "position"].includes(lower)) {
    return true;
  }
  return false;
}

export function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "Unnamed staff"
): string {
  const first = normalizePersonName(firstName);
  const last = normalizePersonName(lastName);
  const parts = [first, last].filter((p) => p && !isOmittedOrPlaceholderName(p));
  if (parts.length === 0) return fallback;
  return parts.join(" ");
}

export function inspectEmployeeRecord(emp: {
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employeeCode?: string | null;
  sex?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  tin?: string | null;
  rsaPin?: string | null;
  clockDeviceId?: string | null;
  status?: string | null;
}): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const firstBad = isOmittedOrPlaceholderName(emp.firstName);
  const lastBad = isOmittedOrPlaceholderName(emp.lastName);

  if (firstBad && lastBad) {
    issues.push({
      code: "OMITTED_FULL_NAME",
      field: "name",
      message: "First and last name are missing or look like placeholders",
      severity: "block",
    });
  } else if (firstBad) {
    issues.push({
      code: "OMITTED_FIRST_NAME",
      field: "firstName",
      message: "First name is missing or looks like a placeholder",
      severity: "block",
    });
  } else if (lastBad) {
    issues.push({
      code: "OMITTED_LAST_NAME",
      field: "lastName",
      message: "Last name is missing or looks like a placeholder",
      severity: "block",
    });
  }

  if (isPlaceholderLabel(emp.department)) {
    issues.push({
      code: "PLACEHOLDER_DEPARTMENT",
      field: "department",
      message: "Department is missing or placeholder",
      severity: "warn",
    });
  }

  if (isPlaceholderLabel(emp.jobTitle)) {
    issues.push({
      code: "PLACEHOLDER_JOB_TITLE",
      field: "jobTitle",
      message: "Job title is missing or placeholder",
      severity: "warn",
    });
  }

  if (isPlaceholderLabel(emp.employeeCode) || /^\d{0,2}$/.test(normalizePersonName(emp.employeeCode))) {
    // very short numeric codes are ok (E1); empty / n/a not
    if (isPlaceholderLabel(emp.employeeCode)) {
      issues.push({
        code: "PLACEHOLDER_EMPLOYEE_CODE",
        field: "employeeCode",
        message: "Employee code is missing or placeholder",
        severity: "warn",
      });
    }
  }

  if (!emp.sex && emp.status !== "FIRED") {
    issues.push({
      code: "MISSING_SEX",
      field: "sex",
      message: "Sex not set",
      severity: "info",
    });
  }

  return issues;
}

export function nameFieldError(
  value: string | null | undefined,
  label: string
): string | null {
  if (isOmittedOrPlaceholderName(value)) {
    return `${label} is required and cannot be a placeholder (e.g. N/A, Unknown, Test)`;
  }
  return null;
}

/** Pure identity gaps for payroll preflight / audits. */
export function findIdentityGaps(
  employees: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: string;
    jobTitle: string;
  }>
): Array<{
  employeeId: string;
  employeeCode: string;
  code: "OMITTED_NAME" | "OMITTED_DEPARTMENT" | "OMITTED_JOB_TITLE";
  severity: "block" | "warn";
  title: string;
  detail: string;
}> {
  const gaps: Array<{
    employeeId: string;
    employeeCode: string;
    code: "OMITTED_NAME" | "OMITTED_DEPARTMENT" | "OMITTED_JOB_TITLE";
    severity: "block" | "warn";
    title: string;
    detail: string;
  }> = [];

  for (const emp of employees) {
    const label = displayName(
      emp.firstName,
      emp.lastName,
      emp.employeeCode || "Unnamed staff"
    );
    const firstBad = isOmittedOrPlaceholderName(emp.firstName);
    const lastBad = isOmittedOrPlaceholderName(emp.lastName);

    if (firstBad || lastBad) {
      const which =
        firstBad && lastBad
          ? "first and last name"
          : firstBad
            ? "first name"
            : "last name";
      gaps.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        code: "OMITTED_NAME",
        severity: "block",
        title: "Omitted or placeholder name",
        detail: `${label} (${emp.employeeCode}) has an incomplete ${which}. Payslips and bank files need a real legal name.`,
      });
    }

    if (isPlaceholderLabel(emp.department)) {
      gaps.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        code: "OMITTED_DEPARTMENT",
        severity: "warn",
        title: "Missing department",
        detail: `${label} (${emp.employeeCode}) has no real department set.`,
      });
    }

    if (isPlaceholderLabel(emp.jobTitle)) {
      gaps.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        code: "OMITTED_JOB_TITLE",
        severity: "warn",
        title: "Missing job title",
        detail: `${label} (${emp.employeeCode}) has no real job title set.`,
      });
    }
  }

  return gaps;
}
