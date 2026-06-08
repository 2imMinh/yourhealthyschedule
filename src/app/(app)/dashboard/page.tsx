import { PageHeader } from "@/components/layout/page-header";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader titleKey="header.dashboard.title" subKey="header.dashboard.sub" />
      <DashboardView />
    </div>
  );
}
