import type { HrDeskCategory, LeaveType } from "@prisma/client";
import {
  buildTemplatedReply,
  type ReplyTemplateId,
} from "@/lib/hr-desk/templates";

const CATEGORY_RULES: Array<{ category: HrDeskCategory; patterns: RegExp[] }> = [
  {
    category: "LEAVE",
    patterns: [
      /\bleave\b/i,
      /\btime\s*off\b/i,
      /\bannual\s+leave\b/i,
      /\bsick\s+leave\b/i,
      /\bmaternity\b/i,
      /\bpaternity\b/i,
      /\babsence\b/i,
      /\bday\s*off\b/i,
    ],
  },
  {
    category: "RESIGNATION",
    patterns: [
      /\bresign/i,
      /\bresignation\b/i,
      /\bquit(ting)?\b/i,
      /\bnotice\s+period\b/i,
      /\blast\s+working\s+day\b/i,
    ],
  },
  {
    category: "PAYROLL",
    patterns: [
      /\bpayroll\b/i,
      /\bsalary\b/i,
      /\bwages?\b/i,
      /\bpaye\b/i,
      /\bpension\b/i,
      /\bpayslip\b/i,
      /\bovertime\b/i,
    ],
  },
  {
    category: "COMPLAINT",
    patterns: [
      /\bcomplaint\b/i,
      /\bgrievance\b/i,
      /\bharass/i,
      /\bmistreat/i,
      /\bunfair\b/i,
    ],
  },
  {
    category: "INQUIRY",
    patterns: [
      /\binquir(y|ies)\b/i,
      /\benquir(y|ies)\b/i,
      /\bquestion\b/i,
      /\bplease\s+clarify\b/i,
      /\bhow\s+do\s+i\b/i,
    ],
  },
];

export function classifyHrMail(
  subject: string,
  body: string
): HrDeskCategory {
  const text = `${subject}\n${body}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.category;
  }
  return "GENERAL";
}

export function inferLeaveType(subject: string, body: string): LeaveType {
  const text = `${subject}\n${body}`.toLowerCase();
  if (/sick/.test(text)) return "SICK";
  if (/maternity/.test(text)) return "MATERNITY";
  if (/paternity/.test(text)) return "PATERNITY";
  if (/unpaid/.test(text)) return "UNPAID";
  return "ANNUAL";
}

/** Extract first date range like 12/08/2026 - 16/08/2026 or Aug 12-16 2026 */
export function extractLeaveDates(
  text: string
): { startDate: Date; endDate: Date; days: number } | null {
  const iso = text.match(
    /(\d{4}-\d{2}-\d{2}).{0,20}?(\d{4}-\d{2}-\d{2})/
  );
  if (iso) {
    const startDate = new Date(iso[1]);
    const endDate = new Date(iso[2]);
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      const days =
        Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
      if (days > 0 && days < 366) return { startDate, endDate, days };
    }
  }

  const dmy = text.match(
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}).{0,20}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
  );
  if (dmy) {
    const parse = (v: string) => {
      const m = v.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (!m) return null;
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      return new Date(year, Number(m[2]) - 1, Number(m[1]));
    };
    const startDate = parse(dmy[1]);
    const endDate = parse(dmy[2]);
    if (startDate && endDate) {
      const days =
        Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
      if (days > 0 && days < 366) return { startDate, endDate, days };
    }
  }

  return null;
}

export function buildDecisionDraft(options: {
  decision: "approve" | "reject";
  category: HrDeskCategory;
  staffName: string;
  originalSubject: string;
  notes?: string | null;
  templateId?: ReplyTemplateId;
}): { subject: string; body: string } {
  if (options.templateId) {
    return buildTemplatedReply({
      templateId: options.templateId,
      category: options.category,
      staffName: options.staffName,
      originalSubject: options.originalSubject,
      notes: options.notes,
    });
  }

  const label =
    options.category === "LEAVE"
      ? "leave request"
      : options.category.toLowerCase().replace(/_/g, " ");
  const decisionWord =
    options.decision === "approve" ? "approved" : "not approved";
  const subject = `Re: ${options.originalSubject.replace(/^re:\s*/i, "")}`;
  const body = [
    `Dear ${options.staffName},`,
    "",
    `Thank you for your email regarding your ${label}.`,
    "",
    options.decision === "approve"
      ? `We are pleased to inform you that your ${label} has been ${decisionWord}.`
      : `After review, your ${label} has been ${decisionWord} at this time.`,
    options.notes ? `\nHR note: ${options.notes}` : "",
    "",
    "Kind regards,",
    "HR Department",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");

  return { subject, body };
}
