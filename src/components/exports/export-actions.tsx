"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ExportActionsProps {
  kind: "staff" | "payroll";
  runId?: string;
  driveConnected?: boolean;
}

export function ExportActions({
  kind,
  runId,
  driveConnected = false,
}: ExportActionsProps) {
  const [loading, setLoading] = useState<
    "download" | "drive" | "sync" | null
  >(null);

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

  async function uploadToDrive() {
    if (!driveConnected) {
      alert("Connect Google Workspace in Settings first.");
      return;
    }
    setLoading("drive");
    try {
      const res = await fetch(
        kind === "staff" ? "/api/exports/staff" : "/api/exports/payroll",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            kind === "staff"
              ? { destination: "google_drive" }
              : { destination: "google_drive", runId }
          ),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Google Drive upload failed");
      if (data.webViewLink) {
        const open = confirm(
          `Uploaded ${data.filename} to Google Drive Exports.\n\nOpen the file now?`
        );
        if (open) window.open(data.webViewLink, "_blank");
      } else {
        alert(`Uploaded ${data.filename} to Google Drive.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Google Drive upload failed");
    } finally {
      setLoading(null);
    }
  }

  async function syncSheet() {
    if (!driveConnected) {
      alert("Connect Google Workspace in Settings first.");
      return;
    }
    setLoading("sync");
    try {
      const res = await fetch("/api/exports/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "staff"
            ? { type: "staff" }
            : { type: "payroll", runId }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Workspace sync failed");
      const link = data.result?.webViewLink;
      if (link) {
        const open = confirm(
          `Synced ${data.result.rowCount} rows to Google Sheets.\n\nOpen the spreadsheet?`
        );
        if (open) window.open(link, "_blank");
      } else {
        alert(`Synced ${data.result?.rowCount ?? 0} rows to Google Sheets.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Workspace sync failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={download}
        disabled={loading !== null || (kind === "payroll" && !runId)}
      >
        {loading === "download" ? "Exporting…" : "Export CSV"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={uploadToDrive}
        disabled={loading !== null || (kind === "payroll" && !runId)}
      >
        {loading === "drive" ? "Uploading…" : "Save file to Drive"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={syncSheet}
        disabled={loading !== null || (kind === "payroll" && !runId)}
      >
        {loading === "sync"
          ? "Syncing…"
          : kind === "staff"
            ? "Sync staff Sheet"
            : "Sync payroll Sheet"}
      </Button>
    </div>
  );
}
