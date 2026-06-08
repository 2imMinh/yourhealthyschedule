// src/app/(marketing)/page.tsx
"use client";

import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useI18n } from "@/lib/i18n";

export default function LandingPage() {
  const { t } = useI18n();
  const features = [
    { t: t("land.feat1t"), d: t("land.feat1d") },
    { t: t("land.feat2t"), d: t("land.feat2d") },
    { t: t("land.feat3t"), d: t("land.feat3d") },
  ];

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, hsl(155 30% 32% / 0.10), transparent), radial-gradient(50% 40% at 90% 10%, hsl(32 78% 52% / 0.10), transparent)",
        }}
      />
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold">Your&nbsp;Healthy&nbsp;Schedule</span>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">{t("land.pricing")}</Link>
          <SignedOut>
            <Link href="/sign-in" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
              {t("land.signin")}
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
              {t("land.openapp")}
            </Link>
          </SignedIn>
        </div>
      </nav>

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-center md:pt-28">
        <p className="mb-4 inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          {t("land.eyebrow")}
        </p>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] md:text-7xl">
          {t("land.h1a")}
          <span className="text-primary">{t("land.h1accent")}</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{t("land.sub")}</p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/sign-up" className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-sm transition hover:opacity-90">
            {t("land.startFree")}
          </Link>
          <Link href="/pricing" className="rounded-lg border border-border bg-card px-6 py-3 font-medium transition hover:bg-secondary">
            {t("land.seePlans")}
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-28 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-xl font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
