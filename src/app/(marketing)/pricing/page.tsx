// src/app/(marketing)/pricing/page.tsx
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PricingTable } from "@/components/billing/pricing-table";

export default function PricingPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <Link href="/" className="mb-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Link>
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold md:text-5xl">{t("header.pricing.title")}</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{t("header.pricing.sub")}</p>
      </div>
      <div className="mt-12">
        <PricingTable />
      </div>
    </main>
  );
}
