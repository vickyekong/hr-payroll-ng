import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { z } from "zod";

const MAX_DATA_URL_CHARS = 1_200_000; // ~0.9MB binary after base64

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  fileUrl: z
    .string()
    .min(1)
    .refine(
      (v) =>
        v.startsWith("https://") ||
        v.startsWith("http://") ||
        (v.startsWith("data:") && v.length <= MAX_DATA_URL_CHARS),
      {
        message:
          "File must be a URL or a small upload (PDF/image under ~1MB)",
      }
    ),
});

async function loadEmployee(companyId: string, employeeId: string) {
  return prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    const employee = await loadEmployee(session.user.companyId, params.id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: params.id },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    const employee = await loadEmployee(session.user.companyId, params.id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const body = createSchema.parse(await req.json());

    const document = await prisma.employeeDocument.create({
      data: {
        employeeId: params.id,
        name: body.name,
        fileUrl: body.fileUrl,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "CREATE",
        entityType: "EmployeeDocument",
        entityId: document.id,
        performedById: session.user.id,
        changes: {
          employeeId: params.id,
          name: body.name,
          storedAs: body.fileUrl.startsWith("data:") ? "upload" : "url",
        },
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
