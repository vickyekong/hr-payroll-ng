"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { employeeFullName } from "@/lib/utils";

interface OpenLifecycle {
  id: string;
  kind: "ONBOARDING" | "OFFBOARDING" | string;
  startedAt: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: string;
  };
  tasks: Array<{ status: string }>;
}

export function OpenLifecycleQueue() {
  const [items, setItems] = useState<OpenLifecycle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/lifecycle")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <p className="mb-6 text-sm text-stone-500">
        Loading onboarding / offboarding queue…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-sm font-medium text-stone-800">
          Onboarding &amp; offboarding
        </p>
        <p className="mt-0.5 text-sm text-stone-500">
          No open checklists. Open any staff profile to start onboarding or
          offboarding for them.
        </p>
      </div>
    );
  }

  const onboarding = items.filter((i) => i.kind === "ONBOARDING");
  const offboarding = items.filter((i) => i.kind === "OFFBOARDING");

  return (
    <div className="mb-6 rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-4 py-3">
        <p className="text-sm font-semibold text-stone-900">
          Onboarding &amp; offboarding queue
        </p>
        <p className="mt-0.5 text-xs text-stone-500">
          HR checklists for staff — open a profile to mark tasks done
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <QueueColumn
          title="Onboarding"
          empty="No open onboarding"
          items={onboarding}
        />
        <QueueColumn
          title="Offboarding"
          empty="No open offboarding"
          items={offboarding}
          borderLeft
        />
      </div>
    </div>
  );
}

function QueueColumn({
  title,
  empty,
  items,
  borderLeft,
}: {
  title: string;
  empty: string;
  items: OpenLifecycle[];
  borderLeft?: boolean;
}) {
  return (
    <div
      className={
        borderLeft ? "border-t border-stone-100 md:border-l md:border-t-0" : ""
      }
    >
      <p className="border-b border-stone-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-stone-400">
        {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-stone-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-stone-50">
          {items.map((lc) => {
            const pending = lc.tasks.filter((t) => t.status === "PENDING")
              .length;
            const done = lc.tasks.filter((t) => t.status === "DONE").length;
            return (
              <li key={lc.id}>
                <Link
                  href={`/employees/${lc.employee.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-stone-50"
                >
                  <p className="text-sm font-medium text-stone-900">
                    {employeeFullName(
                      lc.employee.firstName,
                      lc.employee.lastName
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    {lc.employee.employeeCode} · {lc.employee.department} ·{" "}
                    {done}/{lc.tasks.length} done
                    {pending > 0 ? ` · ${pending} pending` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
