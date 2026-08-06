import { prisma } from "@/lib/db";
import type { ChangeRequestType, Prisma } from "@prisma/client";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateChangePayload(
  type: ChangeRequestType,
  payload: Record<string, unknown>
): { ok: true; normalized: Record<string, string> } | { ok: false; error: string } {
  if (type === "BANK") {
    const bankName = String(payload.bankName ?? "").trim();
    const bankAccountNumber = digitsOnly(String(payload.bankAccountNumber ?? ""));
    if (!bankName) return { ok: false, error: "Bank name is required" };
    if (bankAccountNumber.length !== 10) {
      return { ok: false, error: "NUBAN account number must be 10 digits" };
    }
    return { ok: true, normalized: { bankName, bankAccountNumber } };
  }

  if (type === "TAX_RELIEF") {
    const tin = String(payload.tin ?? "").trim();
    const annualRent = String(payload.annualRentNaira ?? "").trim();
    const rent = Number(annualRent);
    if (tin && tin.length < 5) {
      return { ok: false, error: "TIN looks too short" };
    }
    if (annualRent && (Number.isNaN(rent) || rent < 0)) {
      return { ok: false, error: "Annual rent must be a valid amount" };
    }
    if (!tin && !annualRent) {
      return { ok: false, error: "Provide TIN and/or annual rent for relief" };
    }
    return {
      ok: true,
      normalized: {
        ...(tin ? { tin } : {}),
        ...(annualRent ? { annualRentNaira: String(rent) } : {}),
      },
    };
  }

  if (type === "NEXT_OF_KIN") {
    const nextOfKinName = String(payload.nextOfKinName ?? "").trim();
    const nextOfKinPhone = String(payload.nextOfKinPhone ?? "").trim();
    if (!nextOfKinName || !nextOfKinPhone) {
      return { ok: false, error: "Next of kin name and phone are required" };
    }
    return { ok: true, normalized: { nextOfKinName, nextOfKinPhone } };
  }

  const addressLine = String(payload.addressLine ?? "").trim();
  if (!addressLine || addressLine.length < 8) {
    return { ok: false, error: "Provide a full residential address" };
  }
  return { ok: true, normalized: { addressLine } };
}

export async function submitChangeRequest(options: {
  companyId: string;
  employeeId: string;
  type: ChangeRequestType;
  payload: Record<string, unknown>;
  note?: string;
}) {
  const validated = validateChangePayload(options.type, options.payload);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const pending = await prisma.employeeChangeRequest.findFirst({
    where: {
      employeeId: options.employeeId,
      type: options.type,
      status: "PENDING",
    },
  });
  if (pending) {
    throw new Error("You already have a pending request of this type");
  }

  return prisma.employeeChangeRequest.create({
    data: {
      companyId: options.companyId,
      employeeId: options.employeeId,
      type: options.type,
      payload: validated.normalized as Prisma.InputJsonValue,
      note: options.note,
      status: "PENDING",
    },
  });
}

export async function notifySuperAdminOfChangeRequest(options: {
  companyId: string;
  requestId: string;
  employeeName: string;
  type: string;
  submittedByName?: string;
}) {
  const admins = await prisma.user.findMany({
    where: {
      companyId: options.companyId,
      role: "SUPER_ADMIN",
    },
    select: { id: true },
  });

  const who = options.submittedByName ? `HR (${options.submittedByName})` : "HR";
  const title = "Change request awaiting your approval";
  const body = `${who} logged a ${options.type.replace(/_/g, " ").toLowerCase()} update for ${options.employeeName}. Approve or reject in HR Ask.`;
  const linkUrl = `/hr-ask?tab=changes`;

  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((u) => ({
      companyId: options.companyId,
      userId: u.id,
      type: "CHANGE_REQUEST",
      title,
      body,
      linkUrl,
      entityType: "EmployeeChangeRequest",
      entityId: options.requestId,
    })),
  });
}

/** @deprecated use notifySuperAdminOfChangeRequest */
export async function notifyHrOfChangeRequest(options: {
  companyId: string;
  requestId: string;
  employeeName: string;
  type: string;
}) {
  return notifySuperAdminOfChangeRequest(options);
}

export async function reviewChangeRequest(options: {
  companyId: string;
  requestId: string;
  reviewerId: string;
  action: "approve" | "reject";
  reviewNote?: string;
}) {
  const req = await prisma.employeeChangeRequest.findFirst({
    where: { id: options.requestId, companyId: options.companyId },
  });
  if (!req) throw new Error("Request not found");
  if (req.status !== "PENDING") throw new Error("Request is not pending");

  if (options.action === "reject") {
    return prisma.employeeChangeRequest.update({
      where: { id: req.id },
      data: {
        status: "REJECTED",
        reviewedById: options.reviewerId,
        reviewedAt: new Date(),
        reviewNote: options.reviewNote,
      },
    });
  }

  const payload = req.payload as Record<string, string>;

  if (req.type === "BANK") {
    await prisma.employee.update({
      where: { id: req.employeeId },
      data: {
        bankName: payload.bankName,
        bankAccountNumber: payload.bankAccountNumber,
      },
    });
  } else if (req.type === "TAX_RELIEF") {
    await prisma.employee.update({
      where: { id: req.employeeId },
      data: {
        ...(payload.tin ? { tin: payload.tin } : {}),
        ...(payload.annualRentNaira
          ? {
              annualRentKobo: BigInt(
                Math.round(Number(payload.annualRentNaira) * 100)
              ),
            }
          : {}),
      },
    });
  } else if (req.type === "NEXT_OF_KIN") {
    await prisma.employee.update({
      where: { id: req.employeeId },
      data: {
        nextOfKinName: payload.nextOfKinName,
        nextOfKinPhone: payload.nextOfKinPhone,
      },
    });
  }

  return prisma.employeeChangeRequest.update({
    where: { id: req.id },
    data: {
      status: "APPROVED",
      reviewedById: options.reviewerId,
      reviewedAt: new Date(),
      reviewNote: options.reviewNote,
    },
  });
}
