// src/components/settings/appearance-form.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AppearanceForm() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = (await api.me()) as { isPremium: boolean };
        setIsPremium(me.isPremium);
      } catch {
        setIsPremium(false);
      }
    })();
  }, []);

  // Nếu không phải Premium, ép về chế độ sáng.
  useEffect(() => {
    if (!isPremium && theme === "dark") setTheme("light");
  }, [isPremium, theme, setTheme]);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("set.appearance")}</h2>
      <div className="flex items-center justify-between">
        <div>
          <Label>{t("set.darkMode")}</Label>
          <p className="text-xs text-muted-foreground">{isPremium ? t("set.darkDesc") : t("set.darkPremium")}</p>
        </div>
        <Switch
          checked={theme === "dark"}
          disabled={!isPremium}
          onCheckedChange={(v) => isPremium && setTheme(v ? "dark" : "light")}
        />
      </div>
    </section>
  );
}
