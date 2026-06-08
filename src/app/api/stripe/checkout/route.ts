// src/app/api/stripe/checkout/route.ts
// POST /api/stripe/checkout  -> { url }
// Creates a subscription Checkout session for the premium plan. Ensures the
// user has a Stripe customer (created lazily, id persisted), and stamps the
// userId onto the session + subscription so the webhook can map events back.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok, badRequest } from "@/lib/api-response";
import { stripe, appUrl, PREMIUM_PRICE_ID } from "@/lib/stripe";
import { checkoutSchema } from "@/types";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { priceId } = checkoutSchema.parse(await req.json());

    if (priceId !== PREMIUM_PRICE_ID) {
      throw badRequest("Unknown price");
    }
    if (user.subscriptionTier === "PREMIUM") {
      throw badRequest("Already on the premium plan");
    }

    // Ensure a Stripe customer exists for this user.
    let customerId = user.subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id, stripeCustomerId: customerId },
        update: { stripeCustomerId: customerId },
      });
    }

    // Optional free trial (e.g. 30 days). Configure via STRIPE_TRIAL_DAYS.
    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS ?? 0);
    const subscriptionData: {
      metadata: { userId: string };
      trial_period_days?: number;
    } = { metadata: { userId: user.id } };
    if (Number.isFinite(trialDays) && trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: subscriptionData,
      success_url: appUrl("/settings?checkout=success"),
      cancel_url: appUrl("/pricing?checkout=cancel"),
    });

    return ok({ url: session.url });
  });
}
