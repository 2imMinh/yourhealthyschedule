import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader titleKey="header.analytics.title" subKey="header.analytics.sub" />
      <AnalyticsView />
    </div>
  );
}
