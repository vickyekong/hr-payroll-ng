import type { HrDeskCategory } from "@prisma/client";

export type ReplyTemplateId =
  | "standard_approve"
  | "standard_reject"
  | "need_more_info"
  | "acknowledge"
  | "closed_no_action";

export const HR_DESK_REPLY_TEMPLATES: Array<{
  id: ReplyTemplateId;
  label: string;
  /** When set, drives approve/reject draft path; otherwise fills notes only */
  decision?: "approve" | "reject";
}> = [
  { id: "standard_approve", label: "Standard approval", decision: "approve" },
  { id: "standard_reject", label: "Standard decline", decision: "reject" },
  { id: "need_more_info", label: "Need more information" },
  { id: "acknowledge", label: "Acknowledge receipt" },
  { id: "closed_no_action", label: "Closed — no further action" },
];

export function buildTemplatedReply(options: {
  templateId: ReplyTemplateId;
  category: HrDeskCategory;
  staffName: string;
  originalSubject: string;
  notes?: string | null;
}): { subject: string; body: string } {
  const label =
    options.category === "LEAVE"
      ? "leave request"
      : options.category.toLowerCase().replace(/_/g, " ");
  const subject = `Re: ${options.originalSubject.replace(/^re:\s*/i, "")}`;
  const noteBlock = options.notes ? `\nHR note: ${options.notes}` : "";

  const bodies: Record<ReplyTemplateId, string[]> = {
    standard_approve: [
      `Dear ${options.staffName},`,
      "",
      `Thank you for your email regarding your ${label}.`,
      "",
      `We are pleased to inform you that your ${label} has been approved.`,
      noteBlock,
      "",
      "Kind regards,",
      "HR Department",
    ],
    standard_reject: [
      `Dear ${options.staffName},`,
      "",
      `Thank you for your email regarding your ${label}.`,
      "",
      `After review, your ${label} has not been approved at this time.`,
      noteBlock,
      "",
      "Kind regards,",
      "HR Department",
    ],
    need_more_info: [
      `Dear ${options.staffName},`,
      "",
      `Thank you for contacting HR about your ${label}.`,
      "",
      "To proceed, please reply with any missing dates, supporting documents, or clarification so we can complete the review.",
      noteBlock,
      "",
      "Kind regards,",
      "HR Department",
    ],
    acknowledge: [
      `Dear ${options.staffName},`,
      "",
      `We have received your email regarding your ${label} and it is with the HR team.`,
      "",
      "We will follow up once it has been reviewed.",
      noteBlock,
      "",
      "Kind regards,",
      "HR Department",
    ],
    closed_no_action: [
      `Dear ${options.staffName},`,
      "",
      `Thank you for your email. We have closed this matter with no further action required at this time.`,
      noteBlock,
      "",
      "Kind regards,",
      "HR Department",
    ],
  };

  const body = bodies[options.templateId]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  return { subject, body };
}

export function previewTemplateBody(
  templateId: ReplyTemplateId,
  category: string
): string {
  const { body } = buildTemplatedReply({
    templateId,
    category: (category as HrDeskCategory) || "GENERAL",
    staffName: "[Staff name]",
    originalSubject: "Your request",
  });
  return body;
}
