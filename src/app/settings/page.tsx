import { AppShell } from "@/components/layout/app-shell";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { SettingsForm } from "@/components/settings/settings-form";
import { BrandingSettingsForm } from "@/components/settings/branding-settings-form";
import { GoogleDriveSettings } from "@/components/settings/google-drive-settings";
import { TeamInviteForm } from "@/components/settings/team-invite-form";
import { Suspense } from "react";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !can(session.user.role, "manageCompanySettings")) {
    redirect("/dashboard");
  }

  const canEditStatutory = can(session.user.role, "manageStatutoryRates");
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          {canEditStatutory
            ? "Company branding, team, statutory rates, and Google Workspace sync"
            : "Company branding and Google Workspace sync — statutory rates are Super Admin only"}
        </p>
      </div>
      <BrandingSettingsForm />
      {isSuperAdmin && <TeamInviteForm />}
      {canEditStatutory && <SettingsForm />}
      <Suspense fallback={null}>
        <GoogleDriveSettings />
      </Suspense>
    </AppShell>
  );
}
