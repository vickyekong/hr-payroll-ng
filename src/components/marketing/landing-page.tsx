import {
  PRODUCT_NAME,
  PRODUCT_POSITIONING,
  PRODUCT_TAGLINE,
} from "@/lib/brand";
import { LandingLottie } from "@/components/marketing/landing-lottie";

/** Hard <a> navigations so Sign up never soft-routes into the login shell by mistake. */
function CtaLink({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant: "primary" | "ghost" | "outline" | "ink";
}) {
  const className =
    variant === "primary"
      ? "inline-flex h-11 items-center justify-center rounded-lg bg-lagoon px-6 text-sm font-medium text-foam shadow-soft transition hover:bg-lagoon-deep"
      : variant === "ink"
        ? "inline-flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-sm font-medium text-foam transition hover:bg-ink-soft"
        : variant === "outline"
          ? "inline-flex h-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-6 text-sm font-medium text-foam backdrop-blur-sm transition hover:bg-white/15"
          : "rounded-lg px-3 py-2 text-sm font-medium text-lagoon-mist transition hover:bg-white/10 hover:text-foam";

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

const PILLARS = [
  {
    label: "01",
    title: "Salary truth engine",
    body: "Contract pay, attendance, unpaid leave, taxable and non-taxable adjustments, and statutory deductions resolve into one explainable net. HR sees the story before anyone approves the run.",
    lottie: "/lottie/salary-truth.json",
  },
  {
    label: "02",
    title: "Remittance-ready packs",
    body: "Month-end PAYE, pension, NHF, and NSITF totals come from the same rules that built the payslips — so filing matches payroll, not a second spreadsheet.",
    lottie: "/lottie/remittance-pack.json",
  },
  {
    label: "03",
    title: "Nigeria-native by default",
    body: "NTA 2025 bands, pension, NHF, and NSITF ship configured. Clock files and L'ORI attendance feed pay only after HR confirms. Admin and Finance stay pay-exempt where your policy says so.",
    lottie: "/lottie/people-network.json",
  },
] as const;

const FLOW = [
  {
    step: "1",
    title: "Bring people in",
    body: "Onboard staff with compensation, bank details, and statutory IDs — or import from the sheets and clocks you already use.",
    lottie: "/lottie/hr-team.json",
  },
  {
    step: "2",
    title: "Confirm attendance",
    body: "Missed shifts and unpaid leave become pay impact only after HR clearance. Penalties stay opt-in, never silent.",
    lottie: "/lottie/attendance-confirm.json",
  },
  {
    step: "3",
    title: "Run payroll",
    body: "Draft → review → approve → paid. Recalculate with YTD and statutory snapshots. Payslips stay explainable end to end.",
    lottie: "/lottie/money-cycle.json",
  },
  {
    step: "4",
    title: "File & export",
    body: "Remittance packs, department cost, CSV exports, and optional Google Workspace sync — without rebuilding the numbers.",
    lottie: "/lottie/approval.json",
  },
] as const;

const CAPABILITIES = [
  {
    title: "People ops",
    items: [
      "Employee profiles & compensation structure",
      "Onboarding and offboarding checklists",
      "Leave recorded by HR, unpaid leave → payroll",
      "Policy desk / change-request review",
    ],
  },
  {
    title: "Payroll",
    items: [
      "NTA 2025 PAYE with taxable vs non-taxable lines",
      "Pension, NHF, NSITF on every run",
      "Attendance-aware net with HR confirm",
      "Payslip PDFs with year-to-date summary",
    ],
  },
  {
    title: "Command center",
    items: [
      "Super Admin + HR portals only",
      "Compliance gaps (TIN, RSA PIN) at a glance",
      "Omni Co-Pilot workload insights",
      "Multi-tenant company workspaces",
    ],
  },
] as const;

const STATUTORY = [
  { name: "PAYE", detail: "NTA 2025 bands + ₦800k relief path" },
  { name: "Pension", detail: "Employee & employer contributions" },
  { name: "NHF", detail: "Housing fund on qualifying pay" },
  { name: "NSITF", detail: "Employer remittance aligned to run" },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen min-h-dvh bg-ink text-foam">
      <header className="relative z-30 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <p className="font-display text-xl font-semibold tracking-tight text-foam sm:text-2xl">
          {PRODUCT_NAME}
        </p>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Account">
          <CtaLink href="/login" variant="ghost">
            Log in
          </CtaLink>
          <a
            href="/signup"
            className="rounded-lg bg-lagoon px-3.5 py-2 text-sm font-medium text-foam shadow-soft transition hover:bg-lagoon-deep"
          >
            Sign up
          </a>
        </nav>
      </header>

      {/* Hero — readable type over soft atmosphere + contained motion */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-login-atmosphere"
        />
        <div
          aria-hidden
          className="landing-plus-field pointer-events-none absolute inset-0"
        />
        <div
          aria-hidden
          className="animate-lagoon-breathe pointer-events-none absolute -right-16 top-[18%] h-[380px] w-[380px] rounded-full bg-lagoon/25 blur-3xl lg:h-[460px] lg:w-[460px]"
        />
        <div
          aria-hidden
          className="landing-hero-scrim pointer-events-none absolute inset-0"
        />

        <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-6xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 sm:pb-20 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pb-24">
          <div className="animate-soft-rise relative lg:col-span-6 xl:col-span-7">
            <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-tight text-foam drop-shadow-[0_1px_12px_rgb(11_46_51_/_0.45)] sm:text-6xl md:text-7xl">
              {PRODUCT_NAME}
            </h1>
            <p className="mt-5 max-w-lg text-xl font-medium leading-snug text-lagoon-mist sm:text-2xl">
              {PRODUCT_POSITIONING}
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-lagoon-mist/90 sm:text-lg">
              Contracts, clocks, leave, and adjustments become correct net pay —
              with HR clearance before money moves.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <CtaLink href="/signup" variant="primary">
                Create your workspace
              </CtaLink>
              <CtaLink href="/login" variant="outline">
                Log in to the app
              </CtaLink>
            </div>
            <p className="mt-5 text-xs text-lagoon-mist/70">
              Live demo · admin@acme.ng · hr@acme.ng · password123
            </p>
          </div>

          <div
            className="animate-fade-up relative lg:col-span-6 xl:col-span-5"
            style={{ animationDelay: "140ms" }}
          >
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-ink/50 via-transparent to-lagoon/10 blur-xl" />
              <LandingLottie
                src="/lottie/salary-truth.json"
                className="mx-auto mb-5 h-40 w-40 opacity-90 sm:h-48 sm:w-48 lg:absolute lg:-right-1 lg:-top-32 lg:mb-0 lg:h-52 lg:w-52 lg:opacity-95"
                speed={0.9}
              />
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-lagoon-mist/70">
                This month · explained
              </p>
              <p className="font-display mt-4 text-5xl font-semibold tracking-tight text-foam sm:text-6xl">
                ₦669,420
              </p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-lagoon-mist/85 sm:text-base">
                Take-home after truth — contract, attendance, and remittances in
                one line of sight
              </p>

              <dl className="mt-9 max-w-md space-y-0 border-t border-white/20" aria-hidden>
                {[
                  { label: "Gross contract", value: "₦850,000" },
                  {
                    label: "Statutory (PAYE · pension · NHF)",
                    value: "−₦142,400",
                  },
                  { label: "Attendance confirmed by HR", value: "−₦38,180" },
                  { label: "Net on the slip", value: "₦669,420", emph: true },
                ].map((row, i) => (
                  <div
                    key={row.label}
                    className={`animate-fade-up flex items-baseline justify-between gap-4 border-b border-white/15 py-3.5 text-sm ${
                      row.emph ? "text-base" : "text-lagoon-mist/80"
                    }`}
                    style={{ animationDelay: `${220 + i * 70}ms` }}
                  >
                    <dt className={row.emph ? "font-medium text-foam" : undefined}>
                      {row.label}
                    </dt>
                    <dd
                      className={`tabular-nums ${
                        row.emph
                          ? "font-semibold text-lagoon-mist"
                          : "font-medium text-foam"
                      }`}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* Soft handoff into light content */}
        <div
          aria-hidden
          className="landing-fade-to-mist pointer-events-none absolute inset-x-0 bottom-0 h-28"
        />
      </section>

      {/* Tagline bridge — ink → mist blend */}
      <section className="relative overflow-hidden bg-mist px-5 py-14 text-ink sm:px-8 sm:py-16 lg:px-12">
        <div
          aria-hidden
          className="landing-fade-from-ink pointer-events-none absolute inset-x-0 top-0 h-20"
        />
        <LandingLottie
          src="/lottie/flow-spark.json"
          className="pointer-events-none absolute left-2 top-1/2 h-20 w-20 -translate-y-1/2 opacity-25 sm:left-8 sm:h-24 sm:w-24"
          speed={1.1}
        />
        <LandingLottie
          src="/lottie/flow-spark.json"
          className="pointer-events-none absolute right-2 top-1/2 h-20 w-20 -translate-y-1/2 opacity-25 sm:right-8 sm:h-24 sm:w-24"
          speed={0.95}
        />
        <p className="relative z-10 mx-auto max-w-3xl text-center text-lg font-medium leading-relaxed text-ink-soft sm:text-xl">
          {PRODUCT_TAGLINE} — built so Nigerian HR teams stop reconciling three
          tools the night before payday.
        </p>
      </section>

      <section className="bg-mist px-5 pb-20 text-ink sm:px-8 sm:pb-24 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-lagoon">
            Why teams switch
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Payroll that explains itself
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            OmniPeople is not another payslip printer. It is the layer that makes
            every naira on the slip defensible — to staff, auditors, and month-end
            remittance officers.
          </p>

          <div className="mt-14 grid gap-10 border-t border-line pt-10 md:grid-cols-3 md:gap-8 lg:gap-12">
            {PILLARS.map((pillar, i) => (
              <article
                key={pillar.label}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <LandingLottie
                  src={pillar.lottie}
                  className="mb-4 h-28 w-28 sm:h-32 sm:w-32"
                  speed={0.9 + i * 0.05}
                />
                <p className="font-display text-sm font-medium text-lagoon">
                  {pillar.label}
                </p>
                <h3 className="font-display mt-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-[15px]">
                  {pillar.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-foam px-5 py-20 text-ink sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-lagoon">
            How it works
          </p>
          <h2 className="font-display mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
            From roster to remittance in one workspace
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Super Admin and HR share the command center. Sensitive actions stay
            Super Admin–cleared. Staff never touch payroll — your team owns the
            truth.
          </p>

          <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {FLOW.map((item) => (
              <li key={item.step} className="relative">
                <div className="mb-4 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-atmosphere ring-1 ring-line/60 sm:h-40">
                  <LandingLottie
                    src={item.lottie}
                    className="h-32 w-32 sm:h-36 sm:w-36"
                    tone={
                      item.lottie.includes("money-cycle") ||
                      item.lottie.includes("hr-team") ||
                      item.lottie.includes("approval")
                        ? "mist"
                        : "default"
                    }
                    speed={0.85}
                  />
                </div>
                <span className="font-display text-3xl font-semibold text-lagoon/40">
                  {item.step}
                </span>
                <h3 className="mt-2 text-base font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-line bg-atmosphere px-5 py-20 text-ink sm:px-8 sm:py-24 lg:px-12">
        <LandingLottie
          src="/lottie/team-work.json"
          className="pointer-events-none absolute -right-20 bottom-[-2rem] h-64 w-64 opacity-20 sm:h-80 sm:w-80 lg:opacity-25"
          tone="mist"
          speed={0.7}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-transparent via-mist/40 to-mist/80 md:w-2/5"
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-lagoon">
            Inside the product
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything HR needs before payday
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            People ops, statutory payroll, compliance, and exports — one Lagoon
            Ink workspace instead of a folder of conflicting files.
          </p>

          <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
            {CAPABILITIES.map((group) => (
              <div key={group.title}>
                <h3 className="font-display text-xl font-semibold tracking-tight text-ink">
                  {group.title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-sm leading-relaxed text-muted"
                    >
                      <span
                        aria-hidden
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-lagoon"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-line bg-ink px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
        <div
          aria-hidden
          className="landing-plus-field pointer-events-none absolute inset-0 opacity-[0.18]"
        />
        <LandingLottie
          src="/lottie/remittance-pack.json"
          className="pointer-events-none absolute right-0 top-6 h-52 w-52 opacity-30 sm:right-6 sm:h-64 sm:w-64 lg:opacity-40"
          speed={0.8}
        />
        <div
          aria-hidden
          className="landing-text-veil pointer-events-none absolute inset-0"
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-lagoon-mist/75">
              Statutory core
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-foam sm:text-4xl">
              Nigerian remittances without a second set of books
            </h2>
            <p className="mt-4 text-base leading-relaxed text-lagoon-mist/90 sm:text-lg">
              Every run snapshots the rules it used. Remittance packs and payslips
              stay aligned — so month-end filing is a handoff, not a rebuild.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STATUTORY.map((item, i) => (
              <div
                key={item.name}
                className="animate-fade-up border-t border-white/20 pt-5"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <p className="font-display text-2xl font-semibold text-foam">
                  {item.name}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-lagoon-mist/75">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mist px-5 py-20 text-ink sm:px-8 sm:py-24 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-lagoon">
              Who it&apos;s for
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Super Admin and HR — the people who own payroll truth
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              No employee self-serve clutter. Your company gets its own tenant:
              brand it, invite HR, run payroll, and keep sensitive clears with
              Super Admin.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href="/signup" variant="ink">
                Start a company workspace
              </CtaLink>
              <a
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-foam px-6 text-sm font-medium text-ink transition hover:border-lagoon/40 hover:bg-lagoon-mist/40"
              >
                Log in
              </a>
            </div>
          </div>
          <LandingLottie
            src="/lottie/approval.json"
            className="mx-auto h-44 w-44 sm:h-52 sm:w-52 lg:mx-0"
            tone="mist"
            speed={0.9}
          />
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink px-5 py-24 sm:px-8 lg:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-login-atmosphere"
        />
        <div
          aria-hidden
          className="landing-plus-field-cta pointer-events-none absolute inset-0"
        />
        <LandingLottie
          src="/lottie/team-work.json"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 opacity-15 sm:h-[440px] sm:w-[440px]"
          tone="ink"
          speed={0.75}
        />
        <div
          aria-hidden
          className="landing-cta-veil pointer-events-none absolute inset-0"
        />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <LandingLottie
            src="/lottie/approval.json"
            className="mx-auto mb-6 h-24 w-24 opacity-90 sm:h-28 sm:w-28"
            tone="ink"
          />
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foam sm:text-5xl">
            Open the command center
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-lagoon-mist/90">
            Create a workspace in minutes, or sign in to the tenant you already
            run. Demo accounts stay available while you evaluate.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <CtaLink href="/signup" variant="primary">
              Sign up
            </CtaLink>
            <CtaLink href="/login" variant="outline">
              Log in
            </CtaLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-lagoon-mist/55 sm:flex-row">
          <p className="font-display text-sm text-lagoon-mist/80">
            {PRODUCT_NAME}
          </p>
          <p>
            © {new Date().getFullYear()} {PRODUCT_NAME} · People operations &amp;
            payroll for Nigeria
          </p>
        </div>
      </footer>
    </div>
  );
}
