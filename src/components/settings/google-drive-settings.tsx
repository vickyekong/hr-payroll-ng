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
}

export function GoogleDriveSettings() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [folderId, setFolderId] = useState("");
  const [loading, setLoading] = useState(false);
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
      connected: "Google Drive connected successfully.",
      denied: "Google authorization was denied.",
      error: "Google Drive connection failed. Check server logs and OAuth config.",
      missing_code: "Google callback was missing an auth code.",
      invalid_state: "Google callback state was invalid. Try connecting again.",
      forbidden: "Only Super Admin can connect Google Drive.",
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
    if (!confirm("Disconnect Google Drive from this company?")) return;
    setLoading(true);
    const res = await fetch("/api/integrations/google-drive/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disconnect: true }),
    });
    setLoading(false);
    if (res.ok) {
      setMessage("Google Drive disconnected.");
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
      setMessage("Drive folder saved.");
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to save folder");
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Google Drive exports</CardTitle>
        <p className="text-sm text-stone-500">
          Connect a Google account so staff and payroll CSVs can be uploaded to
          Drive.
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
            <code className="font-mono">GOOGLE_CLIENT_SECRET</code> in Vercel env
            vars, then redeploy.
          </p>
        )}

        {status?.connected ? (
          <>
            <p className="text-sm text-stone-700">
              Connected as{" "}
              <span className="font-medium">{status.email ?? "Google account"}</span>
            </p>
            <div>
              <Label htmlFor="folderId">Drive folder ID (optional)</Label>
              <Input
                id="folderId"
                className="mt-1"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="Leave blank to upload to My Drive root"
              />
              <p className="mt-1 text-xs text-stone-500">
                From a Drive folder URL: …/folders/&lt;FOLDER_ID&gt;
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveFolder} disabled={loading}>
                Save folder
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
            {loading ? "Redirecting…" : "Connect Google Drive"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
