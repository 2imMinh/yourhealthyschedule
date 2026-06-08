// src/app/api/stripe/portal/route.ts
// POST /api/stripe/portal -> { url }
// Opens Stripe's hosted billing portal so the user can update payment methods,
// view invoices, or cancel. Requires an existing Stripe customer.

import { requireUser } from "@/server/auth/current-user";
import { handle, ok, badRequest } from "@/lib/api-response";
import { stripe, appUrl } from "@/lib/stripe";

export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    const customerId = user.subscription?.stripeCustomerId;
    if (!customerId) {
      throw badRequest("No billing account found. Upgrade first.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl("/settings"),
    });

    return ok({ url: session.url });
  });
}
