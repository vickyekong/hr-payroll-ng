import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api-auth";

export async function GET() {
  try {
    await ensureAuthSchema();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { totpEnabled: true },
    });

    return NextResponse.json({ totpEnabled: user.totpEnabled });
  } catch (error) {
    return handleApiError(error);
  }
}
