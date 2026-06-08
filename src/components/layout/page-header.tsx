// src/components/layout/page-header.tsx
// Tiêu đề trang có dịch — dùng trong các page (server) qua một component client nhỏ.
"use client";

import { useI18n } from "@/lib/i18n";

export function PageHeader({ titleKey, subKey }: { titleKey: string; subKey: string }) {
  const { t } = useI18n();
  return (
    <header className="mb-6">
      <h1 className="font-display text-3xl font-semibold">{t(titleKey)}</h1>
      <p className="text-sm text-muted-foreground">{t(subKey)}</p>
    </header>
  );
}
