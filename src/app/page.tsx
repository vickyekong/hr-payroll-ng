import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { homePathForRole } from "@/lib/permissions";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role) {
    redirect(homePathForRole(session.user.role));
  }
  return <LandingPage />;
}
