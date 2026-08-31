import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  authTokenExpiry,
  generateAuthToken,
  hashAuthToken,
} from "@/lib/auth/tokens";
import {
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  sendVerificationEmail,
} from "@/lib/email/auth-mails";
import { decryptTotpSecret, verifyTotpCode } from "@/lib/auth/totp";
import { TenancyError } from "@/lib/tenancy/bootstrap-company";

const BCRYPT_ROUNDS = 10;

export type CredentialCheckResult =
  | { status: "invalid" }
  | { status: "email_not_verified"; email: string }
  | { status: "totp_required" }
  | { status: "invalid_totp" }
  | { status: "ok" };

export async function checkPortalCredentials(
  email: string,
  password: string,
  totp?: string
): Promise<CredentialCheckResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      role: true,
      emailVerifiedAt: true,
      totpEnabled: true,
      totpSecret: true,
    },
  });

  if (!user) return { status: "invalid" };
  if (user.role === "EMPLOYEE" || user.role === "FINANCE") {
    return { status: "invalid" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { status: "invalid" };

  if (!user.emailVerifiedAt) {
    return { status: "email_not_verified", email: user.email };
  }

  if (user.totpEnabled) {
    const secret = decryptTotpSecret(user.totpSecret);
    if (!secret) return { status: "invalid" };
    if (!totp?.trim()) return { status: "totp_required" };
    if (!verifyTotpCode(secret, totp.trim())) {
      return { status: "invalid_totp" };
    }
  }

  return { status: "ok" };
}

export async function issueEmailVerification(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return null;

  const { token, tokenHash } = generateAuthToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: authTokenExpiry("emailVerifyHours"),
    },
  });

  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    token,
  });

  return { email: user.email };
}

export async function verifyEmailWithToken(token: string) {
  const tokenHash = hashAuthToken(token);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new TenancyError("This verification link is invalid or expired.", 400);
  }
  if (row.user.emailVerifiedAt) {
    await prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return { alreadyVerified: true };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { alreadyVerified: false };
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user || user.role === "EMPLOYEE" || user.role === "FINANCE") {
    return;
  }

  const { token, tokenHash } = generateAuthToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: authTokenExpiry("passwordResetHours"),
    },
  });

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    token,
  });
}

export async function resetPasswordWithToken(token: string, password: string) {
  if (password.length < 8) {
    throw new TenancyError("Password must be at least 8 characters");
  }

  const tokenHash = hashAuthToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true } } },
  });

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new TenancyError("This reset link is invalid or expired.", 400);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);
}

export async function createTeamInvite(input: {
  companyId: string;
  companyName: string;
  invitedById: string;
  inviterName: string;
  name: string;
  email: string;
  role: Extract<UserRole, "HR_ADMIN" | "SUPER_ADMIN">;
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (name.length < 2) {
    throw new TenancyError("Name must be at least 2 characters");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TenancyError("Enter a valid email");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, companyId: true },
  });
  if (existing) {
    throw new TenancyError(
      existing.companyId === input.companyId
        ? "That user is already on your team."
        : "That email is already registered to another company.",
      409
    );
  }

  await prisma.teamInvite.deleteMany({
    where: {
      companyId: input.companyId,
      email,
      acceptedAt: null,
    },
  });

  const { token, tokenHash } = generateAuthToken();
  const invite = await prisma.teamInvite.create({
    data: {
      companyId: input.companyId,
      email,
      name,
      role: input.role,
      tokenHash,
      invitedById: input.invitedById,
      expiresAt: authTokenExpiry("teamInviteDays"),
    },
  });

  const roleLabel = input.role === "HR_ADMIN" ? "HR Admin" : "Super Admin";
  const mail = await sendTeamInviteEmail({
    to: email,
    name,
    companyName: input.companyName,
    inviterName: input.inviterName,
    roleLabel,
    token,
  });

  if (!mail.ok) {
    await prisma.teamInvite.delete({ where: { id: invite.id } });
    throw new TenancyError(mail.error, 502);
  }

  return invite;
}

export async function acceptTeamInvite(token: string, password: string) {
  if (password.length < 8) {
    throw new TenancyError("Password must be at least 8 characters");
  }

  const tokenHash = hashAuthToken(token);
  const invite = await prisma.teamInvite.findUnique({
    where: { tokenHash },
    include: { company: { select: { name: true } } },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new TenancyError("This invite link is invalid or expired.", 400);
  }

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  });
  if (existing) {
    throw new TenancyError("That email is already registered.", 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invite.email,
        name: invite.name,
        role: invite.role,
        passwordHash,
        companyId: invite.companyId,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    });
    await tx.teamInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return created;
  });

  return { user, companyName: invite.company.name };
}

export async function getTeamInvitePreview(token: string) {
  const tokenHash = hashAuthToken(token);
  const invite = await prisma.teamInvite.findUnique({
    where: { tokenHash },
    include: {
      company: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return null;
  }

  return {
    email: invite.email,
    name: invite.name,
    role: invite.role,
    companyName: invite.company.name,
    inviterName: invite.invitedBy.name,
  };
}
