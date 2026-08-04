import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  workDays: z.string().regex(/^[01]{7}$/).default("1111100"),
  graceMinutes: z.number().int().min(0).max(180).optional(),
});

const assignSchema = z.object({
  employeeId: z.string(),
  shiftId: z.string(),
});

export async function GET() {
  try {
    const session = await requirePermission("manageEmployees");
    const shifts = await prisma.shiftTemplate.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { name: "asc" },
      include: {
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(shifts);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const json = await req.json();

    if (json.assign) {
      const body = assignSchema.parse(json);
      const shift = await prisma.shiftTemplate.findFirst({
        where: { id: body.shiftId, companyId: session.user.companyId },
      });
      if (!shift) {
        return NextResponse.json({ error: "Shift not found" }, { status: 404 });
      }
      const employee = await prisma.employee.findFirst({
        where: { id: body.employeeId, companyId: session.user.companyId },
      });
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }
      const assignment = await prisma.employeeShiftAssignment.upsert({
        where: { employeeId: body.employeeId },
        create: { employeeId: body.employeeId, shiftId: body.shiftId },
        update: { shiftId: body.shiftId },
      });
      return NextResponse.json(assignment);
    }

    const body = createSchema.parse(json);
    const shift = await prisma.shiftTemplate.create({
      data: {
        companyId: session.user.companyId,
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        workDays: body.workDays,
        graceMinutes: body.graceMinutes ?? 15,
      },
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
