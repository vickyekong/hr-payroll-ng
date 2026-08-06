"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/cn";
import {
  can,
  effectivePortalRole,
  portalLabel,
} from "@/lib/permissions";
import { PRODUCT_NAME } from "@/lib/brand";
import type { UserRole } from "@prisma/client";
import { NotificationsBell } from "@/components/layout/notifications-bell";

const navItems: Array<{
  href: string;
  label: string;
  roles: UserRole[];
}> = [
  {
    href: "/dashboard",
    label: "Overview",
    roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"],
  },
  {
    href: "/employees",
    label: "Employees",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/hr-desk",
    label: "HR Desk",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/hr-ask",
    label: "HR Ask",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/payroll",
    label: "Payroll",
    roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"],
  },
  {
    href: "/leave",
    label: "Leave",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
  },
  {
    href: "/reports",
    label: "Reports",
    roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"],
  },
  {
    href: "/audit-log",
    label: "Audit log",
    roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const portal = role ? effectivePortalRole(role) : null;

  const visible = navItems.filter(
    (item) => role && item.roles.includes(role)
  );

  return (
    <aside className="flex w-60 flex-col border-r border-ink/10 bg-ink text-foam">
      <div className="border-b border-white/10 px-5 py-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-lagoon-mist/70">
          {portal === "SUPER_ADMIN"
            ? "Super Admin"
            : portal === "HR_ADMIN"
              ? "HR"
              : "Workspace"}
        </p>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight text-foam">
          {PRODUCT_NAME}
        </h1>
        <p className="mt-2 text-xs leading-snug text-lagoon-mist/60">
          {portal === "SUPER_ADMIN"
            ? "Clear payroll & sensitive updates"
            : portal === "HR_ADMIN"
              ? "People ops — seek clearance when needed"
              : null}
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        <div className="mb-2 px-1">
          <NotificationsBell />
        </div>
        {visible.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-brand",
                active
                  ? "bg-lagoon text-foam shadow-soft"
                  : "text-lagoon-mist/75 hover:bg-white/5 hover:text-foam"
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-foam/80"
                />
              )}
              {item.label}
            </Link>
          );
        })}
        {role && can(role, "manageStatutoryRates") && (
          <Link
            href="/settings"
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-brand",
              pathname.startsWith("/settings")
                ? "bg-lagoon text-foam"
                : "text-lagoon-mist/75 hover:bg-white/5 hover:text-foam"
            )}
          >
            Settings
          </Link>
        )}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-foam">
          {session?.user?.name}
        </p>
        <p className="truncate text-xs text-lagoon-mist/55">
          {role ? portalLabel(role) : ""} · {session?.user?.email}
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-3 text-xs text-lagoon-mist/55 transition hover:text-foam"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
