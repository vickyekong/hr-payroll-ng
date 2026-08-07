import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthError("Unauthorized", 401);
  }
  return session;
}

export async function requirePermission(permission: Parameters<typeof can>[1]) {
  const session = await requireAuth();
  if (!can(session.user.role, permission)) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function formatZodError(error: ZodError): string {
  const parts = error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "input";
    if (path === "year" && issue.code === "too_small") {
      return "Year must be 2020 or later — check the report year (clock files sometimes mis-read old dates).";
    }
    return `${path}: ${issue.message}`;
  });
  return parts.join("; ") || "Invalid input";
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: formatZodError(error) }, { status: 400 });
  }
  if (error instanceof Error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function isEmployeeSelf(session: { user: { role: UserRole; employeeId?: string | null } }, employeeId: string) {
  return session.user.role === "EMPLOYEE" && session.user.employeeId === employeeId;
}
