import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/brand";
import { RunPayrollCta } from "@/components/dashboard/run-payroll-cta";
import type { getCommandCenterData } from "@/lib/dashboard/command-center";

type CommandCenterData = Awaited<ReturnType<typeof getCommandCenterData>>;

export function CommandCenterHero({
  data,
  userName,
}: {
  data: CommandCenterData;
  userName: string;
}) {
  const firstName = userName.split(" ")[0] || "Leader";
  const runLabel = `Run Payroll — ${data.userFacingPeriod.label} ${data.userFacingPeriod.year}`;

  return (
    <div className="mb-8 animate-fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-lagoon">
            {PRODUCT_NAME}
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Command center — actions, payroll run-rate, and compliance at a
            glance
          </p>
        </div>
        <RunPayrollCta label={runLabel} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="surface-panel px-4 py-4 transition duration-300 ease-brand hover:-translate-y-0.5 hover:shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Action required ({data.actionCount})
          </p>
          {data.actions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Inbox clear.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.actions.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className="flex justify-between gap-2 text-sm text-ink-soft hover:text-lagoon-deep"
                  >
                    <span>
                      <span className="font-semibold text-lagoon">{a.count}</span>{" "}
                      {a.label}
                    </span>
                    <span className="shrink-0 text-muted">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-panel px-4 py-4 transition duration-300 ease-brand hover:-translate-y-0.5 hover:shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Payroll run-rate
          </p>
          {data.runRate ? (
            <div className="mt-3 space-y-1">
              <p className="font-display text-3xl font-semibold tabular-nums text-ink">
                {formatCurrency(BigInt(data.runRate.netKobo))}
              </p>
              <p className="text-sm text-muted">
                Net · {data.runRate.periodLabel}
                {data.runRate.deltaPct != null && (
                  <span className="ml-1 font-medium text-ink-soft">
                    ({data.runRate.deltaPct > 0 ? "+" : ""}
                    {data.runRate.deltaPct}% vs prior)
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                Next target run: {data.nextRunLabel} · {data.runRate.headcount}{" "}
                staff
              </p>
              <Link
                href={`/payroll/${data.runRate.runId}`}
                className="mt-2 inline-block text-xs font-medium text-lagoon hover:text-lagoon-deep"
              >
                Open last approved run →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No approved payroll yet. Create a run to unlock run-rate.
            </p>
          )}
        </section>

        <section className="surface-panel px-4 py-4 transition duration-300 ease-brand hover:-translate-y-0.5 hover:shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Compliance status
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <p
              className={
                data.compliance.taxCompliant
                  ? "font-medium text-ok"
                  : "font-medium text-warn"
              }
            >
              {data.compliance.taxCompliant
                ? "Tax IDs complete for active staff"
                : `${data.compliance.missingTin} staff missing TIN`}
            </p>
            <p className="text-muted">
              {data.compliance.pensionsDue === 0
                ? "RSA PINs complete"
                : `${data.compliance.pensionsDue} pensions / RSA PIN due`}
            </p>
            <Link
              href="/hr-ask"
              className="inline-block text-xs font-medium text-lagoon hover:text-lagoon-deep"
            >
              Query compliance gaps →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export function OmniCoPilotStrip({
  lines,
}: {
  lines: CommandCenterData["coPilot"];
}) {
  return (
    <section className="mb-8 animate-fade-up rounded-xl border border-ink/20 bg-ink px-5 py-5 text-foam shadow-soft">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-lagoon">
        Omni Co-Pilot insights
      </p>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-lagoon-mist/60">
          Insights appear as attendance, leave, and payroll data accumulate.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {lines.slice(0, 5).map((line) => (
            <li
              key={line.id}
              className="border-l-2 border-lagoon/50 pl-3 text-sm leading-relaxed text-lagoon-mist/90"
            >
              {line.href ? (
                <Link href={line.href} className="hover:text-foam">
                  {line.text}
                </Link>
              ) : (
                line.text
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function QuickWorkflows() {
  const items = [
    { href: "/employees/new", label: "Onboard employee" },
    { href: "/hr-ask", label: "Draft policy / query desk" },
    { href: "/reports", label: "Run headcount forecast" },
  ];

  return (
    <section className="mb-8 animate-fade-up">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted">
        Quick workflows
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex h-9 items-center rounded-lg border border-line bg-foam/90 px-3 text-sm font-medium text-ink transition duration-200 ease-brand hover:border-lagoon/40 hover:bg-lagoon-mist/50"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
