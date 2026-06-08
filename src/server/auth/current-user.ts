// src/server/auth/current-user.ts
// Resolves the authenticated Clerk session to our local DB User row.
//
// Source of truth for user creation is the Clerk webhook (api/webhooks/clerk),
// but we also lazily upsert here so the app never 500s if a request lands
// before the webhook has fired (race on first sign-in). Idempotent upsert
// makes the two paths safe together.

import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, User } from "@prisma/client";

/** Thrown by requireUser() when there is no authenticated session. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

type UserWithRelations = Prisma.UserGetPayload<{
  include: { profile: true; subscription: true };
}>;

/**
 * Returns the DB user for the current session, or null if unauthenticated.
 * Lazily creates the user (and a default profile) on first access.
 */
export async function getCurrentUser(): Promise<UserWithRelations | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, subscription: true },
  });
  if (existing && !existing.deletedAt) return existing;

  // First-touch fallback: pull identity from Clerk and create the row.
  const clerkUser = await clerkCurrentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    `${userId}@placeholder.local`;

  return prisma.user.upsert({
    where: { id: userId },
    update: { deletedAt: null }, // un-soft-delete if they returned
    create: {
      id: userId,
      email,
      profile: { create: {} }, // schema defaults fill the rest
      subscription: { create: {} },
    },
    include: { profile: true, subscription: true },
  });
}

/**
 * Like getCurrentUser() but throws UnauthorizedError when there is no session.
 * Use in route handlers that require auth; the error is mapped to 401 by the
 * shared response helper.
 */
export async function requireUser(): Promise<UserWithRelations> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Founder allowlist — these emails always count as Premium, regardless of
 * subscription state. Configure via the FOUNDER_EMAILS env var (comma-separated);
 * falls back to the built-in founder address.
 */
const FOUNDER_EMAILS = (
  process.env.FOUNDER_EMAILS ?? "hoangtuanminh20072006@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Convenience guard for premium-gated routes (subscription OR founder). */
export function isPremium(user: Pick<User, "subscriptionTier" | "email">): boolean {
  if (user.subscriptionTier === "PREMIUM") return true;
  return FOUNDER_EMAILS.includes(user.email.toLowerCase());
}
