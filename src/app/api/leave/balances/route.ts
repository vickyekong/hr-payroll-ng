import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, handleApiError, AuthError } from "@/lib/api-auth";
import { can } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requireAuth();

    const isEmployee =
      session.user.role === "EMPLOYEE" && session.user.employeeId;

    if (!isEmployee && !can(session.user.role, "manageLeave")) {
      throw new AuthError("Forbidden", 403);
    }

    const year = new Date().getFullYear();

    const balances = await prisma.leaveBalance.findMany({
      where: isEmployee
        ? { employeeId: session.user.employeeId!, year }
        : {
            year,
            employee: { companyId: session.user.companyId },
          },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: true,
          },
        },
      },
      orderBy: [{ employee: { lastName: "asc" } }, { leaveType: "asc" }],
    });

    return NextResponse.json(
      balances.map((b) => ({
        id: b.id,
        leaveType: b.leaveType,
        year: b.year,
        entitledDays: b.entitledDays,
        usedDays: b.usedDays,
        remainingDays: b.entitledDays - b.usedDays,
        employee: b.employee,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
