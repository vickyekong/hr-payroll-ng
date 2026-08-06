"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DriveStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  folderId: string | null;
  connectedAt: string | null;
  staffSpreadsheetId: string | null;
  payrollSpreadsheetId: string | null;
  lastStaffSyncAt: string | null;
  lastPayrollSyncAt: string | null;
  workspaceDomain: string | null;
}

export function GoogleDriveSettings() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [folderId, setFolderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/integrations/google-drive")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        setFolderId(data.folderId ?? "");
      });
  }

  useEffect(() => {
    load();
    const result = searchParams.get("googleDrive");
    if (!result) return;
    const messages: Record<string, string> = {
      connected:
        "Google Workspace connected. You can sync staff and payroll databases now.",
      denied: "Google authorization was denied.",
      error:
        "Google Workspace connection failed. Check OAuth config and try again.",
      missing_code: "Google callback was missing an auth code.",
      invalid_state: "Google callback state was invalid. Try connecting again.",
      forbidden: "Only Super Admin can connect Google Workspace.",
    };
    setMessage(messages[result] ?? null);
  }, [searchParams]);

  async function connect() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/google-drive", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start Google OAuth");
      window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to connect");
      setLoading(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Workspace from this company?")) return;
    setLoading(true);
    const res = await fetch("/api/integrations/google-drive/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disconnect: true }),
    });
    setLoading(false);
    if (res.ok) {
      setMessage("Google Workspace disconnected.");
      load();
    }
  }

  async function saveFolder() {
    setLoading(true);
    const res = await fetch("/api/integrations/google-drive/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: folderId.trim() || null }),
    });
    setLoading(false);
    if (res.ok) {
      setMessage("Workspace folder saved.");
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to save folder");
    }
  }

  async function syncAll() {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/google-workspace/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const links = (data.results ?? [])
        .map((r: { type: string; webViewLink?: string }) => r.webViewLink)
        .filter(Boolean);
      setMessage(
        `Synced staff and payroll to Google Workspace${
          data.results?.[0] ? ` (${data.results.map((r: { rowCount: number }) => r.rowCount).join(" / ")} rows)` : ""
        }.`
      );
      load();
      if (links[0] && confirm("Open the staff spreadsheet in Google Sheets?")) {
        window.open(links[0], "_blank");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Google Workspace sync</CardTitle>
        <p className="text-sm text-stone-500">
          Connect your Workspace account to keep a shared HR folder, staff
          spreadsheet database, payroll Sheets, and the HR Desk company inbox
          (Gmail). Reconnect once after deploy so Gmail read + draft access is
          granted.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
            {message}
          </p>
        )}

        {!status?.configured && (
          <p className="text-sm text-amber-700">
            Add <code className="font-mono">GOOGLE_CLIENT_ID</code> and{" "}
            <code className="font-mono">GOOGLE_CLIENT_SECRET</code> in Vercel,
            optionally <code className="font-mono">GOOGLE_WORKSPACE_DOMAIN</code>{" "}
            (e.g. yourcompany.com) to auto-share with the domain, then redeploy.
          </p>
        )}

        {status?.connected ? (
          <>
            <p className="text-sm text-stone-700">
              Connected as{" "}
              <span className="font-medium">
                {status.email ?? "Google account"}
              </span>
              {status.workspaceDomain
                ? ` · sharing with @${status.workspaceDomain}`
                : null}
            </p>

            <div className="grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
              <div>
                Staff database:{" "}
                {status.staffSpreadsheetId ? (
                  <a
                    className="text-stone-900 underline"
                    href={`https://docs.google.com/spreadsheets/d/${status.staffSpreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Sheet
                  </a>
                ) : (
                  "Not synced yet"
                )}
                {status.lastStaffSyncAt && (
                  <span className="block text-xs text-stone-400">
                    Last sync {new Date(status.lastStaffSyncAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div>
                Payroll database:{" "}
                {status.payrollSpreadsheetId ? (
                  <a
                    className="text-stone-900 underline"
                    href={`https://docs.google.com/spreadsheets/d/${status.payrollSpreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Sheet
                  </a>
                ) : (
                  "Not synced yet"
                )}
                {status.lastPayrollSyncAt && (
                  <span className="block text-xs text-stone-400">
                    Last sync{" "}
                    {new Date(status.lastPayrollSyncAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="folderId">Root Drive folder ID (optional)</Label>
              <Input
                id="folderId"
                className="mt-1"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="Leave blank to auto-create “OmniPeople”"
              />
              <p className="mt-1 text-xs text-stone-500">
                Sync creates Staff, Payroll, and Exports folders under this root.
                Use a Shared Drive folder ID for company-wide access.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={syncAll} disabled={syncing || loading}>
                {syncing ? "Syncing…" : "Sync staff + payroll now"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={saveFolder}
                disabled={loading}
              >
                Save folder
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={connect}
                disabled={loading}
              >
                Reconnect
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={disconnect}
                disabled={loading}
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button
            type="button"
            onClick={connect}
            disabled={loading || !status?.configured}
          >
            {loading ? "Redirecting…" : "Connect Google Workspace"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
