// src/components/billing/billing-panel.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function BillingPanel() {
  const { t } = useI18n();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);

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

  async function manage() {
    setLoading(true);
    try {
      const { url } = await api.billingPortal();
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("set.billingErr"));
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("set.billing")}</h2>
      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <Badge variant={isPremium ? "default" : "secondary"}>{isPremium ? t("set.planPremium") : t("set.planFree")}</Badge>
            <span className="text-sm text-muted-foreground">{isPremium ? t("set.premiumDesc") : t("set.freeDesc")}</span>
          </div>
          {isPremium ? (
            <Button variant="outline" size="sm" onClick={manage} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("set.manage")}
            </Button>
          ) : (
            <Button asChild size="sm"><Link href="/pricing">{t("set.upgrade")}</Link></Button>
          )}
        </CardContent>
      </Card>
      <Separator />
    </section>
  );
}
