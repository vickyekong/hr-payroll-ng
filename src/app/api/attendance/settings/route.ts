import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { nairaToKobo, koboToNaira } from "@/lib/money";
import { z } from "zod";

const patchSchema = z.object({
  missedShiftPenaltyNaira: z.number().min(0).optional(),
  lateGraceMinutes: z.number().int().min(0).max(180).optional(),
  minPresentMinutes: z.number().int().min(0).max(24 * 60).optional(),
});

export async function GET() {
  try {
    const session = await requirePermission("manageEmployees");
    const settings = await prisma.attendanceSettings.upsert({
      where: { companyId: session.user.companyId },
      create: { companyId: session.user.companyId },
      update: {},
    });
    return NextResponse.json({
      ...settings,
      missedShiftPenaltyNaira: koboToNaira(settings.missedShiftPenaltyKobo),
      missedShiftPenaltyKobo: settings.missedShiftPenaltyKobo.toString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = patchSchema.parse(await req.json());

    const settings = await prisma.attendanceSettings.upsert({
      where: { companyId: session.user.companyId },
      create: {
        companyId: session.user.companyId,
        missedShiftPenaltyKobo:
          body.missedShiftPenaltyNaira !== undefined
            ? nairaToKobo(body.missedShiftPenaltyNaira)
            : 0n,
        lateGraceMinutes: body.lateGraceMinutes ?? 15,
        minPresentMinutes: body.minPresentMinutes ?? 240,
      },
      update: {
        ...(body.missedShiftPenaltyNaira !== undefined && {
          missedShiftPenaltyKobo: nairaToKobo(body.missedShiftPenaltyNaira),
        }),
        ...(body.lateGraceMinutes !== undefined && {
          lateGraceMinutes: body.lateGraceMinutes,
        }),
        ...(body.minPresentMinutes !== undefined && {
          minPresentMinutes: body.minPresentMinutes,
        }),
      },
    });

    return NextResponse.json({
      ...settings,
      missedShiftPenaltyNaira: koboToNaira(settings.missedShiftPenaltyKobo),
      missedShiftPenaltyKobo: settings.missedShiftPenaltyKobo.toString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
