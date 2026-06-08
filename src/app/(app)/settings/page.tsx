import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { AppearanceForm } from "@/components/settings/appearance-form";
import { BillingPanel } from "@/components/billing/billing-panel";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <PageHeader titleKey="header.settings.title" subKey="header.settings.sub" />
      <ProfileForm />
      <AppearanceForm />
      <BillingPanel />
    </div>
  );
}
