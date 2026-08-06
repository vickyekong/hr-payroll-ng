import { prisma } from "@/lib/db";
import { getMonthName } from "@/lib/utils";

export function getAppBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function payrollReviewUrl(runId: string): string {
  return `${getAppBaseUrl()}/payroll/${runId}`;
}

/** In-app notify Super Admin that HR submitted payroll and needs approval. */
export async function notifyPayrollSubmitted(options: {
  companyId: string;
  runId: string;
  periodMonth: number;
  periodYear: number;
  submittedByName: string;
  excludeUserId?: string;
}) {
  const periodLabel = `${getMonthName(options.periodMonth)} ${options.periodYear}`;
  const linkUrl = payrollReviewUrl(options.runId);

  // Always Super Admin — HR seeks approval; Super Admin signs off
  const recipients = await prisma.user.findMany({
    where: {
      companyId: options.companyId,
      role: "SUPER_ADMIN",
      ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
    },
    select: { id: true, email: true, name: true, role: true },
  });

  const title = `Payroll awaiting your approval — ${periodLabel}`;
  const body = `HR (${options.submittedByName}) submitted ${periodLabel} payroll for your approval. Open the link to approve or send it back.`;

  const notifications = await Promise.all(
    recipients.map(async (user) => {
      const notification = await prisma.notification.create({
        data: {
          companyId: options.companyId,
          userId: user.id,
          type: "PAYROLL_REVIEW",
          title,
          body,
          linkUrl,
          entityType: "PayrollRun",
          entityId: options.runId,
        },
      });

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        notificationId: notification.id,
      };
    })
  );

  return { linkUrl, periodLabel, recipients: notifications };
}
