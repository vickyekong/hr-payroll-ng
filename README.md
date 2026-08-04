# HR Pay NG — Nigerian Payroll Management System

Full-stack HR payroll system for Nigerian businesses with accurate statutory calculations (PAYE, pension, NHF, NSITF), payroll run workflow, payslip PDF generation, leave management, and reporting.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **PostgreSQL** + Prisma ORM
- **NextAuth.js** (credentials + RBAC)
- **@react-pdf/renderer** for payslips
- **Recharts** for dashboards
- **Vitest** for payroll engine unit tests

## Quick Start

### 1. Install dependencies

```bash
cd hr-payroll-ng
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit DATABASE_URL and NEXTAUTH_SECRET
```

### 3. Set up database

```bash
npm run db:push
npm run db:seed
```

### 4. Run tests (payroll engine)

```bash
npm test
```

### 5. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

The build **requires** these environment variables in your Vercel project (**Settings → Environment Variables**). Apply to Production, Preview, and Development:

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Supabase, Neon, or Railway Postgres |
| `NEXTAUTH_SECRET` | output of `openssl rand -base64 32` | **Build fails without this** |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Your production URL (or preview URL for previews) |

After connecting the repo:

1. Add the env vars above in Vercel.
2. Redeploy.
3. Run schema + seed against the production database once:
   ```bash
   DATABASE_URL="your-prod-url" npm run db:push
   DATABASE_URL="your-prod-url" npm run db:seed
   ```

The build script runs `prisma generate` automatically before `next build`.

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@acme.ng | password123 |
| HR Admin | hr@acme.ng | password123 |
| Finance | finance@acme.ng | password123 |
| Employee | adaeze@acme.ng | password123 |

## Core Features

- **Employee management** — profiles, compensation structure, bank/statutory IDs
- **Payroll engine** — pure, testable Nigerian statutory calculations (configurable tax bands)
- **Payroll runs** — Draft → Under Review → Approved → Paid (immutable after approval)
- **Payslips** — PDF generation with YTD summary
- **Employee self-service** — own payslips only (strict access control)
- **Leave management** — requests, approvals, unpaid leave → payroll deductions
- **Reports** — remittances, department breakdown, employer cost

## Tax Configuration

Statutory rates and PAYE bands live in the database (`StatutoryConfig`, `TaxBand`), not hardcoded. The seed uses **NTA 2025** bands effective January 2026:

| Annual income | Rate |
|---------------|------|
| First ₦800,000 | 0% |
| Next ₦2,200,000 | 15% |
| Next ₦9,000,000 | 18% |
| Next ₦13,000,000 | 21% |
| Next ₦25,000,000 | 23% |
| Above ₦50,000,000 | 25% |

Legacy CRA mode is also supported via `taxReliefMode: "CRA"` in company settings.

> **Important:** Verify current bands against FIRS/State IRS guidance before production use. Tax law changes with each Finance Act.

## Project Structure

```
src/
  lib/payroll/          # Pure payroll calculation engine + tests
  app/
    api/                # REST API routes
    dashboard/          # Admin overview
    employees/          # Employee CRUD
    payroll/            # Payroll run workflow
    leave/              # Leave requests
    reports/            # Charts & remittances
    my/                 # Employee self-service
    settings/           # Statutory config (Super Admin)
prisma/
  schema.prisma         # Data model
  seed.ts               # Demo data
```

## Non-Negotiables Implemented

- Payroll calculations unit-tested before UI integration
- Approved payroll runs are immutable (reverse & re-run only)
- Employees can only access their own payroll data
- All money stored as kobo (`BigInt`) — no floats
- Audit log on key actions
- Configurable statutory rates in database

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm test` | Run payroll engine tests |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:migrate` | Create migration |
