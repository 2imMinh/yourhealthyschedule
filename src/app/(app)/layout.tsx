// src/app/(app)/layout.tsx
// Authenticated shell: persistent sidebar + top bar. Auth is enforced by
// middleware; this just composes the chrome around each page.

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-5 pb-24 pt-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
