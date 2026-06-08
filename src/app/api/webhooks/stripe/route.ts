// src/app/api/webhooks/stripe/route.ts
// POST /api/webhooks/stripe
// Stripe is the source of truth for billing. We verify the signature against
// the RAW request body, then sync subscription state into our DB and flip the
// user's tier. This route must be PUBLIC (exempt from Clerk middleware) and must
// read the raw body (no JSON parsing) for signature verification to work.

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, priceIdToTier } from "@/lib/stripe";
import type { SubscriptionStatus, SubscriptionTier } from "@prisma/client";

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    default:
      return "INCOMPLETE"; // incomplete, incomplete_expired, unpaid, paused
  }
}

/** Resolve our userId from a Stripe subscription (metadata first, then customer). */
async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.userId) return sub.metadata.userId;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const row = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

/** Sync one subscription's state into our DB + user tier. Idempotent. */
async function syncSubscription(sub: Stripe.Subscription) {
  const userId = await resolveUserId(sub);
  if (!userId) {
    console.warn("[stripe webhook] no user for subscription", sub.id);
    return;
  }

  const priceId = sub.items.data[0]?.price.id ?? null;
  const status = mapStatus(sub.status);
  const active = status === "ACTIVE" || status === "TRIALING";
  const tier: SubscriptionTier =
    active && priceIdToTier(priceId) === "PREMIUM" ? "PREMIUM" : "FREE";
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      update: {
        tier,
        status,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    }),
    prisma.user.update({ where: { id: userId }, data: { subscriptionTier: tier } }),
  ]);
}

export async function POST(req: NextRequest) {
  const body = await req.text(); // RAW body required for signature check
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return new NextResponse("Missing signature/secret", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        const row = customerId
          ? await prisma.subscription.findFirst({
              where: { stripeCustomerId: customerId },
              select: { userId: true },
            })
          : null;
        if (row && invoice.id) {
          await prisma.payment.upsert({
            where: { stripeInvoiceId: invoice.id },
            create: {
              userId: row.userId,
              stripeInvoiceId: invoice.id,
              amountCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
              currency: invoice.currency ?? "usd",
              status: event.type === "invoice.payment_succeeded" ? "paid" : "failed",
              paidAt: event.type === "invoice.payment_succeeded" ? new Date() : null,
            },
            update: {
              status: event.type === "invoice.payment_succeeded" ? "paid" : "failed",
            },
          });
        }
        break;
      }
      default:
        break; // ignore unhandled event types
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    // Return 500 so Stripe retries with backoff (the handler is idempotent).
    console.error("[stripe webhook] handler error", event.type, err);
    return new NextResponse("Handler error", { status: 500 });
  }
}
