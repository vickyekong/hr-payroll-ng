"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TwoFactorSettings() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/2fa")
      .then((r) => r.json())
      .then((d) => setTotpEnabled(Boolean(d.totpEnabled)))
      .catch(() => undefined);
  }, []);

  async function startSetup() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Could not start 2FA setup");
      return;
    }
    setSetupSecret(data.secret);
    setOtpauthUri(data.otpauthUri);
    setConfirmCode("");
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/2fa/setup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: confirmCode }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Invalid code");
      return;
    }
    setTotpEnabled(true);
    setSetupSecret(null);
    setOtpauthUri(null);
    setMessage("Two-factor authentication is now enabled.");
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/2fa/setup", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePassword, code: disableCode }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Could not disable 2FA");
      return;
    }
    setTotpEnabled(false);
    setDisablePassword("");
    setDisableCode("");
    setMessage("Two-factor authentication disabled.");
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <p className="text-sm text-muted">
          Add an authenticator app (Google Authenticator, 1Password, etc.) for an
          extra sign-in step.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && <p className="text-sm text-muted">{message}</p>}

        {totpEnabled ? (
          <form onSubmit={disable2fa} className="grid gap-3 sm:max-w-md">
            <p className="text-sm text-ok">2FA is enabled on your account.</p>
            <div>
              <Label htmlFor="disable-password">Current password</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="disable-code">Authenticator code</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <Button type="submit" variant="outline" disabled={loading}>
              Disable 2FA
            </Button>
          </form>
        ) : setupSecret ? (
          <form onSubmit={confirmSetup} className="grid gap-3 sm:max-w-md">
            <p className="text-sm text-muted">
              Scan this secret in your authenticator app, or open the otpauth
              link on your phone.
            </p>
            <code className="block break-all rounded-md bg-sand px-2 py-1 text-xs">
              {setupSecret}
            </code>
            {otpauthUri && (
              <a
                href={otpauthUri}
                className="text-sm text-lagoon underline underline-offset-2"
              >
                Open in authenticator app
              </a>
            )}
            <div>
              <Label htmlFor="confirm-code">6-digit code</Label>
              <Input
                id="confirm-code"
                inputMode="numeric"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="brand" disabled={loading}>
                Confirm &amp; enable
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSetupSecret(null);
                  setOtpauthUri(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="brand" onClick={startSetup} disabled={loading}>
            Set up authenticator
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
