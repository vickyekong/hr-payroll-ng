"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_INK,
  normalizeHex,
} from "@/lib/company-brand";
import { useCompanyBrand } from "@/components/brand/company-brand-provider";
import { PRODUCT_NAME } from "@/lib/brand";

type BrandingData = {
  name: string;
  logoUrl: string | null;
  brandAccentHex: string | null;
  brandInkHex: string | null;
};

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

export function BrandingSettingsForm() {
  const { refresh } = useCompanyBrand();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<BrandingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/company/branding")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) =>
        setMessage(err instanceof Error ? err.message : "Failed to load")
      );
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/company/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        logoUrl: data.logoUrl,
        brandAccentHex: data.brandAccentHex,
        brandInkHex: data.brandInkHex,
      }),
    });

    setLoading(false);
    if (res.ok) {
      const updated = await res.json();
      setData(updated);
      await refresh();
      setMessage("Branding saved — your workspace colors update immediately.");
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error ?? "Failed to save branding");
    }
  }

  async function onLogoFile(file: File | undefined) {
    if (!file || !data) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file (PNG, JPG, or WebP).");
      return;
    }
    try {
      const logoUrl = await fileToLogoDataUrl(file);
      setData({ ...data, logoUrl });
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not read logo");
    }
  }

  function resetColors() {
    if (!data) return;
    setData({ ...data, brandAccentHex: null, brandInkHex: null });
  }

  if (!data) {
    return (
      <p className="mb-6 text-sm text-muted">
        {message || "Loading branding…"}
      </p>
    );
  }

  const accentPreview =
    normalizeHex(data.brandAccentHex) ?? DEFAULT_BRAND_ACCENT;
  const inkPreview = normalizeHex(data.brandInkHex) ?? DEFAULT_BRAND_INK;

  return (
    <form onSubmit={handleSubmit} className="mb-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company branding</CardTitle>
          <p className="text-sm text-muted">
            Show your company name, logo, and colors in the {PRODUCT_NAME}{" "}
            workspace. Product name stays {PRODUCT_NAME}.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="companyName">Company display name</Label>
            <Input
              id="companyName"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="mt-1 max-w-md"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-line bg-foam">
                {data.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.logoUrl}
                    alt="Company logo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-muted">None</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload logo
                </Button>
                {data.logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setData({ ...data, logoUrl: null })}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void onLogoFile(e.target.files?.[0])}
              />
            </div>
            <p className="text-xs text-muted">
              Square or wide logos work best. Images are resized for the sidebar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="brandAccent">Primary accent</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="brandAccent"
                  type="color"
                  value={accentPreview}
                  onChange={(e) =>
                    setData({ ...data, brandAccentHex: e.target.value })
                  }
                  className="h-9 w-12 cursor-pointer rounded border border-line bg-foam p-0.5"
                />
                <Input
                  value={data.brandAccentHex ?? ""}
                  placeholder={DEFAULT_BRAND_ACCENT}
                  onChange={(e) =>
                    setData({
                      ...data,
                      brandAccentHex: e.target.value || null,
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                Buttons, active nav, and highlights
              </p>
            </div>
            <div>
              <Label htmlFor="brandInk">Sidebar / ink</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="brandInk"
                  type="color"
                  value={inkPreview}
                  onChange={(e) =>
                    setData({ ...data, brandInkHex: e.target.value })
                  }
                  className="h-9 w-12 cursor-pointer rounded border border-line bg-foam p-0.5"
                />
                <Input
                  value={data.brandInkHex ?? ""}
                  placeholder={DEFAULT_BRAND_INK}
                  onChange={(e) =>
                    setData({
                      ...data,
                      brandInkHex: e.target.value || null,
                    })
                  }
                  className="font-mono text-sm"
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                Navigation background and strong text
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            <div
              className="flex items-center gap-3 px-4 py-3 text-white"
              style={{ backgroundColor: inkPreview }}
            >
              {data.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.logoUrl}
                  alt=""
                  className="h-8 w-8 rounded-md object-contain bg-white/10"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] opacity-70">
                  Preview
                </p>
                <p className="truncate font-display text-lg font-semibold">
                  {PRODUCT_NAME}
                </p>
                <p className="truncate text-xs opacity-75">{data.name}</p>
              </div>
              <span
                className="ml-auto rounded-md px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: accentPreview }}
              >
                Active
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save branding"}
            </Button>
            <Button type="button" variant="outline" onClick={resetColors}>
              Reset colors to default
            </Button>
            {message && (
              <p
                className={`text-sm ${
                  message.includes("saved") ? "text-ok" : "text-signal"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
