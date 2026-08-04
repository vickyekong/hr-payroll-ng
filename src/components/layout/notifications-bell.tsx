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
  const canApprove = role ? can(role, "approvePayroll") : false;

  const load = useCallback(() => {
    if (!canApprove) return;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setItems(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => undefined);
  }, [canApprove]);

  useEffect(() => {
    load();
    if (!canApprove) return;
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [canApprove, load]);

  if (!canApprove) return null;

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
    <div className="relative mb-2 px-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      >
        <span>Approvals</span>
        {unreadCount > 0 && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-30 mt-1 max-h-80 overflow-auto rounded-lg border border-stone-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-stone-500 hover:text-stone-900"
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-stone-500">No notifications</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className="border-b border-stone-50 last:border-0">
                  <Link
                    href={item.linkUrl.replace(/^https?:\/\/[^/]+/, "") || item.linkUrl}
                    onClick={() => {
                      void markRead(item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "block px-3 py-3 hover:bg-stone-50",
                      !item.readAt && "bg-amber-50/60"
                    )}
                  >
                    <p className="text-sm font-medium text-stone-900">
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">
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
