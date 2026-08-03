import { cn } from "@/lib/cn";

export function formatCurrency(kobo: bigint | string | number): string {
  const value = typeof kobo === "bigint" ? Number(kobo) / 100 : Number(kobo) / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function getMonthName(month: number): string {
  return new Intl.DateTimeFormat("en-NG", { month: "long" }).format(
    new Date(2026, month - 1, 1)
  );
}

export function employeeFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

export { cn };
