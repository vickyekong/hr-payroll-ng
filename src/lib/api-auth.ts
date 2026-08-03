import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

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

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function isEmployeeSelf(session: { user: { role: UserRole; employeeId?: string | null } }, employeeId: string) {
  return session.user.role === "EMPLOYEE" && session.user.employeeId === employeeId;
}
