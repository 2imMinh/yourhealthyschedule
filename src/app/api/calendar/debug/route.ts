// src/app/api/calendar/debug/route.ts
// GET /api/calendar/debug — shows which Google OAuth scopes Clerk holds for the
// current user's token. Open this in the browser (while signed in) to verify
// whether the calendar scope was actually granted. Premium-only.
import { clerkClient } from "@clerk/nextjs/server";
import { requireUser, isPremium } from "@/server/auth/current-user";
import { handle, ok, errorResponse } from "@/lib/api-response";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    if (!isPremium(user)) {
      return errorResponse(403, "PREMIUM_REQUIRED", "Premium feature");
    }
    const cc = await clerkClient();

    const result: Record<string, unknown> = { connectedGoogle: false };
    for (const provider of ["google", "oauth_google"]) {
      try {
        const r = await cc.users.getUserOauthAccessToken(user.id, provider as "oauth_google");
        const first = (r?.data ?? [])[0] as { token?: string; scopes?: string[] | string } | undefined;
        if (first?.token) {
          const raw = first.scopes ?? [];
          const scopes = Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/).filter(Boolean);
          result.connectedGoogle = true;
          result.provider = provider;
          result.scopes = scopes;
          result.hasCalendarScope = scopes.includes(CALENDAR_SCOPE);
          break;
        }
      } catch (e) {
        result[`error_${provider}`] = e instanceof Error ? e.message : String(e);
      }
    }
    return ok(result);
  });
}
