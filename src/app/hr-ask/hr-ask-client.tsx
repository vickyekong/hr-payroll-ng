"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

interface QueryDef {
  id: string;
  label: string;
  hint: string;
}

interface AskResult {
  id: string;
  title: string;
  summary: string;
  href?: string;
  rows: Array<Record<string, string>>;
}

interface PendingChange {
  id: string;
  type: string;
  status: string;
  payload: Record<string, string>;
  note: string | null;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: string;
  };
  createdAt: string;
}

export default function HrAskClient() {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const canApproveChanges = role ? can(role, "approveChangeRequests") : false;
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "changes" ? "changes" : "ask";
  const [tab, setTab] = useState<"ask" | "changes">(initialTab);
  const [queries, setQueries] = useState<QueryDef[]>([]);
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hr-ask")
      .then((r) => r.json())
      .then((data) => setQueries(data.queries ?? []));
  }, []);

  useEffect(() => {
    if (tab !== "changes") return;
    fetch("/api/change-requests?scope=pending")
      .then((r) => r.json())
      .then((data) => setPending(Array.isArray(data) ? data : []));
  }, [tab]);

  async function runQuery(id: string) {
    setLoading(true);
    const res = await fetch(`/api/hr-ask?q=${encodeURIComponent(id)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Query failed");
      return;
    }
    setResult(data);
  }

  async function review(requestId: string, action: "approve" | "reject") {
    setBusyId(requestId);
    const res = await fetch("/api/change-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      alert(data.error ?? "Action failed");
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== requestId));
  }

  const columns = useMemo(() => {
    if (!result?.rows.length) return [] as string[];
    return Object.keys(result.rows[0]);
  }, [result]);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">HR Ask</h1>
        <p className="mt-1 text-sm text-stone-500">
          Policy &amp; query desk — plus change requests HR logs for Super Admin
          approval
        </p>
      </div>

      <div className="mb-6 flex gap-2">
        <Button
          variant={tab === "ask" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("ask")}
        >
          Ask HR
        </Button>
        <Button
          variant={tab === "changes" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("changes")}
        >
          Change requests
        </Button>
      </div>

      {tab === "ask" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {queries.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => runQuery(q.id)}
                  className="block w-full rounded-md border border-stone-200 px-3 py-2 text-left text-sm hover:bg-stone-50"
                >
                  <span className="font-medium text-stone-900">{q.label}</span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {q.hint}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{result?.title ?? "Results"}</CardTitle>
              {result && (
                <p className="text-sm text-stone-500">{result.summary}</p>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-stone-500">Running…</p>
              ) : !result ? (
                <p className="text-sm text-stone-500">
                  Pick a question to generate a live report from staff, leave,
                  onboarding, and payroll data.
                </p>
              ) : result.rows.length === 0 ? (
                <p className="text-sm text-stone-500">No matching rows.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c} className="capitalize">
                          {c.replace(/([A-Z])/g, " $1")}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((c) => (
                          <TableCell key={c}>{row[c]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "changes" && (
        <Card>
          <CardHeader>
            <CardTitle>Pending employee updates</CardTitle>
            <p className="text-sm text-stone-500">
              {canApproveChanges
                ? "HR logged these for your approval — approve to write into the employee record, or reject."
                : "Logged for Super Admin approval. You can view the queue; only Super Admin can approve or reject."}
            </p>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-sm text-stone-500">Inbox clear.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {pending.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {r.employee.firstName} {r.employee.lastName} (
                        {r.employee.employeeCode}) ·{" "}
                        {r.type.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {r.employee.department} ·{" "}
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                      <pre className="mt-2 overflow-x-auto rounded bg-stone-50 px-2 py-1 text-xs text-stone-700">
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                      {r.note && (
                        <p className="mt-1 text-xs text-stone-600">
                          Note: {r.note}
                        </p>
                      )}
                    </div>
                    {canApproveChanges ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => review(r.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => review(r.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-amber-700">
                        Awaiting Super Admin
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
