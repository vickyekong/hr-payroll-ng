"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  HR_DESK_REPLY_TEMPLATES,
  previewTemplateBody,
  type ReplyTemplateId,
} from "@/lib/hr-desk/templates";

interface EmployeeOption {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: string;
}

interface HrUserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DeskMessage {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  snippet: string;
  bodyText: string | null;
  receivedAt: string;
  category: string;
  status: string;
  employeeId: string | null;
  assigneeUserId?: string | null;
  draftMessageId: string | null;
  notes: string | null;
  employee?: EmployeeOption | null;
  assigneeUser?: HrUserOption | null;
}

function categoryVariant(
  category: string
): "default" | "info" | "warning" | "danger" | "success" {
  switch (category) {
    case "LEAVE":
      return "info";
    case "PAYROLL":
      return "success";
    case "COMPLAINT":
    case "RESIGNATION":
      return "danger";
    case "INQUIRY":
      return "warning";
    default:
      return "default";
  }
}

export default function HrDeskClient() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const [loading, setLoading] = useState(false);
  const [mailbox, setMailbox] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<DeskMessage[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [hrUsers, setHrUsers] = useState<HrUserOption[]>([]);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [notes, setNotes] = useState("");
  const [templateId, setTemplateId] = useState<ReplyTemplateId>("standard_approve");
  const [draftPreview, setDraftPreview] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [banner, setBanner] = useState("");

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (status) qs.set("status", status);
    const res = await fetch(`/api/hr-desk?${qs}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setBanner(data.error ?? "Failed to load");
      return;
    }
    setMailbox(data.mailbox ?? null);
    setLastSyncAt(data.lastSyncAt ?? null);
    setConnected(Boolean(data.connected));
    setMessages(data.messages ?? []);
    setEmployees(data.employees ?? []);
    setHrUsers(data.hrUsers ?? []);
  }, [category, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

  async function syncMail() {
    setLoading(true);
    setBanner("");
    const res = await fetch("/api/hr-desk/sync", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setBanner(data.error ?? "Sync failed");
      return;
    }
    setBanner(
      `Synced ${data.imported} new mail(s) from ${data.mailbox ?? "inbox"} (${data.scanned} scanned).`
    );
    await load();
  }

  async function patchSelected(payload: Record<string, unknown>) {
    if (!selected) return;
    setLoading(true);
    const res = await fetch(`/api/hr-desk/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setBanner(data.error ?? "Update failed");
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === data.id ? { ...m, ...data } : m))
    );
    if (data.draftPreview) setDraftPreview(data.draftPreview);
    return data;
  }

  async function assignStaff(employeeId: string) {
    await patchSelected({ employeeId: employeeId || null });
  }

  async function assignHrUser(assigneeUserId: string) {
    await patchSelected({ assigneeUserId: assigneeUserId || null });
  }

  async function setCategoryForSelected(next: string) {
    await patchSelected({ category: next });
  }

  async function setStatusForSelected(next: string) {
    const data = await patchSelected({ status: next });
    if (data) setBanner(`Status set to ${next}.`);
  }

  async function decide(action: "approve" | "reject") {
    if (!selected) return;
    setDraftPreview(null);
    const data = await patchSelected({
      action,
      notes: notes || undefined,
      templateId:
        action === "approve"
          ? templateId === "standard_reject"
            ? "standard_approve"
            : templateId
          : templateId === "standard_approve"
            ? "standard_reject"
            : templateId,
    });
    if (!data) return;
    setBanner(
      data.draftId
        ? "Decision saved. A draft reply was created in Gmail for HR to review and send."
        : "Decision saved."
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">HR Desk</h1>
          <p className="mt-1 text-sm text-stone-500">
            Company inbox — triage, assign to HR and staff, use reply templates,
            approve/reject with Gmail drafts
          </p>
          <p className="mt-2 text-xs text-stone-500">
            {connected
              ? `Mailbox: ${mailbox ?? "connected"}`
              : "Google Workspace not connected"}
            {lastSyncAt
              ? ` · Last sync ${new Date(lastSyncAt).toLocaleString()}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/settings">Google settings</Link>
          </Button>
          <Button
            onClick={() => void syncMail()}
            disabled={loading || !connected}
          >
            {loading ? "Working…" : "Sync inbox"}
          </Button>
        </div>
      </div>

      {!connected && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-stone-700">
            Connect Google Workspace in Settings using the company HR email,
            then reconnect once so Gmail read + draft permissions are granted.
          </CardContent>
        </Card>
      )}

      {banner && (
        <p className="mb-4 rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
          {banner}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div>
          <Label>Category</Label>
          <select
            className="mt-1 flex h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All</option>
            <option value="LEAVE">Leave</option>
            <option value="PAYROLL">Payroll</option>
            <option value="RESIGNATION">Resignation</option>
            <option value="COMPLAINT">Complaint</option>
            <option value="INQUIRY">Inquiry</option>
            <option value="GENERAL">General</option>
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select
            className="mt-1 flex h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="NEW">New</option>
            <option value="TRIAGED">Triaged</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="max-h-[42vh] overflow-auto rounded-xl border border-line/80 bg-foam/95 shadow-soft lg:max-h-[70vh]">
          {messages.length === 0 ? (
            <p className="p-4 text-sm text-stone-500">
              {loading
                ? "Loading…"
                : "No messages yet. Sync the company inbox."}
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(m.id);
                      setDraftPreview(null);
                      setNotes(m.notes ?? "");
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-stone-50 ${
                      selectedId === m.id ? "bg-amber-50/70" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={categoryVariant(m.category)}>
                        {m.category.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-[11px] text-stone-400">
                        {new Date(m.receivedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-stone-900">
                      {m.subject}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {m.status}
                      {m.assigneeUser ? ` · ${m.assigneeUser.name}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Card>
          {!selected ? (
            <CardContent className="pt-6 text-sm text-stone-500">
              Select a mail to triage.
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={categoryVariant(selected.category)}>
                    {selected.category.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="default">{selected.status}</Badge>
                </div>
                <CardTitle className="mt-2 text-xl">{selected.subject}</CardTitle>
                <p className="text-sm text-stone-500">
                  From {selected.fromName || selected.fromEmail} ·{" "}
                  {new Date(selected.receivedAt).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-stone-100 bg-stone-50 p-3 text-sm text-stone-700">
                  {selected.bodyText || selected.snippet}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Sort category</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
                      value={selected.category}
                      onChange={(e) =>
                        void setCategoryForSelected(e.target.value)
                      }
                    >
                      <option value="LEAVE">Leave</option>
                      <option value="PAYROLL">Payroll</option>
                      <option value="RESIGNATION">Resignation</option>
                      <option value="COMPLAINT">Complaint</option>
                      <option value="INQUIRY">Inquiry</option>
                      <option value="GENERAL">General</option>
                    </select>
                  </div>
                  <div>
                    <Label>Assign to requesting staff</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
                      value={selected.employeeId ?? ""}
                      onChange={(e) => void assignStaff(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.employeeCode} · {e.firstName} {e.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Assign to HR user</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
                      value={selected.assigneeUserId ?? ""}
                      onChange={(e) => void assignHrUser(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {hrUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role.replace("_", " ")})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Workflow status</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading || selected.status === "TRIAGED"}
                        onClick={() => void setStatusForSelected("TRIAGED")}
                      >
                        Mark triaged
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading || selected.status === "CLOSED"}
                        onClick={() => void setStatusForSelected("CLOSED")}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="replyTemplate">Reply template</Label>
                  <select
                    id="replyTemplate"
                    className="mt-1 flex h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
                    value={templateId}
                    onChange={(e) =>
                      setTemplateId(e.target.value as ReplyTemplateId)
                    }
                  >
                    {HR_DESK_REPLY_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-stone-100 bg-stone-50 p-2 text-[11px] text-stone-600">
                    {previewTemplateBody(templateId, selected.category)}
                  </pre>
                </div>

                <div>
                  <Label htmlFor="hrNotes">
                    HR note (optional, included in draft)
                  </Label>
                  <textarea
                    id="hrNotes"
                    className="mt-1 min-h-[72px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={loading || !selected.employeeId}
                    onClick={() => void decide("approve")}
                  >
                    Approve & draft reply
                  </Button>
                  <Button
                    variant="outline"
                    disabled={loading || !selected.employeeId}
                    onClick={() => void decide("reject")}
                  >
                    Reject & draft reply
                  </Button>
                </div>

                {!selected.employeeId && (
                  <p className="text-xs text-amber-700">
                    Assign the requesting staff member before approving or
                    rejecting.
                  </p>
                )}

                {draftPreview && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-sm font-medium text-stone-900">
                      Draft created in Gmail
                    </p>
                    <p className="mt-2 text-xs font-medium text-stone-600">
                      Subject: {draftPreview.subject}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-stone-700">
                      {draftPreview.body}
                    </pre>
                    <p className="mt-2 text-xs text-stone-500">
                      Open Gmail Drafts to review and send.
                    </p>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
