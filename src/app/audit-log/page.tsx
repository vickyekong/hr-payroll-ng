"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  changes: Record<string, unknown> | null;
  performedBy: {
    name: string;
    email: string;
    role: string;
  };
}

const ENTITY_TYPES = [
  "",
  "Employee",
  "PayrollRun",
  "PayrollAdjustment",
  "LeaveRequest",
  "StatutoryConfig",
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [entityType, setEntityType] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadLogs = useCallback(
    (cursor?: string, append = false) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "50" });
      if (entityType) params.set("entityType", entityType);
      if (cursor) params.set("cursor", cursor);

      fetch(`/api/audit-logs?${params}`)
        .then((r) => r.json())
        .then((data) => {
          setLogs((prev) =>
            append ? [...prev, ...(data.logs ?? [])] : data.logs ?? []
          );
          setNextCursor(data.nextCursor);
          setHasMore(data.hasMore);
          setLoading(false);
        });
    },
    [entityType]
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function formatChanges(changes: Record<string, unknown> | null): string {
    if (!changes) return "—";
    const text = JSON.stringify(changes);
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Audit log</h1>
          <p className="mt-1 text-sm text-stone-500">
            Immutable record of payroll and HR actions
          </p>
        </div>
        <div>
          <Label htmlFor="entityFilter" className="text-xs text-stone-500">
            Filter by entity
          </Label>
          <select
            id="entityFilter"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="mt-1 flex h-9 rounded-md border border-stone-300 px-3 text-sm"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm text-stone-600">
                    {formatDate(log.timestamp)}{" "}
                    {new Date(log.timestamp).toLocaleTimeString("en-NG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{log.performedBy.name}</p>
                    <p className="text-xs text-stone-400">
                      {log.performedBy.role.replace("_", " ")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="text-stone-500">{log.entityType}</span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-stone-400">
                      {log.entityId.slice(0, 12)}…
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-stone-500">
                    {formatChanges(log.changes)}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-stone-500">
                    No audit entries yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {hasMore && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => nextCursor && loadLogs(nextCursor, true)}
              >
                {loading ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
