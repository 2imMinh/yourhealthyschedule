// src/server/scheduling/overload.ts
// Feature 3 — Overload detection (exact EDF / processor-demand test).
// Feature 4 — Automatic task migration (greedy defer of cheapest tasks).
//
// Both share per-deadline capacity accounting, so they live together. Pure
// functions over minute-offset integers; no side effects on inputs.

import type {
  EngineTask,
  FreeInterval,
  Minutes,
  OverloadInfo,
  MigrationInfo,
} from "./types";
import { scoreTask } from "./priority";

const MINUTES_PER_DAY = 24 * 60;
const dayOf = (m: Minutes) => Math.floor(m / MINUTES_PER_DAY);

/** Free capacity (minutes) available within [nowMinute, limit]. */
function supplyBefore(
  limit: Minutes,
  free: FreeInterval[],
  nowMinute: Minutes,
): Minutes {
  let supply = 0;
  for (const iv of free) {
    const start = Math.max(iv.startMinute, nowMinute);
    const end = Math.min(iv.endMinute, limit);
    if (end > start) supply += end - start;
  }
  return supply;
}

/**
 * Feature 3 — exact schedulability test. For every distinct deadline d, the
 * cumulative work due by d must not exceed the cumulative free capacity before
 * d. Any violation means the set is infeasible; the largest gap is the overflow.
 */
export function detectOverload(
  tasks: EngineTask[],
  free: FreeInterval[],
  nowMinute: Minutes,
): OverloadInfo {
  const deadlines = Array.from(
    new Set(
      tasks
        .filter((t) => t.deadlineMinute !== null)
        .map((t) => t.deadlineMinute as Minutes),
    ),
  ).sort((a, b) => a - b);

  let overflow = 0;
  const breaks: OverloadInfo["breaks"] = [];

  for (const d of deadlines) {
    const demand = tasks
      .filter((t) => t.deadlineMinute !== null && t.deadlineMinute <= d)
      .reduce((sum, t) => sum + t.remainingMinutes, 0);
    const supply = supplyBefore(d, free, nowMinute);
    if (demand > supply) {
      const gap = demand - supply;
      overflow = Math.max(overflow, gap);
      breaks.push({ deadlineMinute: d, gapMinutes: gap });
    }
  }

  return { isOverloaded: overflow > 0, overflowMinutes: overflow, breaks };
}

/** Capacity (minutes) per horizon-day index, split across day boundaries. */
function perDayCapacity(free: FreeInterval[]): Map<number, Minutes> {
  const cap = new Map<number, Minutes>();
  for (const iv of free) {
    let s = iv.startMinute;
    while (s < iv.endMinute) {
      const day = dayOf(s);
      const dayEnd = (day + 1) * MINUTES_PER_DAY;
      const segEnd = Math.min(iv.endMinute, dayEnd);
      cap.set(day, (cap.get(day) ?? 0) + (segEnd - s));
      s = segEnd;
    }
  }
  return cap;
}

/** A task is "urgent" (not a migration candidate) if it has a tight deadline. */
function isUrgent(t: EngineTask, nowMinute: Minutes): boolean {
  if (t.priority === "URGENT") return true;
  if (t.deadlineMinute === null) return false;
  return t.deadlineMinute - nowMinute <= MINUTES_PER_DAY; // within 24h
}

/** Earliest future day (>= 1) with enough capacity, before the deadline. */
function earliestFutureDay(
  capByDay: Map<number, Minutes>,
  need: Minutes,
  beforeDeadline: Minutes | null,
): number | null {
  const days = Array.from(capByDay.keys())
    .filter((d) => d >= 1)
    .sort((a, b) => a - b);
  for (const d of days) {
    const startsInTime =
      beforeDeadline === null || d * MINUTES_PER_DAY < beforeDeadline;
    if ((capByDay.get(d) ?? 0) >= need && startsInTime) return d;
  }
  return null;
}

export interface MigrationPlan {
  migrations: MigrationInfo[];
  deferredTaskIds: string[];
  residualOverflowMinutes: Minutes;
}

/**
 * Feature 4 — relieve overload by deferring the cheapest-to-move tasks (low
 * priority, distant/no deadline) to future days with capacity, re-testing
 * feasibility after each move. Never defers a task past its deadline. Residual
 * overflow > 0 means even migration can't fix it (-> honest message / emergency).
 */
export function planMigrations(
  tasks: EngineTask[],
  free: FreeInterval[],
  nowMinute: Minutes,
  slotMinutes: Minutes,
): MigrationPlan {
  if (!detectOverload(tasks, free, nowMinute).isOverloaded) {
    return { migrations: [], deferredTaskIds: [], residualOverflowMinutes: 0 };
  }

  // Cheapest-to-defer first = lowest priority score.
  const movers = tasks
    .filter((t) => !isUrgent(t, nowMinute))
    .sort(
      (a, b) =>
        scoreTask(a, nowMinute, slotMinutes) -
        scoreTask(b, nowMinute, slotMinutes),
    );

  const capByDay = perDayCapacity(free);
  const deferred = new Set<string>();
  const migrations: MigrationInfo[] = [];

  for (const t of movers) {
    const remaining = tasks.filter((x) => !deferred.has(x.id));
    if (!detectOverload(remaining, free, nowMinute).isOverloaded) break;

    const target = earliestFutureDay(capByDay, t.remainingMinutes, t.deadlineMinute);
    if (target !== null) {
      deferred.add(t.id);
      capByDay.set(target, (capByDay.get(target) ?? 0) - t.remainingMinutes);
      migrations.push({
        taskId: t.id,
        title: t.title,
        toDay: target,
        reason: "Deferred to balance a high-workload day",
      });
    }
  }

  const residual = detectOverload(
    tasks.filter((x) => !deferred.has(x.id)),
    free,
    nowMinute,
  );

  return {
    migrations,
    deferredTaskIds: Array.from(deferred),
    residualOverflowMinutes: residual.overflowMinutes,
  };
}
