import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { homePathForRole } from "@/lib/permissions";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  redirect(homePathForRole(session.user.role));
}
