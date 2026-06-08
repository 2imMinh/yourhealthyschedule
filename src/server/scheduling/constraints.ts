// src/server/scheduling/constraints.ts
// Lays the hard + health layers and computes the free intervals tasks can use.
//
// Day model: a "day" runs wake -> next wake (how people actually experience a
// day), so each day's sleep sits at the END of its window. The horizon is
// [wakeMinute, wakeMinute + horizonDays*1440] in minutes from local midnight of
// day 0. Pure integer math throughout (weekday via Zeller's congruence) so the
// module never touches Date and stays deterministic + unit-testable.

import type {
  EngineInput,
  EngineProfile,
  FreeInterval,
  Minutes,
  PlacedBlock,
  Warning,
} from "./types";

const MIN_PER_DAY = 24 * 60;

// --------------------------- small helpers ---------------------------

const overlaps = (aS: number, aE: number, bS: number, bE: number) =>
  aS < bE && bS < aE;

/** Day-of-week (0=Sun..6=Sat) for "YYYY-MM-DD" via Zeller's congruence. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  let Y = y;
  let M = m;
  if (M < 3) {
    M += 12;
    Y -= 1;
  }
  const K = Y % 100;
  const J = Math.floor(Y / 100);
  const h =
    (d +
      Math.floor((13 * (M + 1)) / 5) +
      K +
      Math.floor(K / 4) +
      Math.floor(J / 4) +
      5 * J) %
    7; // 0=Sat..6=Fri
  return (h + 6) % 7; // -> 0=Sun..6=Sat
}

/** Merge overlapping/adjacent intervals (sorted output). */
function mergeIntervals(iv: FreeInterval[]): FreeInterval[] {
  if (iv.length === 0) return [];
  const sorted = [...iv].sort((a, b) => a.startMinute - b.startMinute);
  const out: FreeInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, sorted[i].endMinute);
    } else {
      out.push({ ...sorted[i] });
    }
  }
  return out;
}

/** Complement of `occupied` within [start, end]. */
function freeWithin(
  occupied: FreeInterval[],
  start: Minutes,
  end: Minutes,
): FreeInterval[] {
  const merged = mergeIntervals(
    occupied
      .map((o) => ({
        startMinute: Math.max(o.startMinute, start),
        endMinute: Math.min(o.endMinute, end),
      }))
      .filter((o) => o.endMinute > o.startMinute),
  );
  const free: FreeInterval[] = [];
  let cursor = start;
  for (const o of merged) {
    if (o.startMinute > cursor)
      free.push({ startMinute: cursor, endMinute: o.startMinute });
    cursor = Math.max(cursor, o.endMinute);
  }
  if (cursor < end) free.push({ startMinute: cursor, endMinute: end });
  return free;
}

/** First free position >= `from`, within [from,to], not hitting `busy`. */
function firstFreeForward(
  busy: FreeInterval[],
  from: Minutes,
  to: Minutes,
  duration: Minutes,
): Minutes | null {
  let pos = from;
  const sorted = [...busy].sort((a, b) => a.startMinute - b.startMinute);
  while (pos + duration <= to) {
    const hit = sorted.find((b) => overlaps(pos, pos + duration, b.startMinute, b.endMinute));
    if (!hit) return pos;
    pos = hit.endMinute; // jump past the conflict
  }
  return null;
}

// --------------------------- main layout ----------------------------

export interface BaseLayout {
  blocks: PlacedBlock[]; // fixed + health, sorted by start
  free: FreeInterval[]; // intervals available for tasks
  warnings: Warning[];
  sleepMinutesByDay: number[];
  horizonStart: Minutes;
  horizonEnd: Minutes;
}

/** Add n days to a YYYY-MM-DD string (UTC-safe), returning YYYY-MM-DD. */
function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function layoutConstraints(input: EngineInput): BaseLayout {
  const p: EngineProfile = input.profile;
  const floor = input.overrides?.minSleepMinutes ?? p.minSleepMinutes;
  const allowTasksInWork = input.overrides?.allowTasksInWorkBlocks ?? false;

  const horizonStart = p.wakeMinute;
  const horizonEnd = p.wakeMinute + input.horizonDays * MIN_PER_DAY;
  const startWeekday = weekdayOf(input.startDate);

  const blocks: PlacedBlock[] = [];
  const warnings: Warning[] = [];
  const sleepMinutesByDay: number[] = [];

  // hardBusy = blocks that always block tasks; workBusy = work blocks, which
  // may be opened up to tasks in emergency mode.
  const hardBusy: FreeInterval[] = [];
  const workBusy: FreeInterval[] = [];

  for (let d = 0; d < input.horizonDays; d++) {
    const weekday = (startWeekday + d) % 7;
    const dayStart = d * MIN_PER_DAY + p.wakeMinute;
    const dayEnd = dayStart + MIN_PER_DAY;

    // 1) Fixed work blocks for this weekday.
    for (const wb of p.workBlocks) {
      if (!wb.days.includes(weekday)) continue;
      const wStart = d * MIN_PER_DAY + wb.startMinute;
      const wEnd = d * MIN_PER_DAY + wb.endMinute;
      blocks.push({
        activityType: "WORK",
        title: "Work",
        startMinute: wStart,
        endMinute: wEnd,
        isFixed: true,
        isHealthBlock: false,
      });
      workBusy.push({ startMinute: wStart, endMinute: wEnd });
    }

    // 1b) User-defined fixed commitments (timetable, work shifts) for this day,
    //     respecting weekday and the [startDate, endDate] range. Treated like work.
    const dateStr = addDaysStr(input.startDate, d);
    for (const fe of input.fixedEvents ?? []) {
      if (!fe.days.includes(weekday)) continue;
      if (fe.startDate && dateStr < fe.startDate) continue;
      if (fe.endDate && dateStr > fe.endDate) continue;
      const fStart = d * MIN_PER_DAY + fe.startMinute;
      const fEnd = d * MIN_PER_DAY + fe.endMinute;
      if (fEnd <= fStart) continue;
      blocks.push({
        activityType: fe.activityType,
        title: fe.title,
        startMinute: fStart,
        endMinute: fEnd,
        isFixed: true,
        isHealthBlock: false,
      });
      workBusy.push({ startMinute: fStart, endMinute: fEnd });
    }

    // 2) Sleep — anchored to end at next wake; shrink toward floor if a fixed
    //    block intrudes. Sleep is protected (counts as hardBusy).
    let sleepStart = dayEnd - p.targetSleepMinutes;
    const conflict = workBusy.find((w) =>
      overlaps(sleepStart, dayEnd, w.startMinute, w.endMinute),
    );
    if (conflict) sleepStart = Math.max(sleepStart, conflict.endMinute);
    const sleepMinutes = dayEnd - sleepStart;
    sleepMinutesByDay.push(sleepMinutes);
    if (sleepMinutes < floor) {
      warnings.push({
        code: "SLEEP_BELOW_MINIMUM",
        message: `Sleep on day ${d + 1} is below the ${Math.round(floor / 60)}h minimum.`,
        day: d,
      });
    } else if (sleepMinutes < p.targetSleepMinutes) {
      warnings.push({
        code: "SLEEP_BELOW_TARGET",
        message: `Sleep on day ${d + 1} is below your target.`,
        day: d,
      });
    }
    blocks.push({
      activityType: "SLEEP",
      title: "Sleep",
      startMinute: sleepStart,
      endMinute: dayEnd,
      isFixed: false,
      isHealthBlock: true,
    });
    hardBusy.push({ startMinute: sleepStart, endMinute: dayEnd });

    // 3) Meals — placed near preferred times. Meals MAY occur during work
    //    (a lunch break), so they only avoid sleep/exercise/other meals.
    //    Latest-start caps per meal (08:30 / 13:00 / 20:00) are enforced for
    //    free users; Premium passes enforceMealCaps=false to lift them.
    const MEAL_CAPS = [8 * 60 + 30, 13 * 60, 20 * 60]; // minutes from local midnight
    const capsOn = input.enforceMealCaps !== false;
    const busyForMeals = [...hardBusy, ...workBusy]; // tránh cả giờ làm/sự kiện cố định
    p.mealMinutes.forEach((m, mi) => {
      let pref = d * MIN_PER_DAY + m;
      let latest = dayEnd;
      if (capsOn && MEAL_CAPS[mi] !== undefined) {
        const capAbs = d * MIN_PER_DAY + MEAL_CAPS[mi];
        latest = Math.min(latest, capAbs);
        if (pref > capAbs - p.mealDurationMinutes) pref = capAbs - p.mealDurationMinutes;
      }
      if (pref < dayStart) pref = dayStart;
      if (pref >= dayEnd) return;
      const lo = Math.max(dayStart, pref - 90);
      const hi = Math.min(latest, pref + 120);
      const freeAt =
        firstFreeForward(busyForMeals, pref, hi, p.mealDurationMinutes) ??
        firstFreeForward(busyForMeals, lo, hi, p.mealDurationMinutes) ??
        firstFreeForward(busyForMeals, dayStart, latest, p.mealDurationMinutes) ??
        firstFreeForward(busyForMeals, dayStart, dayEnd, p.mealDurationMinutes);
      // Overlap is allowed ONLY as a last resort (no free slot left in the day).
      const at = freeAt ?? pref;
      const block = {
        activityType: "MEAL" as const,
        title: "Meal",
        startMinute: at,
        endMinute: at + p.mealDurationMinutes,
        isFixed: false,
        isHealthBlock: true,
      };
      blocks.push(block);
      hardBusy.push({ startMinute: block.startMinute, endMinute: block.endMinute });
      busyForMeals.push({ startMinute: block.startMinute, endMinute: block.endMinute });
      if (freeAt === null) {
        warnings.push({
          code: "ACTIVITY_OVERLAP",
          message: `No free slot for a meal on day ${d + 1}; placed overlapping.`,
          day: d,
        });
      }
    });

    // 4) Exercise — required when enabled; prefer ~17:30, else nearest free slot.
    if (p.exerciseEnabled && p.exerciseMinutes > 0) {
      const busyForEx = [...hardBusy, ...workBusy];
      const preferStart = d * MIN_PER_DAY + (17 * 60 + 30); // 17:30
      const freeAt =
        firstFreeForward(busyForEx, preferStart, dayEnd, p.exerciseMinutes) ??
        firstFreeForward(busyForEx, dayStart, dayEnd, p.exerciseMinutes);
      // Overlap only as a last resort, when the day has no free slot.
      const at = freeAt ?? preferStart;
      blocks.push({
        activityType: "EXERCISE",
        title: "Exercise",
        startMinute: at,
        endMinute: at + p.exerciseMinutes,
        isFixed: false,
        isHealthBlock: true,
      });
      hardBusy.push({ startMinute: at, endMinute: at + p.exerciseMinutes });
      if (freeAt === null) {
        warnings.push({
          code: "ACTIVITY_OVERLAP",
          message: `No free slot for exercise on day ${d + 1}; placed overlapping.`,
          day: d,
        });
      }
    }

    // 5) Nap (siesta) — optional; starts after 12:00, capped at 60 minutes.
    //    Avoids sleep/meals/exercise and work blocks.
    if (p.napMinutes > 0) {
      const napLen = Math.min(p.napMinutes, 60);
      const busyForNap = [...hardBusy, ...workBusy];
      const earliest = d * MIN_PER_DAY + 12 * 60; // 12:00, "sau 11:59"
      const preferStart = d * MIN_PER_DAY + 13 * 60; // ~13:00
      const latest = d * MIN_PER_DAY + 17 * 60; // keep naps to early afternoon
      const at =
        firstFreeForward(busyForNap, preferStart, Math.min(latest, dayEnd), napLen) ??
        firstFreeForward(busyForNap, earliest, Math.min(latest, dayEnd), napLen);
      if (at !== null) {
        blocks.push({
          activityType: "NAP",
          title: "Nap",
          startMinute: at,
          endMinute: at + napLen,
          isFixed: false,
          isHealthBlock: true,
        });
        hardBusy.push({ startMinute: at, endMinute: at + napLen });
      }
    }
  }
  const taskBusy = allowTasksInWork ? hardBusy : [...hardBusy, ...workBusy];
  const scheduleStart = Math.max(input.nowMinute, horizonStart);
  const free = freeWithin(taskBusy, scheduleStart, horizonEnd);

  blocks.sort((a, b) => a.startMinute - b.startMinute);

  // Fixed activities (work / commitments / events) keep the exact time the user
  // chose, so if two of them clash we can't auto-resolve it — surface a warning.
  const fixedSorted = blocks.filter((b) => b.isFixed).sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < fixedSorted.length; i++) {
    if (fixedSorted[i].startMinute < fixedSorted[i - 1].endMinute) {
      warnings.push({
        code: "ACTIVITY_OVERLAP",
        message: `Two fixed activities overlap: "${fixedSorted[i - 1].title}" and "${fixedSorted[i].title}".`,
        day: Math.floor(fixedSorted[i].startMinute / MIN_PER_DAY),
      });
      break;
    }
  }

  return { blocks, free, warnings, sleepMinutesByDay, horizonStart, horizonEnd };
}
