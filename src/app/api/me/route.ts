// src/app/api/me/route.ts
// GET /api/me -> info about the signed-in user. `isPremium` is computed
// server-side (subscription OR founder allowlist) and is the source of truth
// the client uses to gate premium-only UI.

import { requireUser, isPremium } from "@/server/auth/current-user";
import { handle, ok } from "@/lib/api-response";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok({
      isPremium: isPremium(user),
      subscriptionTier: user.subscriptionTier,
      email: user.email,
    });
  });
}
