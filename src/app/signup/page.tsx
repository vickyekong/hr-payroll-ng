"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        address: address || null,
        adminName,
        adminEmail,
        adminPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Could not create company");
      return;
    }

    const result = await signIn("credentials", {
      email: adminEmail,
      password: adminPassword,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError(
        "Company created, but sign-in failed. Use your email on the login page."
      );
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen min-h-dvh overflow-x-hidden bg-atmosphere text-ink">
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col justify-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-10">
        <div className="animate-soft-rise max-w-md lg:flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-lagoon">
            New company
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:mt-4 sm:text-5xl">
            Create your {PRODUCT_NAME} workspace
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted sm:mt-4 sm:text-base">
            {PRODUCT_TAGLINE}. Your company gets its own space — Super Admin
            first, then invite HR, brand it, and run payroll.
          </p>
          <p className="mt-6 text-sm text-muted">
            Already have an account?{" "}
            <a href="/login" className="font-medium text-lagoon underline underline-offset-2">
              Log in
            </a>
          </p>
        </div>

        <div
          className="animate-fade-up w-full max-w-md self-center lg:flex-shrink-0 lg:self-auto"
          style={{ animationDelay: "80ms" }}
        >
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-line bg-foam p-5 shadow-soft sm:p-6"
          >
            <p className="text-sm font-medium text-ink">Company signup</p>
            <p className="mt-1 text-xs text-muted">
              Not the login form — this creates a new tenant with NTA 2025 defaults
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="companyName">Company name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Riverbank Foods Ltd"
                  className="mt-1"
                  required
                  minLength={2}
                />
              </div>
              <div>
                <Label htmlFor="address">Address (optional)</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, state"
                  className="mt-1"
                />
              </div>
              <div className="border-t border-sand pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Super Admin
                </p>
              </div>
              <div>
                <Label htmlFor="adminName">Your name</Label>
                <Input
                  id="adminName"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="mt-1"
                  required
                  minLength={2}
                />
              </div>
              <div>
                <Label htmlFor="adminEmail">Work email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="adminPassword">Password</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="mt-1"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-xs text-muted">At least 8 characters</p>
              </div>

              {error && <p className="text-sm text-signal">{error}</p>}

              <Button
                type="submit"
                variant="brand"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Creating workspace…" : "Create company"}
              </Button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-muted">
            Demo still available · admin@acme.ng · hr@acme.ng · password123
          </p>
        </div>
      </div>
    </div>
  );
}
