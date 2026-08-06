import { cn } from "@/lib/cn";

const variants = {
  default: "bg-sand text-ink-soft",
  success: "bg-lagoon-mist text-ok",
  warning: "bg-amber-50 text-warn",
  danger: "bg-red-50 text-signal",
  info: "bg-lagoon-mist/70 text-lagoon-deep",
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
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
    case "RESIGNED":
    case "TERMINATED":
      return "danger";
    default:
      return "default";
  }
}
