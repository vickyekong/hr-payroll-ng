import { cn } from "@/lib/cn";

export function Table({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
      <div className="relative inline-block min-w-full align-middle">
        <table
          className={cn(
            "w-full min-w-[36rem] caption-bottom text-sm",
            className
          )}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-line">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
}

export function TableRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <tr
      className={cn(
        "border-b border-sand transition-colors hover:bg-mist/70",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted sm:px-4",
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
    <td
      className={cn(
        "whitespace-nowrap px-3 py-3 align-middle text-ink-soft sm:px-4",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableCurrency({ value }: { value: bigint | string }) {
  const num =
    typeof value === "bigint" ? Number(value) / 100 : Number(value) / 100;
  return (
    <span className="font-medium tabular-nums text-ink">
      {new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 2,
      }).format(num)}
    </span>
  );
}
