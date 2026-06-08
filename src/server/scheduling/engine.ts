// src/server/scheduling/engine.ts
// Feature 1 — schedule generation orchestrator, and Feature 6 — emergency-mode
// minimal relaxation. Stitches together the pure modules:
//   constraints (layout + free) -> priority (order) -> placement (tasks) ->
//   overload (feasibility) -> migration (repair). Deterministic: identical
//   inputs produce an identical schedule (recorded via inputsHash).

import type {
  EngineInput,
  EngineTask,
  FreeInterval,
  GenerationResult,
  Minutes,
  PlacedBlock,
  ProductivityWindow,
  Warning,
} from "./types";
import { layoutConstraints } from "./constraints";
import { prioritize } from "./priority";
import { detectOverload, planMigrations } from "./overload";

const VERSION = "engine-v1";
const MIN_PER_DAY = 24 * 60;

/** Productivity score for an absolute minute, mapped to its minute-of-day. */
function productivityAt(minute: Minutes, windows: ProductivityWindow[]): number {
  const minuteOfDay = ((minute % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  for (const w of windows) {
    if (minuteOfDay >= w.startMinute && minuteOfDay < w.endMinute) return w.score;
  }
  return 0;
}

/** Place prioritized tasks into free intervals, preferring productive windows. */
function placeTasks(
  tasks: EngineTask[],
  free: FreeInterval[],
  productivity: ProductivityWindow[],
): { blocks: PlacedBlock[]; atRisk: string[] } {
  const slots = free.map((f) => ({ ...f })); // mutable working copy
  const blocks: PlacedBlock[] = [];
  const atRisk: string[] = [];

  for (const task of tasks) {
    let need = task.remainingMinutes;
    const deadline = task.deadlineMinute ?? Number.POSITIVE_INFINITY;

    // Candidate slots: must start before the deadline; prefer productive, then earliest.
    const candidates = slots
      .filter((iv) => iv.startMinute < deadline && iv.endMinute > iv.startMinute)
      .sort((a, b) => {
        const pa = productivityAt(a.startMinute, productivity);
        const pb = productivityAt(b.startMinute, productivity);
        if (pb !== pa) return pb - pa;
        return a.startMinute - b.startMinute;
      });

    if (!task.isSplittable) {
      // Needs one contiguous slot with enough room before the deadline.
      const fit = candidates.find(
        (iv) => Math.min(iv.endMinute, deadline) - iv.startMinute >= need,
      );
      if (!fit) {
        atRisk.push(task.id);
        continue;
      }
      blocks.push(taskBlock(task, fit.startMinute, fit.startMinute + need));
      fit.startMinute += need;
    } else {
      for (const iv of candidates) {
        if (need <= 0) break;
        const cap = Math.min(iv.endMinute, deadline) - iv.startMinute;
        if (cap <= 0) continue;
        const take = Math.min(cap, need);
        blocks.push(taskBlock(task, iv.startMinute, iv.startMinute + take));
        iv.startMinute += take;
        need -= take;
      }
      if (need > 0) atRisk.push(task.id);
    }
  }

  return { blocks, atRisk };
}

function taskBlock(task: EngineTask, start: Minutes, end: Minutes): PlacedBlock {
  return {
    activityType: "TASK",
    title: task.title,
    taskId: task.id,
    startMinute: start,
    endMinute: end,
    isFixed: false,
    isHealthBlock: false,
  };
}

/** One full pass: layout -> prioritize -> migrate -> place -> feasibility. */
function attempt(input: EngineInput) {
  const layout = layoutConstraints(input);
  const prioritized = prioritize(input.tasks, input.nowMinute, input.slotMinutes);

  const initialOverload = detectOverload(input.tasks, layout.free, input.nowMinute);
  let migrations = initialOverload.isOverloaded
    ? planMigrations(input.tasks, layout.free, input.nowMinute, input.slotMinutes)
    : { migrations: [], deferredTaskIds: [] as string[], residualOverflowMinutes: 0 };

  const deferred = new Set(migrations.deferredTaskIds);
  const toPlace = prioritized.filter((t) => !deferred.has(t.id));
  const { blocks: taskBlocks, atRisk } = placeTasks(toPlace, layout.free, input.productivity);

  const warnings: Warning[] = [...layout.warnings];
  for (const id of atRisk)
    warnings.push({ code: "TASK_AT_RISK", message: "This task may miss its deadline.", taskId: id });
  for (const m of migrations.migrations)
    warnings.push({ code: "TASK_MIGRATED", message: `"${m.title}" moved to balance your workload.`, taskId: m.taskId, day: m.toDay });

  const residual = detectOverload(
    input.tasks.filter((t) => !deferred.has(t.id)),
    layout.free,
    input.nowMinute,
  );
  if (residual.isOverloaded)
    warnings.push({ code: "OVERLOADED", message: "Some work cannot fit before its deadline." });

  const blocks = [...layout.blocks, ...taskBlocks].sort(
    (a, b) => a.startMinute - b.startMinute,
  );
  const feasible = atRisk.length === 0 && residual.overflowMinutes === 0;

  return { blocks, warnings, overload: residual, migrations: migrations.migrations, atRisk, feasible };
}

/** Public entry point. */
export function generate(input: EngineInput): GenerationResult {
  let working = input;
  let r = attempt(working);

  // Feature 6 — emergency mode relaxes constraints minimally, only as needed.
  if (input.mode === "EMERGENCY" && !r.feasible) {
    const floor = input.profile.minSleepMinutes; // safety floor (validated upstream)

    // (a) Open work/study blocks to tasks first — least harmful relaxation.
    working = { ...working, overrides: { ...working.overrides, allowTasksInWorkBlocks: true } };
    r = attempt(working);

    // (b) Then shave sleep 15 min at a time toward the floor — and stop the
    //     instant the day becomes feasible (don't over-cut sleep).
    let target = input.profile.targetSleepMinutes;
    while (!r.feasible && target > floor) {
      target = Math.max(floor, target - 15);
      working = {
        ...working,
        profile: { ...working.profile, targetSleepMinutes: target },
        overrides: { ...working.overrides, minSleepMinutes: floor },
      };
      r = attempt(working);
    }
  }

  return {
    blocks: r.blocks,
    warnings: r.warnings,
    overload: r.overload,
    migrations: r.migrations,
    atRiskTaskIds: r.atRisk,
    feasible: r.feasible,
    meta: { version: VERSION, inputsHash: hashInput(input), slotMinutes: input.slotMinutes },
  };
}

/** Stable FNV-1a hash of the inputs, for reproducibility + cache keys. */
function hashInput(input: EngineInput): string {
  const normalized = JSON.stringify({
    d: input.startDate,
    h: input.horizonDays,
    s: input.slotMinutes,
    m: input.mode,
    p: input.profile,
    t: input.tasks
      .map((t) => ({ i: t.id, r: t.remainingMinutes, dl: t.deadlineMinute, pr: t.priority, sp: t.isSplittable }))
      .sort((a, b) => (a.i < b.i ? -1 : 1)),
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
