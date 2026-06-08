import { PageHeader } from "@/components/layout/page-header";
import { CalendarView } from "@/components/calendar/calendar-view";

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader titleKey="header.calendar.title" subKey="header.calendar.sub" />
      <CalendarView />
    </div>
  );
}
