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
| Content | `animate-fade-in` |
