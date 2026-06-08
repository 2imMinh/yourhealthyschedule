// src/components/layout/topbar.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, lang } = useI18n();
  const showBack = pathname !== "/dashboard";

  const today = new Date().toLocaleDateString(lang === "vi" ? "vi-VN" : undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur md:px-8">
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={() => router.back()}
            aria-label={t("common.back")}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.back")}</span>
          </button>
        )}
        <span className="font-display text-base font-semibold md:hidden">
          Your&nbsp;Healthy&nbsp;Schedule
        </span>
        <span className="hidden text-sm text-muted-foreground md:inline">{today}</span>
      </div>

      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  );
}
