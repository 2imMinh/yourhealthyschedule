// src/lib/stripe.ts
// Stripe client singleton + plan configuration. Price IDs come from env so the
// same code runs against test and live modes without changes. We intentionally
// do NOT pin an apiVersion string here (the SDK uses its built-in pinned
// default); pin it explicitly via the constructor if your account requires it.

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey && process.env.NODE_ENV === "production") {
  // Surface misconfiguration early in prod; in dev we allow boot without it.
  console.warn("[stripe] STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(secretKey ?? "", { typescript: true });

/** The single premium price (monthly). Extend this map for more tiers. */
export const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID ?? "";

export const PLANS = {
  premium: {
    priceId: PREMIUM_PRICE_ID,
    name: "Premium",
    features: [
      "Emergency scheduling mode (sleep under 6h, with consent)",
      "Run tasks during work/study blocks",
      "AI substitution suggestions (delivery, light cardio, etc.)",
    ],
  },
} as const;

/** Map a Stripe price id back to our subscription tier. */
export function priceIdToTier(priceId: string | null | undefined) {
  return priceId && priceId === PREMIUM_PRICE_ID ? "PREMIUM" : "FREE";
}

/** Absolute base URL for Checkout/Portal redirects. */
export function appUrl(path = ""): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}
