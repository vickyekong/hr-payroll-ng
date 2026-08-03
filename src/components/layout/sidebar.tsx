"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/cn";
import { can } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

const navItems: Array<{
  href: string;
  label: string;
  roles: UserRole[];
}> = [
  { href: "/dashboard", label: "Overview", roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"] },
  { href: "/employees", label: "Employees", roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { href: "/payroll", label: "Payroll", roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"] },
  { href: "/leave", label: "Leave", roles: ["SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE"] },
  { href: "/reports", label: "Reports", roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"] },
  { href: "/my", label: "My Portal", roles: ["EMPLOYEE"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const visible = navItems.filter(
    (item) => role && item.roles.includes(role)
  );

  return (
    <aside className="flex w-56 flex-col border-r border-stone-200 bg-stone-50">
      <div className="border-b border-stone-200 px-5 py-6">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Payroll
        </p>
        <h1 className="mt-1 text-lg font-semibold text-stone-900">HR Pay NG</h1>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {visible.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            )}
          >
            {item.label}
          </Link>
        ))}
        {role && can(role, "manageStatutoryRates") && (
          <Link
            href="/settings"
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/settings")
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            )}
          >
            Settings
          </Link>
        )}
      </nav>
      <div className="border-t border-stone-200 p-4">
        <p className="truncate text-sm font-medium text-stone-900">
          {session?.user?.name}
        </p>
        <p className="truncate text-xs text-stone-500">{session?.user?.email}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-3 text-xs text-stone-500 hover:text-stone-900"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
