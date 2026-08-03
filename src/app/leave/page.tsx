"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { countWorkingDaysBetween } from "@/lib/leave/unpaid-leave";

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason?: string;
  employee?: { firstName: string; lastName: string; employeeCode: string };
}

interface LeaveBalance {
  id: string;
  leaveType: string;
  entitledDays: number;
  usedDays: number;
  remainingDays: number;
  employee?: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    department: string;
  };
}

export default function LeavePage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [computedDays, setComputedDays] = useState<number | null>(null);
  const [formError, setFormError] = useState("");

  function load() {
    fetch("/api/leave")
      .then((r) => r.json())
      .then(setRequests);
    fetch("/api/leave/balances")
      .then((r) => r.json())
      .then(setBalances);
  }

  useEffect(() => {
    load();
  }, []);

  function updateComputedDays(start: string, end: string) {
    if (!start || !end) {
      setComputedDays(null);
      return;
    }
    const days = countWorkingDaysBetween(new Date(start), new Date(end));
    setComputedDays(days);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const form = new FormData(e.currentTarget);
    const startDate = form.get("startDate") as string;
    const endDate = form.get("endDate") as string;
    const days = computedDays ?? countWorkingDaysBetween(new Date(startDate), new Date(endDate));

    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.get("type"),
        startDate,
        endDate,
        days,
        reason: form.get("reason"),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setComputedDays(null);
      load();
    } else {
      const data = await res.json();
      setFormError(data.error ?? "Failed to submit request");
    }
  }

  async function approve(id: string, action: "approve" | "reject") {
    await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  const isEmployee = session?.user?.role === "EMPLOYEE";

  return (
    <AppShell>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Leave</h1>
          <p className="mt-1 text-sm text-stone-500">
            Balances, requests, and approvals
          </p>
        </div>
        {isEmployee && (
          <Button onClick={() => setShowForm(!showForm)}>
            Request leave
          </Button>
        )}
      </div>

      {balances.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {isEmployee ? "My leave balances" : "Team leave balances"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {!isEmployee && <TableHead>Employee</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Entitled</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b) => (
                  <TableRow key={b.id}>
                    {!isEmployee && (
                      <TableCell>
                        {b.employee
                          ? `${b.employee.firstName} ${b.employee.lastName}`
                          : "—"}
                      </TableCell>
                    )}
                    <TableCell>{b.leaveType.replace("_", " ")}</TableCell>
                    <TableCell>{b.entitledDays}</TableCell>
                    <TableCell>{b.usedDays}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {b.remainingDays}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6 max-w-lg">
          <CardHeader>
            <CardTitle>New leave request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                  required
                >
                  <option value="ANNUAL">Annual</option>
                  <option value="SICK">Sick</option>
                  <option value="MATERNITY">Maternity</option>
                  <option value="PATERNITY">Paternity</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="startDate">Start</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    required
                    className="mt-1"
                    onChange={(e) => {
                      const end = (document.getElementById("endDate") as HTMLInputElement)?.value;
                      updateComputedDays(e.target.value, end);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    required
                    className="mt-1"
                    onChange={(e) => {
                      const start = (document.getElementById("startDate") as HTMLInputElement)?.value;
                      updateComputedDays(start, e.target.value);
                    }}
                  />
                </div>
              </div>
              {computedDays !== null && (
                <p className="text-sm text-stone-600">
                  Working days: <span className="font-medium">{computedDays}</span>
                  {computedDays < 1 && " — select dates that include a weekday"}
                </p>
              )}
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" name="reason" className="mt-1" />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button type="submit" disabled={computedDays !== null && computedDays < 1}>
                Submit request
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {!isEmployee && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                {!isEmployee && (
                  <TableCell>
                    {r.employee
                      ? `${r.employee.firstName} ${r.employee.lastName}`
                      : "—"}
                  </TableCell>
                )}
                <TableCell>{r.type.replace("_", " ")}</TableCell>
                <TableCell>
                  {formatDate(r.startDate)} – {formatDate(r.endDate)}
                </TableCell>
                <TableCell>{r.days}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.status === "APPROVED"
                        ? "success"
                        : r.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.status === "PENDING" && !isEmployee && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approve(r.id, "approve")}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approve(r.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
