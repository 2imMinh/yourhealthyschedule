// src/components/layout/language-toggle.tsx
// Nút chuyển ngôn ngữ nổi ở góc dưới-phải màn hình, hiện trên mọi trang.
"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === "vi" ? "en" : "vi")}
      aria-label="Chuyển ngôn ngữ / Switch language"
      className="fixed bottom-20 right-4 z-50 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-secondary md:bottom-4"
    >
      <Languages className="h-4 w-4" />
      {lang === "vi" ? "VN" : "EN"}
    </button>
  );
}
