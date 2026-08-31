"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/lib/brand";

type InvitePreview = {
  email: string;
  name: string;
  role: string;
  companyName: string;
  inviterName: string;
};

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("Missing invite token.");
      return;
    }
    fetch(`/api/team/accept-invite?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(data.error ?? "Invite not found");
          return;
        }
        setPreview(data.preview);
      })
      .catch(() => setLoadError("Could not load invite"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/team/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not accept invite");
      return;
    }
    router.push("/login?invited=1");
  }

  if (loadError) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-line bg-foam p-6 shadow-soft">
        <p className="text-sm text-signal">{loadError}</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-lagoon underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (!preview) {
    return <p className="text-sm text-muted">Loading invite…</p>;
  }

  const roleLabel = preview.role === "HR_ADMIN" ? "HR Admin" : "Super Admin";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-xl border border-line bg-foam p-6 shadow-soft"
    >
      <h1 className="font-display text-xl font-semibold text-ink">
        Join {preview.companyName}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {preview.inviterName} invited you to {PRODUCT_NAME} as {roleLabel}. Set a
        password for <strong>{preview.email}</strong>.
      </p>
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
            required
            minLength={8}
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1"
            required
            minLength={8}
          />
        </div>
        {error && <p className="text-sm text-signal">{error}</p>}
        <Button type="submit" variant="brand" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : "Accept invite"}
        </Button>
      </div>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen min-h-dvh items-center justify-center bg-atmosphere px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
