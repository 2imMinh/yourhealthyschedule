// src/app/api/schedule/route.ts
// GET /api/schedule?date=YYYY-MM-DD&rangeDays=1
// Returns persisted DailySchedule(s) with their blocks + completion state.

import type { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok } from "@/lib/api-response";
import { scheduleQuerySchema } from "@/types";
import { getSchedule } from "@/server/services/schedule.service";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { date, rangeDays } = scheduleQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const schedules = await getSchedule(user.id, date, rangeDays);
    return ok(schedules);
  });
}
