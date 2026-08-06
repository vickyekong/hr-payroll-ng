"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/cn";
import { can } from "@/lib/permissions";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  linkUrl: string;
  readAt: string | null;
  createdAt: string;
  type: string;
}

export function NotificationsBell() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const role = session?.user?.role;
  const showBell = role
    ? can(role, "approvePayroll") || can(role, "manageLeave")
    : false;

  const load = useCallback(() => {
    if (!showBell) return;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setItems(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => undefined);
  }, [showBell]);

  useEffect(() => {
    load();
    if (!showBell) return;
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [showBell, load]);

  if (!showBell) return null;

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    load();
  }

  return (
    <div className="relative mb-2">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-lagoon-mist/80 transition hover:bg-white/5 hover:text-foam"
      >
        <span>Approvals & inbox</span>
        {unreadCount > 0 && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-lagoon px-1.5 py-0.5 text-[10px] font-semibold text-foam">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-auto rounded-xl border border-line bg-foam shadow-soft">
          <div className="flex items-center justify-between border-b border-line/70 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-muted hover:text-ink"
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">No notifications</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className="border-b border-sand last:border-0">
                  <Link
                    href={item.linkUrl.replace(/^https?:\/\/[^/]+/, "") || item.linkUrl}
                    onClick={() => {
                      void markRead(item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "block px-3 py-3 hover:bg-mist",
                      !item.readAt && "bg-lagoon-mist/40"
                    )}
                  >
                    <p className="text-sm font-medium text-ink">
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {item.body}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
