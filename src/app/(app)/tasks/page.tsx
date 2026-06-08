import { PageHeader } from "@/components/layout/page-header";
import { TasksView } from "@/components/tasks/tasks-view";

export default function TasksPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader titleKey="header.tasks.title" subKey="header.tasks.sub" />
      <TasksView />
    </div>
  );
}
