import {
  PRODUCT_NAME,
  PRODUCT_POSITIONING,
  PRODUCT_TAGLINE,
} from "@/lib/brand";

/** Hard <a> navigations so Sign up never soft-routes into the login shell by mistake. */
function CtaLink({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant: "primary" | "ghost" | "outline";
}) {
  const className =
    variant === "primary"
      ? "inline-flex h-11 items-center justify-center rounded-lg bg-lagoon px-6 text-sm font-medium text-foam transition hover:bg-lagoon-deep"
      : variant === "outline"
        ? "inline-flex h-11 items-center justify-center rounded-lg border border-white/25 bg-white/5 px-6 text-sm font-medium text-foam backdrop-blur-sm transition hover:bg-white/10"
        : "rounded-lg px-3 py-2 text-sm font-medium text-lagoon-mist/90 transition hover:bg-white/10 hover:text-foam";

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen min-h-dvh bg-ink text-foam">
      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <p className="font-display text-xl font-semibold tracking-tight text-foam sm:text-2xl">
          {PRODUCT_NAME}
        </p>
        <div className="flex items-center gap-2 sm:gap-3">
          <CtaLink href="/login" variant="ghost">
            Log in
          </CtaLink>
          <a
            href="/signup"
            className="rounded-lg bg-lagoon px-3.5 py-2 text-sm font-medium text-foam transition hover:bg-lagoon-deep"
          >
            Sign up
          </a>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-login-atmosphere"
        />
        <div
          aria-hidden
          className="animate-fade-in pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d8f0f2' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-6xl items-end gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pb-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-12 lg:pb-24">
          <div className="animate-soft-rise max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-lagoon-mist/70">
              {PRODUCT_NAME}
            </p>
            <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-foam sm:text-5xl md:text-6xl">
              {PRODUCT_POSITIONING}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-lagoon-mist/80 sm:text-lg">
              Contracts, clocks, leave, and adjustments become correct net pay —
              with HR clearance before money moves.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href="/signup" variant="primary">
                Create your workspace
              </CtaLink>
              <CtaLink href="/login" variant="outline">
                Log in to the app
              </CtaLink>
            </div>
            <p className="mt-4 text-xs text-lagoon-mist/50">
              Demo still open · admin@acme.ng · hr@acme.ng · password123
            </p>

            <div
              className="animate-fade-up mt-10 rounded-xl border border-white/10 bg-white/5 p-5 lg:hidden"
              style={{ animationDelay: "100ms" }}
              aria-hidden
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-lagoon-mist/60">
                Salary truth
              </p>
              <p className="font-display mt-3 text-3xl font-semibold text-foam">
                Net pay
              </p>
              <p className="mt-1 text-xs text-lagoon-mist/65">
                Contract + attendance + leave − remittances
              </p>
            </div>
          </div>

          <div
            className="animate-fade-up relative hidden min-h-[320px] lg:block"
            style={{ animationDelay: "120ms" }}
            aria-hidden
          >
            <div className="absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-br from-lagoon/30 via-ink-soft/80 to-ink p-8 shadow-soft">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-lagoon-mist/60">
                Salary truth
              </p>
              <p className="font-display mt-6 text-5xl font-semibold tracking-tight text-foam xl:text-6xl">
                Net pay
              </p>
              <p className="mt-2 text-sm text-lagoon-mist/70">
                Contract + attendance + leave − remittances
              </p>
              <div className="mt-10 space-y-3 border-t border-white/10 pt-6 text-sm text-lagoon-mist/75">
                <div className="flex justify-between gap-4">
                  <span>Gross</span>
                  <span className="font-medium text-foam tabular-nums">
                    ₦850,000
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Statutory</span>
                  <span className="font-medium text-foam tabular-nums">
                    −₦142,400
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Attendance</span>
                  <span className="font-medium text-foam tabular-nums">
                    −₦38,180
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-white/10 pt-3 text-base">
                  <span className="font-medium text-foam">Take-home</span>
                  <span className="font-semibold text-lagoon-mist tabular-nums">
                    ₦669,420
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mist px-5 py-20 text-ink sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl animate-fade-up">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Salary truth, not just payslips
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            See how contract pay, missed shifts, unpaid leave, and one-off
            adjustments become the number on the slip — before you approve.
            One run, one explanation, no spreadsheet archaeology.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-foam px-5 py-20 text-ink sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Remittance-ready packs
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Month-end PAYE, pension, NHF, and NSITF totals aligned to the same
            statutory rules that built the run — export and file with confidence,
            not a second set of books.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-atmosphere px-5 py-20 text-ink sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for how Nigerian teams actually pay
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            NTA 2025 tax bands, pension, NHF, and NSITF out of the box. Clock
            files and L&apos;ORI attendance sheets feed salary only after HR
            confirms — Admin and Finance stay pay-exempt where your rules say so.
          </p>
        </div>
      </section>

      <section className="bg-ink px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foam sm:text-4xl">
            Open the command center
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-lagoon-mist/75 sm:text-base">
            {PRODUCT_TAGLINE}. Create a company workspace, or sign in to the app
            you already use.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <CtaLink href="/signup" variant="primary">
              Sign up
            </CtaLink>
            <CtaLink href="/login" variant="outline">
              Log in
            </CtaLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink px-5 py-6 text-center text-xs text-lagoon-mist/45 sm:px-8">
        © {new Date().getFullYear()} {PRODUCT_NAME}
      </footer>
    </div>
  );
}
