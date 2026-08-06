"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface LifecycleTask {
  id: string;
  key: string;
  title: string;
  description: string | null;
  href: string | null;
  status: string;
  sortOrder: number;
}

interface Lifecycle {
  id: string;
  kind: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  tasks: LifecycleTask[];
}

export function EmployeeLifecyclePanel({ employeeId }: { employeeId: string }) {
  const [items, setItems] = useState<Lifecycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/employees/${employeeId}/lifecycle`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function start(kind: "ONBOARDING" | "OFFBOARDING") {
    setBusy(true);
    const res = await fetch(`/api/employees/${employeeId}/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to start checklist");
      return;
    }
    load();
  }

  async function setTask(
    taskId: string,
    status: "DONE" | "SKIPPED"
  ) {
    setBusy(true);
    const res = await fetch(
      `/api/employees/${employeeId}/lifecycle/tasks/${taskId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Update failed");
      return;
    }
    load();
  }

  if (loading) {
    return (
      <p className="text-sm text-stone-500">Loading lifecycle checklists…</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => start("ONBOARDING")}
        >
          Start / refresh onboarding
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => start("OFFBOARDING")}
        >
          Start offboarding
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a
            href={`/api/employees/${employeeId}/letters/employment-verification`}
            download
          >
            Employment verification PDF
          </a>
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-stone-500">
          No checklists yet. Use the buttons above to start onboarding or
          offboarding for this staff member. New hires also get onboarding
          automatically when created.
        </p>
      ) : (
        items.map((lc) => {
          const done = lc.tasks.filter((t) => t.status === "DONE").length;
          const total = lc.tasks.length;
          return (
            <div
              key={lc.id}
              className="rounded-lg border border-stone-200 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {lc.kind === "ONBOARDING" ? "Onboarding" : "Offboarding"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {lc.status} · {done}/{total} tasks complete
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-stone-100">
                {lc.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">
                        <span
                          className={
                            task.status === "DONE"
                              ? "text-emerald-700"
                              : task.status === "SKIPPED"
                                ? "text-stone-400"
                                : "text-amber-700"
                          }
                        >
                          [{task.status}]
                        </span>{" "}
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-stone-500">
                          {task.description}
                        </p>
                      )}
                      {task.href && (
                        <Link
                          href={task.href}
                          className="mt-1 inline-block text-xs text-stone-700 hover:underline"
                        >
                          Open →
                        </Link>
                      )}
                    </div>
                    {lc.status === "OPEN" && task.status === "PENDING" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => setTask(task.id, "DONE")}
                        >
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setTask(task.id, "SKIPPED")}
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
