import { createHash, randomBytes } from "crypto";

export function generateAuthToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashAuthToken(token) };
}

export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const AUTH_TOKEN_TTL = {
  passwordResetHours: 1,
  emailVerifyHours: 48,
  teamInviteDays: 7,
} as const;

export function authTokenExpiry(kind: keyof typeof AUTH_TOKEN_TTL): Date {
  const now = Date.now();
  if (kind === "teamInviteDays") {
    return new Date(now + AUTH_TOKEN_TTL.teamInviteDays * 24 * 60 * 60 * 1000);
  }
  const hours =
    kind === "passwordResetHours"
      ? AUTH_TOKEN_TTL.passwordResetHours
      : AUTH_TOKEN_TTL.emailVerifyHours;
  return new Date(now + hours * 60 * 60 * 1000);
}

export function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
