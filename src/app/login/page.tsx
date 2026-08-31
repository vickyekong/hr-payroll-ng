"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetBanner = searchParams.get("reset") === "1";
  const invitedBanner = searchParams.get("invited") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const check = await fetch("/api/auth/check-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, totp: needsTotp ? totp : undefined }),
    });
    const checkData = await check.json().catch(() => ({}));
    const result = checkData.result as
      | { status: string; email?: string }
      | undefined;

    if (result?.status === "email_not_verified") {
      setLoading(false);
      setError(
        "Verify your email before signing in. Check your inbox or resend from the verification page."
      );
      return;
    }
    if (result?.status === "totp_required") {
      setLoading(false);
      setNeedsTotp(true);
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (result?.status === "invalid_totp") {
      setLoading(false);
      setNeedsTotp(true);
      setError("Invalid authenticator code.");
      return;
    }
    if (result?.status === "invalid") {
      setLoading(false);
      setError("Invalid email or password");
      return;
    }

    const signInResult = await signIn("credentials", {
      email,
      password,
      totp: needsTotp ? totp : "",
      redirect: false,
    });

    setLoading(false);
    if (signInResult?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen min-h-dvh overflow-x-hidden bg-login-atmosphere">
      <div
        aria-hidden
        className="landing-plus-field-login pointer-events-none absolute inset-0"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col justify-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-10">
        <div className="animate-soft-rise max-w-md text-foam lg:flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-lagoon-mist/70">
            People &amp; payroll
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] tracking-tight text-foam sm:mt-4 sm:text-5xl md:text-6xl">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-lagoon-mist/75 sm:mt-4 sm:text-base">
            {PRODUCT_TAGLINE}. HR and Super Admin share one workspace — clearance
            only when money and sensitive data need it.
          </p>
        </div>

        <div
          className="animate-fade-up w-full max-w-sm self-center lg:flex-shrink-0 lg:self-auto"
          style={{ animationDelay: "80ms" }}
        >
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-white/15 bg-foam/95 p-5 shadow-soft backdrop-blur-sm sm:p-6"
          >
            <p className="text-sm font-medium text-ink">Sign in</p>
            <p className="mt-1 text-xs text-muted">
              Super Admin or HR — same tools, clearance where it counts
            </p>
            {resetBanner && (
              <p className="mt-3 text-xs text-ok">
                Password updated. Sign in with your new password.
              </p>
            )}
            {invitedBanner && (
              <p className="mt-3 text-xs text-ok">
                Account created. Sign in with your new password.
              </p>
            )}
            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@acme.ng"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-lagoon underline underline-offset-2"
                  >
                    Forgot?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              {needsTotp && (
                <div>
                  <Label htmlFor="totp">Authenticator code</Label>
                  <Input
                    id="totp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
              )}
              {error && <p className="text-sm text-signal">{error}</p>}
              <Button
                type="submit"
                variant="brand"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Enter workspace"}
              </Button>
            </div>
          </form>
          <p className="mt-4 text-center text-xs text-lagoon-mist/60">
            New company?{" "}
            <Link href="/signup" className="underline underline-offset-2">
              Create a workspace
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-lagoon-mist/50">
            Demo · admin@acme.ng · hr@acme.ng · password123
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-login-atmosphere" />}>
      <LoginForm />
    </Suspense>
  );
}
