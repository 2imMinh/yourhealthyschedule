// src/app/api/analytics/route.ts
// GET /api/analytics?range=daily|weekly|monthly&date=YYYY-MM-DD
// Returns a per-day series + totals for the Recharts dashboards.
//
// MVP computes live from schedules + completions. The DailyStat rollup table
// exists for scale: a nightly job would populate it and this query would read
// it directly, turning a multi-row scan into a handful of pre-aggregated rows.

import type { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/current-user";
import { handle, ok } from "@/lib/api-response";
import { analyticsQuerySchema } from "@/types";
import type { Prisma } from "@prisma/client";

const RANGE_DAYS = { daily: 1, weekly: 7, monthly: 30 } as const;

type ScheduleWithBlocks = Prisma.DailyScheduleGetPayload<{
  include: { blocks: { include: { completion: true } } };
}>;

interface DaySeries {
  date: string;
  completionRate: number;
  healthAdherenceRate: number;
  sleepMinutes: number;
  minutesByActivity: Record<string, number>;
}

function computeDay(schedule: ScheduleWithBlocks): DaySeries {
  const minutesByActivity: Record<string, number> = {};
  let total = 0;
  let completed = 0;
  let healthTotal = 0;
  let healthCompleted = 0;
  let sleepMinutes = 0;

  for (const b of schedule.blocks) {
    const minutes = Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000);
    minutesByActivity[b.activityType] = (minutesByActivity[b.activityType] ?? 0) + minutes;
    if (b.activityType === "SLEEP") sleepMinutes += minutes;

    const isDone = b.completion?.status === "COMPLETED";
    total += 1;
    if (isDone) completed += 1;
    if (b.isHealthBlock) {
      healthTotal += 1;
      if (isDone) healthCompleted += 1;
    }
  }

  return {
    date: DateTime.fromJSDate(schedule.date, { zone: "utc" }).toISODate()!,
    completionRate: total ? completed / total : 0,
    healthAdherenceRate: healthTotal ? healthCompleted / healthTotal : 0,
    sleepMinutes,
    minutesByActivity,
  };
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { range, date } = analyticsQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const days = RANGE_DAYS[range];
    const anchor = date ?? DateTime.now().setZone(user.timezone).toISODate()!;
    const end = new Date(`${anchor}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1); // inclusive of the anchor day
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);

    const schedules = await prisma.dailySchedule.findMany({
      where: { userId: user.id, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
      include: { blocks: { include: { completion: true } } },
    });

    const series = schedules.map(computeDay);

    // Totals across the range.
    const totalsByActivity: Record<string, number> = {};
    let totalSleep = 0;
    let completionSum = 0;
    let healthSum = 0;
    for (const d of series) {
      for (const [act, min] of Object.entries(d.minutesByActivity)) {
        totalsByActivity[act] = (totalsByActivity[act] ?? 0) + min;
      }
      totalSleep += d.sleepMinutes;
      completionSum += d.completionRate;
      healthSum += d.healthAdherenceRate;
    }
    const n = series.length || 1;

    return ok({
      range,
      from: DateTime.fromJSDate(start, { zone: "utc" }).toISODate(),
      to: anchor,
      series,
      totals: {
        minutesByActivity: totalsByActivity,
        avgCompletionRate: completionSum / n,
        avgHealthAdherenceRate: healthSum / n,
        avgSleepMinutes: Math.round(totalSleep / n),
        daysTracked: series.length,
      },
    });
  });
}
