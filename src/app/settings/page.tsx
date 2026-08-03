import { AppShell } from "@/components/layout/app-shell";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!can(session!.user.role, "manageStatutoryRates")) {
    redirect("/dashboard");
  }

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Statutory rates and PAYE tax bands — Super Admin only
        </p>
      </div>
      <SettingsForm />
    </AppShell>
  );
}
