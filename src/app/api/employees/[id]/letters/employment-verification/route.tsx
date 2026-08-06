import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { EmploymentVerificationLetter } from "@/lib/documents/employment-letter";
import { displayName } from "@/lib/employees/data-quality";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    const employee = await prisma.employee.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
      include: { company: { select: { name: true, address: true } } },
    });
    if (!employee) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const name = displayName(
      employee.firstName,
      employee.lastName,
      employee.employeeCode
    );

    const buffer = await renderToBuffer(
      <EmploymentVerificationLetter
        companyName={employee.company.name}
        companyAddress={employee.company.address}
        employeeName={name}
        employeeCode={employee.employeeCode}
        jobTitle={employee.jobTitle}
        department={employee.department}
        startDate={employee.startDate}
        employmentType={employee.employmentType}
        status={employee.status}
      />
    );

    const filename = `employment-verification-${employee.employeeCode}.pdf`;
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
