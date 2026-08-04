import { AppShell } from "@/components/layout/app-shell";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { SettingsForm } from "@/components/settings/settings-form";
import { GoogleDriveSettings } from "@/components/settings/google-drive-settings";
import { Suspense } from "react";

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
          Statutory rates, PAYE tax bands, and Google Workspace sync — Super Admin
          only
        </p>
      </div>
      <SettingsForm />
      <Suspense fallback={null}>
        <GoogleDriveSettings />
      </Suspense>
    </AppShell>
  );
}
