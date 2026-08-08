"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TeamInviteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"HR_ADMIN" | "SUPER_ADMIN">("HR_ADMIN");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Invite failed");
      return;
    }
    setMessage(
      `Invited ${data.user?.name} (${data.user?.email}) as ${
        role === "HR_ADMIN" ? "HR" : "Super Admin"
      }. Share the password securely.`
    );
    setName("");
    setEmail("");
    setPassword("");
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Invite team</CardTitle>
        <p className="text-sm text-muted">
          Super Admin only — create HR or another Super Admin for this company.
          Demo Acme accounts are separate and unchanged.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              required
              minLength={2}
            />
          </div>
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="invite-password">Temporary password</Label>
            <Input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              required
              minLength={8}
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "HR_ADMIN" | "SUPER_ADMIN")
              }
              className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
            >
              <option value="HR_ADMIN">HR Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="brand" disabled={loading}>
              {loading ? "Inviting…" : "Invite"}
            </Button>
            {message && (
              <p
                className={`text-sm ${
                  message.startsWith("Invited") ? "text-muted" : "text-signal"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
