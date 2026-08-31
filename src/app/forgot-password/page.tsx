"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/lib/brand";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Could not send reset email");
      return;
    }
    setMessage(data.message);
  }

  return (
    <div className="relative flex min-h-screen min-h-dvh items-center justify-center bg-login-atmosphere px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-white/15 bg-foam/95 p-6 shadow-soft"
      >
        <h1 className="font-display text-xl font-semibold text-ink">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll email you a link to choose a new password for {PRODUCT_NAME}.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          {error && <p className="text-sm text-signal">{error}</p>}
          {message && <p className="text-sm text-muted">{message}</p>}
          <Button type="submit" variant="brand" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          <Link href="/login" className="underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
