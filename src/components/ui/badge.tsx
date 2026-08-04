import { cn } from "@/lib/cn";

const variants = {
  default: "bg-stone-100 text-stone-700",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-800",
  info: "bg-blue-50 text-blue-800",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function payrollStatusVariant(
  status: string
): keyof typeof variants {
  switch (status) {
    case "DRAFT":
      return "default";
    case "UNDER_REVIEW":
      return "warning";
    case "APPROVED":
      return "info";
    case "PAID":
      return "success";
    default:
      return "default";
  }
}

export function employeeStatusVariant(
  status: string
): keyof typeof variants {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "ON_LEAVE":
    case "SICK_LEAVE":
      return "info";
    case "SUSPENDED":
      return "warning";
    case "FIRED":
    case "TERMINATED":
      return "danger";
    default:
      return "default";
  }
}
