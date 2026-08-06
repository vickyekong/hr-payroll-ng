"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
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
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d8f0f2' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
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
          <p className="mt-4 text-center text-xs text-lagoon-mist/50">
            Demo · admin@acme.ng · hr@acme.ng · password123
          </p>
        </div>
      </div>
    </div>
  );
}
