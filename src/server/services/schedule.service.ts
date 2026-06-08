// src/server/services/schedule.service.ts
// The boundary layer: maps DB rows <-> pure engine types, owns ALL timezone
// math (Date <-> minute-offset, via Luxon), runs the engine, and persists the
// result transactionally. The engine stays pure; every messy real-world concern
// (timezones, DST, Prisma) lives here, in one place.

import { DateTime } from "luxon";
import type { Prisma, UserProfile, ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generate } from "@/server/scheduling/engine";
import type {
  EngineInput,
  EngineProfile,
  EngineTask,
  EngineWorkBlock,
  PlacedBlock,
  ProductivityWindow,
} from "@/server/scheduling/types";
import type { GenerateScheduleInput } from "@/types";

const MIN_PER_DAY = 24 * 60;
const DEFAULT_SLOT = 15;
const DEFAULT_MEAL_MINUTES = 30;

// ----------------------------- helpers -------------------------------

/** "HH:mm" -> minutes from midnight. */
function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Start of the local calendar day for `dateStr` in the user's timezone. */
function localStartOfDay(dateStr: string, tz: string): DateTime {
  return DateTime.fromISO(dateStr, { zone: tz }).startOf("day");
}

/** Local minute-offset (from day0 midnight) -> absolute JS Date (UTC instant). */
function offsetToDate(base: DateTime, offsetMin: number): Date {
  return base.plus({ minutes: offsetMin }).toJSDate();
}

/** Absolute Date -> minute-offset from day0 local midnight. */
function dateToOffset(base: DateTime, date: Date, tz: string): number {
  return Math.round(DateTime.fromJSDate(date, { zone: tz }).diff(base, "minutes").minutes);
}

function toEngineProfile(p: UserProfile): EngineProfile {
  const mealTimes = (p.mealTimes as string[]).map(hhmmToMinutes);
  const workBlocks: EngineWorkBlock[] = (
    p.workBlocks as { days: number[]; start: string; end: string }[]
  ).map((w) => ({
    days: w.days,
    startMinute: hhmmToMinutes(w.start),
    endMinute: hhmmToMinutes(w.end),
  }));

  return {
    timezone: "", // set by caller
    wakeMinute: hhmmToMinutes(p.wakeTime),
    sleepMinute: hhmmToMinutes(p.sleepTime),
    targetSleepMinutes: Math.round(Number(p.targetSleepHours) * 60),
    minSleepMinutes: Math.round(Number(p.minSleepHours) * 60),
    mealMinutes: mealTimes,
    mealDurationMinutes: DEFAULT_MEAL_MINUTES,
    exerciseEnabled: p.exerciseEnabled,
    exerciseMinutes: p.exerciseMinutes,
    napMinutes: p.napEnabled ? Math.min(p.napMinutes, 60) : 0,
    commuteMinutes: p.commuteMinutes,
    workBlocks,
    optionalActivities: p.optionalActivities as string[],
  };
}

// --------------------------- generation ------------------------------

export async function generateAndPersistSchedule(
  userId: string,
  timezone: string,
  input: GenerateScheduleInput,
  isPremiumUser = false,
) {
  const profileRow = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profileRow) throw new Error("Profile not found");

  const base = localStartOfDay(input.date, timezone);
  const horizonEndDate = base.plus({ days: input.horizonDays }).toJSDate();

  // Pull schedulable tasks: not done/canceled/deleted, deadline within horizon (or none).
  const taskRows = await prisma.task.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { in: ["PENDING", "SCHEDULED", "IN_PROGRESS", "DEFERRED"] },
      OR: [{ deadline: null }, { deadline: { lte: horizonEndDate } }],
    },
  });

  const tasks: EngineTask[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    remainingMinutes: t.remainingMinutes,
    deadlineMinute: t.deadline ? dateToOffset(base, t.deadline, timezone) : null,
    priority: t.priority,
    isSplittable: t.isSplittable,
  }));

  const productivity = await loadProductivityWindows(userId, input.date);

  // Generate the full day regardless of the current clock time: only the date
  // matters, not "now". Starting at 0 keeps the morning from being trimmed.
  const nowMinute = 0;

  const engineInput: EngineInput = {
    startDate: input.date,
    horizonDays: input.horizonDays,
    slotMinutes: DEFAULT_SLOT,
    nowMinute,
    mode: input.mode,
    profile: { ...toEngineProfile(profileRow), timezone },
    tasks,
    productivity,
    enforceMealCaps: !isPremiumUser, // free users are locked to meal-time caps
  };

  const result = generate(engineInput);

  await persist(userId, base, timezone, input, result.blocks, result.meta);

  // Build a UI-friendly response (absolute ISO times).
  return {
    feasible: result.feasible,
    warnings: result.warnings,
    overload: result.overload,
    migrations: result.migrations,
    blocks: result.blocks.map((b) => ({
      activityType: b.activityType,
      title: b.title,
      taskId: b.taskId,
      start: offsetToDate(base, b.startMinute).toISOString(),
      end: offsetToDate(base, b.endMinute).toISOString(),
      isHealthBlock: b.isHealthBlock,
      isFixed: b.isFixed,
    })),
  };
}

/** Persist blocks grouped by calendar day, one DailySchedule per date. */
async function persist(
  userId: string,
  base: DateTime,
  timezone: string,
  input: GenerateScheduleInput,
  blocks: PlacedBlock[],
  meta: { inputsHash: string; version: string },
) {
  // Group blocks by calendar-day index (minutes / 1440).
  const byDay = new Map<number, PlacedBlock[]>();
  for (const b of blocks) {
    const dayIdx = Math.floor(b.startMinute / MIN_PER_DAY);
    (byDay.get(dayIdx) ?? byDay.set(dayIdx, []).get(dayIdx)!).push(b);
  }

  await prisma.$transaction(async (tx) => {
    for (const [dayIdx, dayBlocks] of byDay) {
      const dateStr = base.plus({ days: dayIdx }).toISODate()!;
      const dateOnly = new Date(`${dateStr}T00:00:00.000Z`);
      const totalSleep = dayBlocks
        .filter((b) => b.activityType === "SLEEP")
        .reduce((s, b) => s + (b.endMinute - b.startMinute), 0);

      const schedule = await tx.dailySchedule.upsert({
        where: { userId_date: { userId, date: dateOnly } },
        create: {
          userId,
          date: dateOnly,
          mode: input.mode,
          totalSleepMinutes: totalSleep,
          generationMeta: meta as unknown as Prisma.InputJsonValue,
        },
        update: {
          mode: input.mode,
          totalSleepMinutes: totalSleep,
          generationMeta: meta as unknown as Prisma.InputJsonValue,
        },
      });

      // Replace blocks for an idempotent regeneration.
      await tx.scheduleBlock.deleteMany({ where: { scheduleId: schedule.id } });
      await tx.scheduleBlock.createMany({
        data: dayBlocks.map((b) => ({
          scheduleId: schedule.id,
          activityType: b.activityType as ActivityType,
          title: b.title ?? null,
          taskId: b.taskId ?? null,
          startTime: offsetToDate(base, b.startMinute),
          endTime: offsetToDate(base, b.endMinute),
          isFixed: b.isFixed,
          isHealthBlock: b.isHealthBlock,
        })),
      });
    }

    // Mark tasks that received at least one block as SCHEDULED.
    const scheduledTaskIds = Array.from(
      new Set(blocks.filter((b) => b.taskId).map((b) => b.taskId as string)),
    );
    if (scheduledTaskIds.length) {
      await tx.task.updateMany({
        where: { id: { in: scheduledTaskIds }, status: "PENDING" },
        data: { status: "SCHEDULED" },
      });
    }

    // Record non-standard modes for the once-per-48h rule.
    if (input.mode !== "STANDARD") {
      await tx.overloadEvent.create({
        data: { userId, date: new Date(`${input.date}T00:00:00.000Z`), mode: input.mode },
      });
    }
  });
}

async function loadProductivityWindows(
  userId: string,
  date: string,
): Promise<ProductivityWindow[]> {
  const prediction = await prisma.prediction.findUnique({
    where: { userId_targetDate: { userId, targetDate: new Date(`${date}T00:00:00.000Z`) } },
  });
  if (!prediction) return [];
  return prediction.predictedWindows as unknown as ProductivityWindow[];
}

// ----------------------------- reads ---------------------------------

export async function getSchedule(userId: string, date: string, rangeDays: number) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + rangeDays);

  const schedules = await prisma.dailySchedule.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
    include: {
      blocks: { orderBy: { startTime: "asc" }, include: { completion: true } },
    },
  });
  return schedules;
}
