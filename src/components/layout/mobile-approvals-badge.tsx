"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";

/** Compact approvals entry for the mobile top bar. */
export function MobileApprovalsBadge() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [href, setHref] = useState("/payroll");

  const role = session?.user?.role;
  const show = role
    ? can(role, "approvePayroll") || can(role, "manageLeave")
    : false;

  const load = useCallback(() => {
    if (!show) return;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setUnreadCount(data.unreadCount ?? 0);
        const first = (data.notifications ?? []).find(
          (n: { readAt: string | null; linkUrl: string; type: string }) =>
            !n.readAt && n.type === "PAYROLL_REVIEW"
        );
        if (first?.linkUrl) {
          const path = String(first.linkUrl).replace(/^https?:\/\/[^/]+/, "");
          setHref(path.includes("step=") ? path : `${path}${path.includes("?") ? "&" : "?"}step=4`);
        } else {
          setHref("/payroll");
        }
      })
      .catch(() => undefined);
  }, [show]);

  useEffect(() => {
    load();
    if (!show) return;
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [show, load]);

  if (!show) return null;

  return (
    <Link
      href={href}
      aria-label={
        unreadCount > 0
          ? `${unreadCount} pending approvals`
          : "Approvals inbox"
      }
      className="relative inline-flex h-10 items-center justify-center rounded-lg border border-line bg-mist px-3 text-sm font-medium text-ink transition hover:border-lagoon/40"
    >
      Clear
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-md bg-lagoon px-1 py-0.5 text-[10px] font-semibold text-foam">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
