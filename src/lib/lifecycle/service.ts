import { prisma } from "@/lib/db";
import type { LifecycleKind } from "@prisma/client";

const ONBOARDING_TASKS: Array<{
  key: string;
  title: string;
  description: string;
  href?: (employeeId: string) => string;
  sortOrder: number;
}> = [
  {
    key: "COLLECT_ID",
    title: "Collect ID / employment docs",
    description: "National ID, offer letter, and signed contract on file",
    href: (id) => `/employees/${id}/edit`,
    sortOrder: 1,
  },
  {
    key: "COLLECT_BANK",
    title: "Bank details for payroll",
    description: "Bank name and account number verified",
    href: (id) => `/employees/${id}/edit`,
    sortOrder: 2,
  },
  {
    key: "COLLECT_TIN",
    title: "Tax Identification Number (TIN)",
    description: "Required for PAYE remittance",
    href: (id) => `/employees/${id}/edit`,
    sortOrder: 3,
  },
  {
    key: "COLLECT_RSA",
    title: "RSA PIN / PFA enrolment",
    description: "Pension account details captured",
    href: (id) => `/employees/${id}/edit`,
    sortOrder: 4,
  },
  {
    key: "ASSIGN_SHIFT",
    title: "Assign shift & clock machine ID",
    description: "So attendance imports map correctly",
    href: (id) => `/employees/${id}/edit`,
    sortOrder: 5,
  },
  {
    key: "LEAVE_BALANCES",
    title: "Create leave balances",
    description: "Annual / sick entitlements for the year",
    href: () => `/leave`,
    sortOrder: 6,
  },
  {
    key: "NOTIFY_FINANCE",
    title: "Notify Finance of new hire",
    description: "Accountant aware for next payroll run",
    sortOrder: 7,
  },
];

const OFFBOARDING_TASKS: Array<{
  key: string;
  title: string;
  description: string;
  href?: (employeeId: string) => string;
  sortOrder: number;
}> = [
  {
    key: "FINAL_PAY",
    title: "Flag for final pay / clearance",
    description: "Confirm last working day and outstanding pay items",
    href: () => `/payroll`,
    sortOrder: 1,
  },
  {
    key: "STOP_PAYROLL",
    title: "Confirm status excludes from future runs",
    description: "Employee status should be FIRED / ended",
    href: (id) => `/employees/${id}/edit`,
    sortOrder: 2,
  },
  {
    key: "REVOKE_ACCESS",
    title: "Revoke systems access",
    description: "Email, apps, and portal login disabled",
    sortOrder: 3,
  },
  {
    key: "EXIT_DOCS",
    title: "Collect exit documents",
    description: "Clearance form, asset return, exit interview notes",
    href: (id) => `/employees/${id}`,
    sortOrder: 4,
  },
  {
    key: "NOTIFY_FINANCE_EXIT",
    title: "Notify Finance of exit",
    description: "Remove from remittance schedules after final pay",
    sortOrder: 5,
  },
];

export async function ensureLeaveBalances(employeeId: string, year?: number) {
  const y = year ?? new Date().getFullYear();
  const defaults: Array<{ leaveType: "ANNUAL" | "SICK"; entitledDays: number }> =
    [
      { leaveType: "ANNUAL", entitledDays: 21 },
      { leaveType: "SICK", entitledDays: 12 },
    ];

  for (const d of defaults) {
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType: d.leaveType,
          year: y,
        },
      },
      create: {
        employeeId,
        leaveType: d.leaveType,
        year: y,
        entitledDays: d.entitledDays,
        usedDays: 0,
      },
      update: {},
    });
  }
}

export async function startLifecycle(options: {
  companyId: string;
  employeeId: string;
  kind: LifecycleKind;
  forceNew?: boolean;
}) {
  const existing = await prisma.employeeLifecycle.findFirst({
    where: {
      companyId: options.companyId,
      employeeId: options.employeeId,
      kind: options.kind,
      status: "OPEN",
    },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });

  if (existing && !options.forceNew) {
    await syncLifecycleTaskHints(existing.id);
    return prisma.employeeLifecycle.findUniqueOrThrow({
      where: { id: existing.id },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
  }

  const templates =
    options.kind === "ONBOARDING" ? ONBOARDING_TASKS : OFFBOARDING_TASKS;

  const lifecycle = await prisma.employeeLifecycle.create({
    data: {
      companyId: options.companyId,
      employeeId: options.employeeId,
      kind: options.kind,
      status: "OPEN",
      tasks: {
        create: templates.map((t) => ({
          key: t.key,
          title: t.title,
          description: t.description,
          href: t.href?.(options.employeeId) ?? null,
          sortOrder: t.sortOrder,
        })),
      },
    },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });

  if (options.kind === "ONBOARDING") {
    await ensureLeaveBalances(options.employeeId);
    await autoCompleteTask(lifecycle.id, "LEAVE_BALANCES");
  }

  await syncLifecycleTaskHints(lifecycle.id);
  return prisma.employeeLifecycle.findUniqueOrThrow({
    where: { id: lifecycle.id },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
}

async function autoCompleteTask(lifecycleId: string, key: string) {
  await prisma.employeeLifecycleTask.updateMany({
    where: { lifecycleId, key, status: "PENDING" },
    data: { status: "DONE", completedAt: new Date() },
  });
}

/** Auto-tick tasks when employee data already satisfies them. */
export async function syncLifecycleTaskHints(lifecycleId: string) {
  const lifecycle = await prisma.employeeLifecycle.findUnique({
    where: { id: lifecycleId },
    include: {
      employee: {
        select: {
          id: true,
          bankName: true,
          bankAccountNumber: true,
          tin: true,
          rsaPin: true,
          clockDeviceId: true,
          status: true,
          shiftAssignment: { select: { id: true } },
          leaveBalances: { select: { id: true }, take: 1 },
        },
      },
      tasks: true,
    },
  });
  if (!lifecycle || lifecycle.status !== "OPEN") return;

  const emp = lifecycle.employee;
  const autoDone = new Set<string>();

  if (emp.bankName?.trim() && emp.bankAccountNumber?.trim()) {
    autoDone.add("COLLECT_BANK");
  }
  if (emp.tin?.trim()) autoDone.add("COLLECT_TIN");
  if (emp.rsaPin?.trim()) autoDone.add("COLLECT_RSA");
  if (emp.clockDeviceId && emp.shiftAssignment) autoDone.add("ASSIGN_SHIFT");
  if (emp.leaveBalances.length > 0) autoDone.add("LEAVE_BALANCES");
  if (emp.status === "FIRED") autoDone.add("STOP_PAYROLL");

  for (const key of autoDone) {
    await prisma.employeeLifecycleTask.updateMany({
      where: { lifecycleId, key, status: "PENDING" },
      data: { status: "DONE", completedAt: new Date() },
    });
  }

  const pending = await prisma.employeeLifecycleTask.count({
    where: { lifecycleId, status: "PENDING" },
  });
  if (pending === 0) {
    await prisma.employeeLifecycle.update({
      where: { id: lifecycleId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
}

export async function completeLifecycleTask(options: {
  companyId: string;
  taskId: string;
  userId: string;
  status: "DONE" | "SKIPPED";
}) {
  const task = await prisma.employeeLifecycleTask.findFirst({
    where: {
      id: options.taskId,
      lifecycle: { companyId: options.companyId },
    },
    include: { lifecycle: true },
  });
  if (!task) throw new Error("Task not found");
  if (task.lifecycle.status !== "OPEN") {
    throw new Error("Lifecycle is not open");
  }

  if (task.key === "LEAVE_BALANCES" && options.status === "DONE") {
    await ensureLeaveBalances(task.lifecycle.employeeId);
  }

  await prisma.employeeLifecycleTask.update({
    where: { id: task.id },
    data: {
      status: options.status,
      completedAt: new Date(),
      completedById: options.userId,
    },
  });

  await syncLifecycleTaskHints(task.lifecycleId);

  return prisma.employeeLifecycle.findUniqueOrThrow({
    where: { id: task.lifecycleId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function getEmployeeLifecycles(
  companyId: string,
  employeeId: string
) {
  const open = await prisma.employeeLifecycle.findMany({
    where: { companyId, employeeId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
    orderBy: { startedAt: "desc" },
  });
  for (const lc of open.filter((l) => l.status === "OPEN")) {
    await syncLifecycleTaskHints(lc.id);
  }
  return prisma.employeeLifecycle.findMany({
    where: { companyId, employeeId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
    orderBy: { startedAt: "desc" },
  });
}
