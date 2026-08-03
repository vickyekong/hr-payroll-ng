import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { StatutoryConfig } from "@prisma/client";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { nairaToKobo } from "@/lib/money";
import { z } from "zod";

const taxBandSchema = z.object({
  lowerBoundNaira: z.number().min(0),
  upperBoundNaira: z.number().min(0).nullable(),
  ratePercent: z.number().min(0).max(100),
});

const updateSchema = z.object({
  pensionEmployeeRate: z.number().min(0).max(100).optional(),
  pensionEmployerRate: z.number().min(0).max(100).optional(),
  nhfEnabled: z.boolean().optional(),
  nhfRate: z.number().min(0).max(100).optional(),
  nsitfRate: z.number().min(0).max(100).optional(),
  taxReliefMode: z.enum(["NTA2025", "CRA"]).optional(),
  taxFreeThresholdNaira: z.number().min(0).optional(),
  minimumWageExemptNaira: z.number().min(0).optional(),
  rentReliefCapNaira: z.number().min(0).optional(),
  taxBands: z.array(taxBandSchema).min(1).optional(),
});

function serializeConfig(config: StatutoryConfig) {
  return {
    pensionEmployeeRate: config.pensionEmployeeRate / 100,
    pensionEmployerRate: config.pensionEmployerRate / 100,
    nhfEnabled: config.nhfEnabled,
    nhfRate: config.nhfRate / 100,
    nsitfRate: config.nsitfRate / 100,
    taxReliefMode: config.taxReliefMode,
    taxFreeThresholdNaira: Number(config.taxFreeThresholdKobo) / 100,
    minimumWageExemptNaira: Number(config.minimumWageExemptKobo) / 100,
    rentReliefCapNaira: Number(config.rentReliefCapKobo) / 100,
  };
}

async function loadSettings(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    include: {
      statutoryConfig: true,
      taxBands: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function GET() {
  try {
    const session = await requirePermission("manageStatutoryRates");
    const company = await loadSettings(session.user.companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({
      companyName: company.name,
      statutory: company.statutoryConfig
        ? serializeConfig(company.statutoryConfig)
        : null,
      taxBands: company.taxBands.map((b) => ({
        id: b.id,
        lowerBoundNaira: Number(b.lowerBoundKobo) / 100,
        upperBoundNaira: b.upperBoundKobo
          ? Number(b.upperBoundKobo) / 100
          : null,
        ratePercent: b.rateBps / 100,
        sortOrder: b.sortOrder,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("manageStatutoryRates");
    const body = updateSchema.parse(await req.json());

    const company = await loadSettings(session.user.companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const configData = {
      ...(body.pensionEmployeeRate !== undefined && {
        pensionEmployeeRate: Math.round(body.pensionEmployeeRate * 100),
      }),
      ...(body.pensionEmployerRate !== undefined && {
        pensionEmployerRate: Math.round(body.pensionEmployerRate * 100),
      }),
      ...(body.nhfEnabled !== undefined && { nhfEnabled: body.nhfEnabled }),
      ...(body.nhfRate !== undefined && {
        nhfRate: Math.round(body.nhfRate * 100),
      }),
      ...(body.nsitfRate !== undefined && {
        nsitfRate: Math.round(body.nsitfRate * 100),
      }),
      ...(body.taxReliefMode !== undefined && {
        taxReliefMode: body.taxReliefMode,
      }),
      ...(body.taxFreeThresholdNaira !== undefined && {
        taxFreeThresholdKobo: nairaToKobo(body.taxFreeThresholdNaira),
      }),
      ...(body.minimumWageExemptNaira !== undefined && {
        minimumWageExemptKobo: nairaToKobo(body.minimumWageExemptNaira),
      }),
      ...(body.rentReliefCapNaira !== undefined && {
        rentReliefCapKobo: nairaToKobo(body.rentReliefCapNaira),
      }),
    };

    if (Object.keys(configData).length > 0) {
      await prisma.statutoryConfig.upsert({
        where: { companyId: session.user.companyId },
        create: { companyId: session.user.companyId, ...configData },
        update: configData,
      });
    }

    if (body.taxBands) {
      await prisma.taxBand.deleteMany({
        where: { companyId: session.user.companyId },
      });

      await prisma.taxBand.createMany({
        data: body.taxBands.map((band, index) => ({
          companyId: session.user.companyId,
          lowerBoundKobo: nairaToKobo(band.lowerBoundNaira),
          upperBoundKobo:
            band.upperBoundNaira !== null
              ? nairaToKobo(band.upperBoundNaira)
              : null,
          rateBps: Math.round(band.ratePercent * 100),
          sortOrder: index,
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "UPDATE",
        entityType: "StatutoryConfig",
        entityId: session.user.companyId,
        performedById: session.user.id,
        changes: body,
      },
    });

    const updated = await loadSettings(session.user.companyId);
    return NextResponse.json({
      companyName: updated!.name,
      statutory: updated!.statutoryConfig
        ? serializeConfig(updated!.statutoryConfig)
        : null,
      taxBands: updated!.taxBands.map((b) => ({
        id: b.id,
        lowerBoundNaira: Number(b.lowerBoundKobo) / 100,
        upperBoundNaira: b.upperBoundKobo
          ? Number(b.upperBoundKobo) / 100
          : null,
        ratePercent: b.rateBps / 100,
        sortOrder: b.sortOrder,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
