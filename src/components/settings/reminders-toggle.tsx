// src/components/settings/reminders-toggle.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function RemindersToggle() {
  const { t } = useI18n();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(typeof window !== "undefined" && localStorage.getItem("reminders") === "on");
  }, []);

  async function toggle(next: boolean) {
    if (next) {
      if (typeof Notification === "undefined") return;
      let perm = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error(t("rem.denied"));
        return;
      }
    }
    localStorage.setItem("reminders", next ? "on" : "off");
    setOn(next);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("set.reminders")}</h2>
      <div className="flex items-center justify-between">
        <div>
          <Label>{t("rem.toggle")}</Label>
          <p className="text-xs text-muted-foreground">{t("rem.desc")}</p>
        </div>
        <Switch checked={on} onCheckedChange={toggle} />
      </div>
    </section>
  );
}
