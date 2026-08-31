"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TeamInviteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
      body: JSON.stringify({ name, email, role }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Invite failed");
      return;
    }
    setMessage(
      data.message ??
        `Invite sent to ${data.invite?.email}. They'll set their password from the email link.`
    );
    setName("");
    setEmail("");
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Invite team</CardTitle>
        <p className="text-sm text-muted">
          Super Admin only — we email an invite link. Teammates choose their own
          password when they accept.
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
          <div className="sm:col-span-2 sm:max-w-xs">
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
              {loading ? "Sending…" : "Send invite"}
            </Button>
            {message && (
              <p
                className={`text-sm ${
                  message.toLowerCase().includes("sent")
                    ? "text-muted"
                    : "text-signal"
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
