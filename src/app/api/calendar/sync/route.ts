// src/app/api/calendar/sync/route.ts
// POST /api/calendar/sync — one-way push of the generated schedule into a
// dedicated "Your Healthy Schedule" Google Calendar. Premium-only.
//
// Auth/token: the user must have signed in with Google (Clerk social connection)
// AND granted the calendar scope; we read the Google OAuth access token Clerk
// stores for that user. The dedicated calendar id is kept in Clerk privateMetadata
// so re-syncs clear + rewrite the window cleanly (no duplicates, no DB migration).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { requireUser, isPremium } from "@/server/auth/current-user";
import { handle, ok, errorResponse } from "@/lib/api-response";
import { getSchedule } from "@/server/services/schedule.service";
import { gcal, GoogleCalendarError } from "@/lib/google-calendar";

export const maxDuration = 60; // creating many events can take a while

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rangeDays: z.number().int().min(1).max(14).default(7),
});

type Cc = Awaited<ReturnType<typeof clerkClient>>;

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

async function getGoogleToken(
  cc: Cc,
  userId: string,
): Promise<{ token: string; scopes: string[] } | null> {
  for (const provider of ["google", "oauth_google"]) {
    try {
      const r = await cc.users.getUserOauthAccessToken(userId, provider);
      const first = (r?.data ?? [])[0];
      if (first?.token) {
        // Clerk returns scopes as string[] or a space/comma-joined string.
        const raw = (first as { scopes?: string[] | string }).scopes ?? [];
        const scopes = Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/).filter(Boolean);
        return { token: first.token, scopes };
      }
    } catch {
      /* try next provider name */
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!isPremium(user)) {
      return errorResponse(403, "PREMIUM_REQUIRED", "Google Calendar sync is a Premium feature");
    }
    const { date, rangeDays } = bodySchema.parse(await req.json());

    const cc = await clerkClient();
    const auth = await getGoogleToken(cc, user.id);
    if (!auth) {
      return errorResponse(
        400,
        "NO_GOOGLE",
        "Connect your Google account (sign in with Google) to enable calendar sync.",
      );
    }
    // Detect a token that lacks the calendar scope BEFORE calling Google, so we
    // can give an actionable message instead of a raw 403.
    if (auth.scopes.length > 0 && !auth.scopes.includes(CALENDAR_SCOPE)) {
      console.warn("[calendar sync] token missing calendar scope. scopes =", auth.scopes);
      return errorResponse(
        400,
        "GOOGLE_SCOPE",
        "Your Google sign-in doesn't include the calendar permission yet. In the app, disconnect your Google account and reconnect it (sign in with Google again) so Google asks for the calendar permission.",
      );
    }
    const token = auth.token;

    // Collect the blocks to push.
    const schedules = (await getSchedule(user.id, date, rangeDays)) as Array<{
      blocks: Array<{ title: string | null; activityType: string; startTime: Date | string; endTime: Date | string }>;
    }>;
    const blocks = schedules.flatMap((s) => s.blocks);
    if (blocks.length === 0) {
      return ok({ synced: 0, empty: true });
    }

    // Write to the user's PRIMARY calendar. Creating a separate calendar needs
    // the broader "calendar" scope; events.insert on primary only needs
    // "calendar.events" (which we have). We tag our events with a private
    // property so re-syncs can find + clear only our own events.
    const calId = "primary";
    const TAG = "app=ai-healthy-scheduler";

    try {
      // Clear the window we are about to (re)write — but only OUR tagged events.
      const startMs = Math.min(...blocks.map((b) => new Date(b.startTime).getTime()));
      const endMs = Math.max(...blocks.map((b) => new Date(b.endTime).getTime()));
      const timeMin = new Date(startMs).toISOString();
      const timeMax = new Date(endMs).toISOString();

      const existing = await gcal.listEvents(token, calId, timeMin, timeMax, TAG);
      for (const ev of (existing?.items ?? []) as Array<{ id: string }>) {
        try {
          await gcal.deleteEvent(token, calId, ev.id);
        } catch {
          /* ignore individual delete errors */
        }
      }

      let synced = 0;
      for (const b of blocks) {
        await gcal.insertEvent(token, calId, {
          summary: (b.title && b.title.trim()) || b.activityType,
          start: { dateTime: new Date(b.startTime).toISOString(), timeZone: user.timezone },
          end: { dateTime: new Date(b.endTime).toISOString(), timeZone: user.timezone },
          extendedProperties: { private: { app: "ai-healthy-scheduler" } },
        });
        synced++;
      }
      return ok({ synced });
    } catch (err) {
      if (err instanceof GoogleCalendarError) {
        console.error("[calendar sync] google error:", err.status, err.detail);
        if (err.status === 401 || err.status === 403) {
          return errorResponse(
            400,
            "GOOGLE_SCOPE",
            "Google denied access. Sign out and sign in with Google again, accepting the calendar permission.",
          );
        }
      }
      throw err;
    }
  });
}
