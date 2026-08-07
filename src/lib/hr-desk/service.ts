import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { getGoogleOAuthClient } from "@/lib/google-drive";
import {
  classifyHrMail,
  extractLeaveDates,
  inferLeaveType,
  buildDecisionDraft,
} from "@/lib/hr-desk/classify";
import type { HrDeskCategory } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";

async function getGmailClient(companyId: string) {
  const integration = await prisma.googleDriveIntegration.findUnique({
    where: { companyId },
  });
  if (!integration) {
    throw new Error(
      "Google Workspace is not connected. Connect it in Settings, then reconnect to grant Gmail access."
    );
  }
  const client = getGoogleOAuthClient();
  client.setCredentials({ refresh_token: integration.refreshToken });
  return {
    gmail: google.gmail({ version: "v1", auth: client }),
    integration,
  };
}

function decodeBody(payload: {
  body?: { data?: string | null } | null;
  parts?: Array<{ mimeType?: string | null; body?: { data?: string | null } | null; parts?: unknown }> | null;
}): string {
  const walk = (part: {
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: unknown;
  }): string => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts as Array<{
        mimeType?: string | null;
        body?: { data?: string | null } | null;
        parts?: unknown;
      }>) {
        const text = walk(child);
        if (text) return text;
      }
    }
    if (part.body?.data) {
      try {
        return Buffer.from(part.body.data, "base64url").toString("utf8");
      } catch {
        return "";
      }
    }
    return "";
  };
  return walk(payload as never).slice(0, 20_000);
}

function headerValue(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

function parseFrom(from: string): { email: string; name: string | null } {
  const match = from.match(/^(?:"?([^"]*)"?\s)?<?([^<>\s]+@[^<>\s]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2].trim().toLowerCase(),
    };
  }
  return { email: from.trim().toLowerCase(), name: null };
}

async function matchEmployee(
  companyId: string,
  fromEmail: string,
  fromName: string | null,
  body: string
) {
  const users = await prisma.user.findMany({
    where: { companyId, employeeId: { not: null } },
    select: { email: true, employeeId: true, name: true },
  });
  const byEmail = users.find((u) => u.email.toLowerCase() === fromEmail);
  if (byEmail?.employeeId) return byEmail.employeeId;

  const employees = await prisma.employee.findMany({
    where: { companyId, status: { in: ["ACTIVE", "ON_LEAVE", "SICK_LEAVE"] } },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });

  const hay = `${fromName ?? ""} ${body}`.toLowerCase();
  for (const e of employees) {
    const full = `${e.firstName} ${e.lastName}`.toLowerCase();
    if (fromName && fromName.toLowerCase().includes(e.firstName.toLowerCase()) && fromName.toLowerCase().includes(e.lastName.toLowerCase())) {
      return e.id;
    }
    if (hay.includes(full) || hay.includes(e.employeeCode.toLowerCase())) {
      return e.id;
    }
  }
  return null;
}

async function notifyHrAdmins(options: {
  companyId: string;
  title: string;
  body: string;
  messageId: string;
}) {
  const recipients = await prisma.user.findMany({
    where: {
      companyId: options.companyId,
      role: { in: PERMISSIONS.manageHrDesk },
    },
    select: { id: true },
  });

  const linkUrl = `${process.env.NEXTAUTH_URL?.replace(/\/$/, "") || ""}/hr-desk?id=${options.messageId}`;

  await Promise.all(
    recipients.map((user) =>
      prisma.notification.create({
        data: {
          companyId: options.companyId,
          userId: user.id,
          type: "HR_DESK",
          title: options.title,
          body: options.body,
          linkUrl,
          entityType: "HrDeskMessage",
          entityId: options.messageId,
        },
      })
    )
  );
}

export async function syncHrDeskInbox(companyId: string, maxResults = 40) {
  const { gmail, integration } = await getGmailClient(companyId);

  const list = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox newer_than:30d",
    maxResults,
  });

  const messageRefs = list.data.messages ?? [];
  let imported = 0;
  let updated = 0;
  let notified = 0;

  for (const ref of messageRefs) {
    if (!ref.id) continue;
    const existing = await prisma.hrDeskMessage.findUnique({
      where: {
        companyId_gmailMessageId: {
          companyId,
          gmailMessageId: ref.id,
        },
      },
    });
    if (existing) {
      updated += 1;
      continue;
    }

    const full = await gmail.users.messages.get({
      userId: "me",
      id: ref.id,
      format: "full",
    });

    const headers = full.data.payload?.headers ?? [];
    const subject = headerValue(headers, "Subject") || "(no subject)";
    const fromRaw = headerValue(headers, "From");
    const { email: fromEmail, name: fromName } = parseFrom(fromRaw);
    const bodyText = decodeBody(full.data.payload ?? {});
    const snippet = full.data.snippet ?? bodyText.slice(0, 180);
    const receivedAt = new Date(Number(full.data.internalDate ?? Date.now()));
    const category = classifyHrMail(subject, bodyText);
    const employeeId = await matchEmployee(
      companyId,
      fromEmail,
      fromName,
      `${subject}\n${bodyText}`
    );

    const created = await prisma.hrDeskMessage.create({
      data: {
        companyId,
        gmailMessageId: ref.id,
        gmailThreadId: full.data.threadId ?? null,
        fromEmail,
        fromName,
        subject,
        snippet,
        bodyText,
        receivedAt,
        category,
        status: employeeId ? "ASSIGNED" : "NEW",
        employeeId,
      },
    });

    await notifyHrAdmins({
      companyId,
      title: `HR Desk · ${category.replace(/_/g, " ")}`,
      body: `${fromName || fromEmail}: ${subject}`,
      messageId: created.id,
    });
    imported += 1;
    notified += 1;
  }

  await prisma.googleDriveIntegration.update({
    where: { companyId },
    data: { lastHrMailSyncAt: new Date() },
  });

  return {
    scanned: messageRefs.length,
    imported,
    skippedExisting: updated,
    notified,
    mailbox: integration.email,
    lastSyncAt: new Date().toISOString(),
  };
}

export async function createHrDecisionDraft(options: {
  companyId: string;
  messageId: string;
  decision: "approve" | "reject";
  notes?: string;
  templateId?: import("@/lib/hr-desk/templates").ReplyTemplateId;
  performedById: string;
}) {
  const message = await prisma.hrDeskMessage.findFirst({
    where: { id: options.messageId, companyId: options.companyId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
        },
      },
    },
  });
  if (!message) throw new Error("Message not found");
  if (!message.employeeId || !message.employee) {
    throw new Error("Assign this mail to a staff member before approving or rejecting.");
  }

  let leaveRequestId = message.leaveRequestId;

  if (message.category === "LEAVE" && options.decision === "approve") {
    const dates =
      extractLeaveDates(`${message.subject}\n${message.bodyText ?? ""}`) ?? {
        startDate: new Date(),
        endDate: new Date(),
        days: 1,
      };
    const type = inferLeaveType(message.subject, message.bodyText ?? "");

    if (!leaveRequestId) {
      const leave = await prisma.leaveRequest.create({
        data: {
          employeeId: message.employeeId,
          type,
          startDate: dates.startDate,
          endDate: dates.endDate,
          days: dates.days,
          reason: message.snippet,
          status: "APPROVED",
          approvedById: options.performedById,
          approvedAt: new Date(),
        },
      });
      leaveRequestId = leave.id;

      if (type === "ANNUAL") {
        const year = dates.startDate.getFullYear();
        await prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveType_year: {
              employeeId: message.employeeId,
              leaveType: "ANNUAL",
              year,
            },
          },
          update: { usedDays: { increment: dates.days } },
          create: {
            employeeId: message.employeeId,
            leaveType: "ANNUAL",
            year,
            entitledDays: 21,
            usedDays: dates.days,
          },
        });
      }
    }
  }

  if (message.category === "LEAVE" && options.decision === "reject") {
    const dates =
      extractLeaveDates(`${message.subject}\n${message.bodyText ?? ""}`) ?? {
        startDate: new Date(),
        endDate: new Date(),
        days: 1,
      };
    if (!leaveRequestId) {
      const leave = await prisma.leaveRequest.create({
        data: {
          employeeId: message.employeeId,
          type: inferLeaveType(message.subject, message.bodyText ?? ""),
          startDate: dates.startDate,
          endDate: dates.endDate,
          days: dates.days,
          reason: message.snippet,
          status: "REJECTED",
          approvedById: options.performedById,
          approvedAt: new Date(),
        },
      });
      leaveRequestId = leave.id;
    }
  }

  const draft = buildDecisionDraft({
    decision: options.decision,
    category: message.category,
    staffName: `${message.employee.firstName} ${message.employee.lastName}`,
    originalSubject: message.subject,
    notes: options.notes,
    templateId:
      options.templateId ??
      (options.decision === "approve" ? "standard_approve" : "standard_reject"),
  });

  const { gmail } = await getGmailClient(options.companyId);
  const raw = [
    `To: ${message.fromEmail}`,
    `Subject: ${draft.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    draft.body,
  ].join("\r\n");

  const encoded = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const created = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encoded,
        threadId: message.gmailThreadId ?? undefined,
      },
    },
  });

  const draftId = created.data.id ?? created.data.message?.id ?? null;

  const updated = await prisma.hrDeskMessage.update({
    where: { id: message.id },
    data: {
      status: options.decision === "approve" ? "APPROVED" : "REJECTED",
      leaveRequestId,
      draftMessageId: draftId,
      notes: options.notes,
      processedAt: new Date(),
    },
  });

  await prisma.notification.updateMany({
    where: {
      entityType: "HrDeskMessage",
      entityId: message.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return {
    message: updated,
    draftId,
    draftPreview: draft,
  };
}

export type { HrDeskCategory };
