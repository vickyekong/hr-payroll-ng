import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";

export async function GET() {
  try {
    const session = await requirePermission("manageLeave");
    const year = new Date().getFullYear();

    const balances = await prisma.leaveBalance.findMany({
      where: {
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
