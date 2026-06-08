// src/components/billing/pricing-table.tsx
"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{text}</span>
    </li>
  );
}

export function PricingTable() {
  const { t, list } = useI18n();
  const [loading, setLoading] = useState(false);

  async function upgrade() {
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID;
    if (!priceId) return toast.error(t("price.notConfigured"));
    setLoading(true);
    try {
      const { url } = await api.checkout(priceId);
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("price.checkoutErr"));
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <h3 className="font-display text-xl font-semibold">{t("price.free")}</h3>
            <p className="mt-1 text-3xl font-semibold tabular-nums">0&nbsp;₫</p>
          </div>
          <ul className="space-y-2">{list("price.freeFeatures").map((f) => <Feature key={f} text={f} />)}</ul>
          <Button variant="outline" className="w-full" disabled>{t("price.current")}</Button>
        </CardContent>
      </Card>

      <Card className="border-primary/40">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold">{t("price.premium")}</h3>
            <Badge>{t("price.recommended")}</Badge>
          </div>

          {/* Ưu đãi dùng thử */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" /> {t("price.trial")}
            </p>
          </div>

          <p className="text-3xl font-semibold tabular-nums">
            30.000&nbsp;₫<span className="text-base font-normal text-muted-foreground"> {t("price.perMonth")}</span>
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("price.premiumOnly")}
            </p>
            <ul className="space-y-2">{list("price.premiumFeatures").map((f) => <Feature key={f} text={f} />)}</ul>
          </div>

          <Button className="w-full" onClick={upgrade} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("price.startTrial")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t("price.cancel")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
