/** Canonical company departments — seeded for every company. */
export const DEFAULT_DEPARTMENTS = [
  "Admin",
  "Finance",
  "Floor Staffs",
  "Bar",
  "CRM",
  "IT",
  "Media",
  "Procurment and Store",
  "Logistics",
  "Stewards",
] as const;

export type DefaultDepartment = (typeof DEFAULT_DEPARTMENTS)[number];

export function isDefaultDepartment(name: string): boolean {
  const needle = name.trim().toLowerCase();
  return DEFAULT_DEPARTMENTS.some((d) => d.toLowerCase() === needle);
}

export function matchDefaultDepartment(name: string): string | null {
  const needle = name.trim().toLowerCase();
  return (
    DEFAULT_DEPARTMENTS.find((d) => d.toLowerCase() === needle) ?? null
  );
}
