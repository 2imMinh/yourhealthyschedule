// src/app/api/schedule/generate/route.ts
// POST /api/schedule/generate
// Standard mode is open to everyone. Non-standard modes (OVERLOAD/EMERGENCY)
// are rationed to once per rolling 48h; EMERGENCY additionally requires premium.
// The actual relaxation is decided by the engine; this handler only guards.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isPremium } from "@/server/auth/current-user";
import { handle, ok, premiumRequired, rationed } from "@/lib/api-response";
import { generateScheduleSchema } from "@/types";
import { generateAndPersistSchedule } from "@/server/services/schedule.service";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const input = generateScheduleSchema.parse(await req.json());

    if (input.mode !== "STANDARD") {
      // Premium gate for emergency (sleep-cutting) mode.
      if (input.mode === "EMERGENCY" && !isPremium(user)) {
        throw premiumRequired("Emergency mode is a premium feature.");
      }
      // Once-per-48h ration for any non-standard mode.
      const since = new Date(Date.now() - FORTY_EIGHT_HOURS_MS);
      const recent = await prisma.overloadEvent.findFirst({
        where: { userId: user.id, triggeredAt: { gte: since } },
        orderBy: { triggeredAt: "desc" },
      });
      if (recent) {
        throw rationed(
          "Overload mode can be used at most once every 48 hours. Try rebalancing your tasks instead.",
        );
      }
    }

    // Use the browser's timezone so generated clock times match what the user
    // sees. Persist it so the stored profile stays correct for next time.
    const tz = input.timezone && input.timezone.length > 0 ? input.timezone : user.timezone;
    if (input.timezone && input.timezone !== user.timezone) {
      await prisma.user.update({ where: { id: user.id }, data: { timezone: input.timezone } });
    }

    const result = await generateAndPersistSchedule(user.id, tz, input, isPremium(user));
    return ok(result);
  });
}
