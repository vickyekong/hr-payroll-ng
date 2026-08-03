import { cn } from "@/lib/cn";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-stone-200">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
}

export function TableRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <tr className={cn("border-b border-stone-100 transition-colors hover:bg-stone-50/50", className)}>
      {children}
    </tr>
  );
}

export function TableHead({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th
      className={cn(
        "h-10 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-stone-500",
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-middle text-stone-700", className)} {...props}>
      {children}
    </td>
  );
}

export function TableCurrency({ value }: { value: bigint | string }) {
  const num = typeof value === "bigint" ? Number(value) / 100 : Number(value) / 100;
  return (
    <span className="tabular-nums font-medium text-stone-900">
      {new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 2,
      }).format(num)}
    </span>
  );
}
