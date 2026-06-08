// src/app/api/webhooks/clerk/route.ts
// POST /api/webhooks/clerk
// Primary source of user creation/sync. Verified with Svix (Clerk's webhook
// signer). Must be PUBLIC (exempt from middleware). The current-user resolver
// also lazily creates users, so this and that path are both safe (idempotent).

import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

interface ClerkEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string }[];
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("Missing secret", { status: 400 });

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkEvent;
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const email = event.data.email_addresses?.[0]?.email_address ?? `${event.data.id}@placeholder.local`;
        await prisma.user.upsert({
          where: { id: event.data.id },
          create: {
            id: event.data.id,
            email,
            profile: { create: {} },
            subscription: { create: {} },
          },
          update: { email, deletedAt: null },
        });
        break;
      }
      case "user.deleted": {
        // Soft delete to preserve history; cascade-hard-delete is also valid.
        await prisma.user.updateMany({
          where: { id: event.data.id },
          data: { deletedAt: new Date() },
        });
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[clerk webhook] handler error", err);
    return new NextResponse("Handler error", { status: 500 });
  }
}
