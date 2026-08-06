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

async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM || "OmniPeople <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(
      `[notify] Email skipped (no RESEND_API_KEY). To=${options.to} Subject=${options.subject}`
    );
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[notify] Resend failed:", body);
      return { sent: false, error: body };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email failed";
    console.error("[notify] Email error:", message);
    return { sent: false, error: message };
  }
}

/** Notify Super Admin that HR submitted payroll and needs approval. */
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

      const email = await sendEmail({
        to: user.email,
        subject: title,
        text: `${body}\n\nReview & approve: ${linkUrl}`,
        html: `
          <p>${body}</p>
          <p><a href="${linkUrl}" style="display:inline-block;padding:10px 16px;background:#1c1917;color:#fff;text-decoration:none;border-radius:6px;">Review &amp; approve payroll</a></p>
          <p style="color:#78716c;font-size:12px;">Or open: ${linkUrl}</p>
        `,
      });

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        notificationId: notification.id,
        emailSent: email.sent,
      };
    })
  );

  return { linkUrl, periodLabel, recipients: notifications };
}
