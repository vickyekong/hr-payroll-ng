"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/lib/brand";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    token ? "loading" : "idle"
  );
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/auth/verify-email?token=${encodeURIComponent(token)}`
      );
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Verification failed");
        return;
      }
      setStatus("ok");
      setMessage(
        data.alreadyVerified
          ? "Email was already verified. You can sign in."
          : "Email verified. You can sign in to your workspace."
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setResendMsg("");
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resendEmail }),
    });
    const data = await res.json().catch(() => ({}));
    setResendMsg(data.message ?? data.error ?? "Done");
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-foam p-6 shadow-soft">
      <h1 className="font-display text-xl font-semibold text-ink">
        Verify your email
      </h1>

      {token ? (
        <p className="mt-3 text-sm text-muted">
          {status === "loading" && "Confirming your email…"}
          {status === "ok" && message}
          {status === "error" && message}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Check your inbox for the verification link from {PRODUCT_NAME}, or resend
          below.
        </p>
      )}

      {status === "ok" && (
        <Button asChild variant="brand" className="mt-5 w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      )}

      {(status === "error" || !token) && (
        <form onSubmit={resend} className="mt-5 space-y-3 border-t border-sand pt-4">
          <div>
            <Label htmlFor="resend-email">Work email</Label>
            <Input
              id="resend-email"
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <Button type="submit" variant="outline" className="w-full">
            Resend verification email
          </Button>
          {resendMsg && <p className="text-sm text-muted">{resendMsg}</p>}
        </form>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen min-h-dvh items-center justify-center bg-atmosphere px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
