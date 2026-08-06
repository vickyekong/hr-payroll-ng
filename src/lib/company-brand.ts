/** Default OmniPeople Lagoon Ink — used when company has no custom branding. */
export const DEFAULT_BRAND_ACCENT = "#14919b";
export const DEFAULT_BRAND_INK = "#0b2e33";

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function hexToRgbChannels(hex: string): string {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = parseInt(normalized.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Darken hex toward black by factor 0–1. */
export function darkenHex(hex: string, factor: number): string {
  const normalized = normalizeHex(hex) ?? DEFAULT_BRAND_ACCENT;
  const n = parseInt(normalized.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * (1 - factor));
  const g = clamp(((n >> 8) & 255) * (1 - factor));
  const b = clamp((n & 255) * (1 - factor));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Mix hex toward white by factor 0–1. */
export function lightenHex(hex: string, factor: number): string {
  const normalized = normalizeHex(hex) ?? DEFAULT_BRAND_INK;
  const n = parseInt(normalized.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * factor);
  const g = clamp(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * factor);
  const b = clamp((n & 255) + (255 - (n & 255)) * factor);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Soft mist tint from accent (RGB channels). */
export function mistFromAccent(hex: string, factor = 0.85): string {
  return hexToRgbChannels(lightenHex(hex, factor));
}

export type CompanyBrand = {
  name: string;
  logoUrl: string | null;
  brandAccentHex: string | null;
  brandInkHex: string | null;
};

export type BrandCssVars = Record<string, string>;

/** CSS custom properties (RGB channel triples) for the app shell. */
export function brandToCssVars(brand: CompanyBrand): BrandCssVars {
  const accent = normalizeHex(brand.brandAccentHex) ?? DEFAULT_BRAND_ACCENT;
  const ink = normalizeHex(brand.brandInkHex) ?? DEFAULT_BRAND_INK;

  return {
    "--lagoon": hexToRgbChannels(accent),
    "--lagoon-deep": hexToRgbChannels(darkenHex(accent, 0.18)),
    "--lagoon-mist": mistFromAccent(accent),
    "--ink": hexToRgbChannels(ink),
    "--ink-soft": hexToRgbChannels(lightenHex(ink, 0.12)),
  };
}
