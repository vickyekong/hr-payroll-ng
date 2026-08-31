"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkspaceConnections } from "@/components/exports/workspace-connections";

interface ExportActionsProps {
  kind: "staff" | "payroll";
  runId?: string;
  connections?: WorkspaceConnections;
}

type LoadingKey =
  | "download"
  | "google-drive"
  | "google-sync"
  | "microsoft-drive"
  | "microsoft-sync"
  | null;

export function ExportActions({
  kind,
  runId,
  connections = { google: false, microsoft: false },
}: ExportActionsProps) {
  const [loading, setLoading] = useState<LoadingKey>(null);

  const disabled = loading !== null || (kind === "payroll" && !runId);
  const hasCloud = connections.google || connections.microsoft;

  async function download() {
    setLoading("download");
    try {
      const url =
        kind === "staff"
          ? "/api/exports/staff"
          : `/api/exports/payroll?runId=${encodeURIComponent(runId!)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${kind}-export.csv`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(null);
    }
  }

  async function uploadCsv(provider: "google" | "microsoft") {
    const connected =
      provider === "google" ? connections.google : connections.microsoft;
    if (!connected) {
      alert(
        provider === "google"
          ? "Connect Google Workspace in Settings first."
          : "Connect Microsoft 365 in Settings first."
      );
      return;
    }

    const loadingKey: LoadingKey =
      provider === "google" ? "google-drive" : "microsoft-drive";
    setLoading(loadingKey);
    try {
      const destination =
        provider === "google" ? "google_drive" : "microsoft_onedrive";
      const res = await fetch(
        kind === "staff" ? "/api/exports/staff" : "/api/exports/payroll",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            kind === "staff"
              ? { destination }
              : { destination, runId }
          ),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ??
            (provider === "google"
              ? "Google Drive upload failed"
              : "OneDrive upload failed")
        );
      }
      const label = provider === "google" ? "Google Drive" : "OneDrive";
      if (data.webViewLink) {
        const open = confirm(
          `Uploaded ${data.filename} to ${label} Exports.\n\nOpen the file now?`
        );
        if (open) window.open(data.webViewLink, "_blank");
      } else {
        alert(`Uploaded ${data.filename} to ${label}.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(null);
    }
  }

  async function syncWorkbook(provider: "google" | "microsoft") {
    const connected =
      provider === "google" ? connections.google : connections.microsoft;
    if (!connected) {
      alert(
        provider === "google"
          ? "Connect Google Workspace in Settings first."
          : "Connect Microsoft 365 in Settings first."
      );
      return;
    }

    const loadingKey: LoadingKey =
      provider === "google" ? "google-sync" : "microsoft-sync";
    setLoading(loadingKey);
    try {
      const res = await fetch("/api/exports/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "staff"
            ? { type: "staff", provider }
            : { type: "payroll", runId, provider }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Workspace sync failed");

      const link = data.result?.webViewLink;
      const rowCount = data.result?.rowCount ?? 0;
      const target =
        provider === "google" ? "Google Sheets" : "Excel workbook";
      if (link) {
        const open = confirm(
          `Synced ${rowCount} rows to ${target}.\n\nOpen the file now?`
        );
        if (open) window.open(link, "_blank");
      } else {
        alert(`Synced ${rowCount} rows to ${target}.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Workspace sync failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={download}
          disabled={disabled}
        >
          {loading === "download" ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {connections.google && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Google
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => uploadCsv("google")}
            disabled={disabled}
          >
            {loading === "google-drive" ? "Uploading…" : "Save CSV to Drive"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => syncWorkbook("google")}
            disabled={disabled}
          >
            {loading === "google-sync"
              ? "Syncing…"
              : kind === "staff"
                ? "Sync staff Sheet"
                : "Sync payroll Sheet"}
          </Button>
        </div>
      )}

      {connections.microsoft && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Microsoft
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => uploadCsv("microsoft")}
            disabled={disabled}
          >
            {loading === "microsoft-drive" ? "Uploading…" : "Save CSV to OneDrive"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => syncWorkbook("microsoft")}
            disabled={disabled}
          >
            {loading === "microsoft-sync"
              ? "Syncing…"
              : kind === "staff"
                ? "Sync staff workbook"
                : "Sync payroll workbook"}
          </Button>
        </div>
      )}

      {!hasCloud && (
        <p className="text-xs text-muted">
          Connect{" "}
          <Link href="/settings" className="text-lagoon underline underline-offset-2">
            Google Workspace or Microsoft 365
          </Link>{" "}
          in Settings to upload CSVs or sync live workbooks.
        </p>
      )}
    </div>
  );
}
