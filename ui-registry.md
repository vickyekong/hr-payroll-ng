# OmniPeople UI Registry

Visual system: **Lagoon Ink** — deep teal ink, lagoon accent, mist atmosphere.
Last updated: 2026-08-06

## Brand tokens

| Token | Value / class |
| ----- | ------------- |
| Ink | `#0b2e33` / `ink` |
| Lagoon | `#14919b` / `lagoon` |
| Mist bg | `#f0f5f4` / `mist` + `.bg-atmosphere` |
| Foam | `#ffffff` / `foam` |
| Line | `#c9d6d4` / `line` |
| Muted text | `#5c7270` / `muted` |
| Display font | Fraunces / `font-display` |
| UI font | Manrope / `font-sans` |
| Radius | `rounded-xl` (~10px) |
| Soft shadow | `shadow-soft` |

**Pattern notes:** Prefer brand tokens over `stone-*`. Brand wordmarks use `font-display`. Avoid purple gradients, cream+terracotta, and `rounded-full` pills.

---

### Button

File: `src/components/ui/button.tsx`

| Property | Class |
| -------- | ----- |
| Default | `bg-ink text-foam hover:bg-ink-soft` |
| Brand CTA | `bg-lagoon text-foam hover:bg-lagoon-deep` |
| Outline | `border-line bg-foam/70 hover:border-lagoon/40 hover:bg-lagoon-mist/40` |
| Radius | `rounded-lg` |
| Focus | `ring-lagoon/40` |
| Motion | `active:translate-y-px`, `ease-brand` |

---

### Card / surface panel

File: `src/components/ui/card.tsx`

| Property | Class |
| -------- | ----- |
| Background | `bg-foam/95` |
| Border | `border-line/80` |
| Radius | `rounded-xl` |
| Shadow | `shadow-soft` |
| Title | `text-ink` |
| Utility alt | `.surface-panel` |

---

### Badge

File: `src/components/ui/badge.tsx`

| Property | Class |
| -------- | ----- |
| Radius | `rounded-md` (not full) |
| Default | `bg-sand text-ink-soft` |
| Success | `bg-lagoon-mist text-ok` |
| Info | `bg-lagoon-mist/70 text-lagoon-deep` |

---

### Sidebar

File: `src/components/layout/sidebar.tsx`

| Property | Class |
| -------- | ----- |
| Background | `bg-ink text-foam` |
| Brand | `font-display text-2xl` |
| Active nav | `bg-lagoon text-foam` |
| Idle nav | `text-lagoon-mist/75 hover:bg-white/5` |

---

### Login

File: `src/app/login/page.tsx`

| Property | Class |
| -------- | ----- |
| Atmosphere | `.bg-login-atmosphere` |
| Brand | `font-display text-5xl/6xl text-foam` |
| Form | `bg-foam/95 border-white/15 rounded-xl` |
| Motion | `.animate-soft-rise`, `.animate-fade-up` |
| CTA | `Button variant="brand"` |

---

### Marketing landing

File: `src/components/marketing/landing-page.tsx`
Last updated: 2026-08-08

| Property | Class |
| -------- | ----- |
| Page shell | `bg-ink text-foam` |
| Hero atmosphere | `.bg-login-atmosphere` + lagoon breathe orb |
| Brand (hero) | `font-display text-5xl…7xl text-foam` |
| Supporting promise | `text-xl/2xl text-lagoon-mist` |
| Body muted (dark) | `text-lagoon-mist/75` |
| Light sections | `bg-mist` / `bg-foam` / `.bg-atmosphere` + `text-ink` |
| Section eyebrow | `text-[11px] uppercase tracking-[0.2em] text-lagoon` |
| Section H2 | `font-display text-3xl/4xl font-semibold` |
| Primary CTA | `bg-lagoon text-foam hover:bg-lagoon-deep rounded-lg h-11` |
| Outline CTA (dark) | `border-white/25 bg-white/5 text-foam` |
| Motion | `.animate-soft-rise`, `.animate-fade-up`, `.animate-lagoon-breathe` |
| Dividers | `border-line` (light) / `border-white/10–15` (dark) |

**Pattern notes:** Hero is one composition — product name is the H1; salary-truth numbers sit in the atmosphere without card chrome. Hard `<a href>` for auth CTAs. Feature sell uses numbered pillars + capability lists, not card grids. Motion: brand Lagoon Ink Lotties via `LandingLottie` (`lottie-react`), lazy-fetched from `/public/lottie`, with `prefers-reduced-motion` pause and optional hue tone filters for third-party packs.

---

### Landing Lottie

File: `src/components/marketing/landing-lottie.tsx`
Last updated: 2026-08-08

| Property | Class / behavior |
| -------- | ---------------- |
| Player | `lottie-react` client component |
| Assets | `/public/lottie/*.json` (brand + curated) |
| Reduced motion | autoplay/loop off |
| Tone filters | `mist` / `ink` hue-rotate for foreign palettes |

---

### Command center cards

File: `src/components/dashboard/command-center.tsx`

| Property | Class |
| -------- | ----- |
| Panel | `surface-panel` |
| Hover | `hover:-translate-y-0.5 hover:shadow-soft` |
| Co-Pilot | `bg-ink` + lagoon accent border lines |
| Numbers | `font-display tabular-nums` |

---

### App shell

File: `src/components/layout/app-shell.tsx`

| Property | Class |
| -------- | ----- |
| Page bg | `.bg-atmosphere` |
| Content | `animate-fade-in px-4 sm:px-6 lg:px-8` |
| Structure | Desktop sidebar + mobile header/drawer |

---

## Responsive (phones & tablets)

| Breakpoint | Behavior |
| ---------- | -------- |
| `< lg` | Sticky top bar + slide-in drawer nav (`MobileNav`) |
| `≥ lg` | Persistent ink sidebar |
| Tables | Horizontal scroll, `min-w-[36rem]`, edge bleed on small screens |
| Payroll wizard steps | Snap-scroll cards on phone; 2-col tablet; 4-col desktop |
| Command center | 1 → 2 → 3 column cards; full-width Run Payroll CTA on phone |
| Safe area | Top bar uses `env(safe-area-inset-top)` |

Files: `src/components/layout/sidebar.tsx`, `src/components/layout/app-shell.tsx`

