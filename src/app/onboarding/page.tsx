"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_INK,
  normalizeHex,
} from "@/lib/company-brand";
import { useCompanyBrand } from "@/components/brand/company-brand-provider";
import { PRODUCT_NAME } from "@/lib/brand";

const MAX_LOGO_DATA_CHARS = 200_000;

async function fileToLogoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 256;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let quality = 0.88;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_LOGO_DATA_CHARS && quality > 0.45) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > MAX_LOGO_DATA_CHARS) {
    throw new Error("Logo is too large — try a simpler image under 200KB");
  }
  return dataUrl;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { refresh } = useCompanyBrand();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [accent, setAccent] = useState(DEFAULT_BRAND_ACCENT);
  const [ink, setInk] = useState(DEFAULT_BRAND_INK);
  const [hrName, setHrName] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [hrPassword, setHrPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    fetch("/api/company/branding")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) return;
        setName(json.name ?? "");
        setLogoUrl(json.logoUrl ?? null);
        setAccent(json.brandAccentHex || DEFAULT_BRAND_ACCENT);
        setInk(json.brandInkHex || DEFAULT_BRAND_INK);
      })
      .catch(() => {});
  }, []);

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/company/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        logoUrl,
        brandAccentHex: normalizeHex(accent),
        brandInkHex: normalizeHex(ink),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error ?? "Could not save branding");
      return;
    }
    await refresh();
    setStep(2);
    setMessage("");
  }

  async function inviteHr(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: hrName,
        email: hrEmail,
        password: hrPassword,
        role: "HR_ADMIN",
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error ?? "Could not invite HR");
      return;
    }
    finish();
  }

  function finish() {
    try {
      localStorage.setItem("omnipeople-onboarding-done", "1");
    } catch {
      /* ignore */
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-mist px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          {PRODUCT_NAME} setup
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-ink">
          {step === 1 ? "Brand your workspace" : "Invite your HR admin"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {step === 1
            ? "Company name, logo, and colours appear on payslips and the app shell."
            : "Optional — you can invite HR later from Settings. Share the password securely."}
        </p>

        <div className="mt-4 flex gap-2">
          <span
            className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-lagoon" : "bg-sand"}`}
          />
          <span
            className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-lagoon" : "bg-sand"}`}
          />
        </div>

        {step === 1 && (
          <form
            onSubmit={saveBranding}
            className="mt-8 space-y-4 rounded-xl border border-line bg-foam p-5 shadow-soft"
          >
            <div>
              <Label htmlFor="name">Company display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                required
                minLength={2}
              />
            </div>
            <div>
              <Label>Logo</Label>
              <div className="mt-2 flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-12 w-12 rounded-md border border-line object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-line text-xs text-muted">
                    —
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setLogoUrl(await fileToLogoDataUrl(file));
                    } catch (err) {
                      setMessage(
                        err instanceof Error ? err.message : "Logo failed"
                      );
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload logo
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl(null)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="accent">Accent</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="accent"
                    type="color"
                    value={normalizeHex(accent) ?? DEFAULT_BRAND_ACCENT}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-9 w-12 cursor-pointer p-1"
                  />
                  <Input
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="ink">Ink / sidebar</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="ink"
                    type="color"
                    value={normalizeHex(ink) ?? DEFAULT_BRAND_INK}
                    onChange={(e) => setInk(e.target.value)}
                    className="h-9 w-12 cursor-pointer p-1"
                  />
                  <Input
                    value={ink}
                    onChange={(e) => setInk(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
            {message && <p className="text-sm text-signal">{message}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" variant="brand" disabled={loading}>
                {loading ? "Saving…" : "Save & continue"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                Skip for now
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form
            onSubmit={inviteHr}
            className="mt-8 space-y-4 rounded-xl border border-line bg-foam p-5 shadow-soft"
          >
            {!isSuperAdmin ? (
              <p className="text-sm text-muted">
                Only Super Admin can invite HR. You can continue to the
                dashboard.
              </p>
            ) : (
              <>
                <div>
                  <Label htmlFor="hrName">HR name</Label>
                  <Input
                    id="hrName"
                    value={hrName}
                    onChange={(e) => setHrName(e.target.value)}
                    className="mt-1"
                    required
                    minLength={2}
                  />
                </div>
                <div>
                  <Label htmlFor="hrEmail">HR email</Label>
                  <Input
                    id="hrEmail"
                    type="email"
                    value={hrEmail}
                    onChange={(e) => setHrEmail(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="hrPassword">Temporary password</Label>
                  <Input
                    id="hrPassword"
                    type="password"
                    value={hrPassword}
                    onChange={(e) => setHrPassword(e.target.value)}
                    className="mt-1"
                    required
                    minLength={8}
                  />
                  <p className="mt-1 text-xs text-muted">
                    They sign in at /login with this email and password.
                  </p>
                </div>
              </>
            )}
            {message && <p className="text-sm text-signal">{message}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {isSuperAdmin && (
                <Button type="submit" variant="brand" disabled={loading}>
                  {loading ? "Inviting…" : "Invite HR & open app"}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={finish}>
                {isSuperAdmin ? "Skip — go to dashboard" : "Go to dashboard"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
