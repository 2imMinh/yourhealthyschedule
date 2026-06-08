// src/server/scheduling/priority.ts
// Feature 2 — Deadline prioritization. Pure scoring + ordering.
//
// Composite score blends three normalized signals:
//   urgency   — demand density vs. time-to-deadline (>1 means impossible alone)
//   importance— user-set priority
//   slack     — how little buffer remains before the deadline
// Base ordering is Earliest-Deadline-First (optimal for meeting deadlines when
// feasible); the score refines ties and folds in user priority.

import type { EngineTask, EnginePriority, Minutes } from "./types";

const PRIORITY_WEIGHT: Record<EnginePriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 4,
  URGENT: 8,
};

/** Tunable score weights (must be the app's single source of truth). */
export interface ScoreWeights {
  urgency: number;
  importance: number;
  slack: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  urgency: 0.5,
  importance: 0.3,
  slack: 0.2,
};

/** Normalization horizon for the slack term (2 weeks in minutes). */
const SLACK_HORIZON_MINUTES = 14 * 24 * 60;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Score a single task. Higher = schedule sooner.
 * @param nowMinute current time as offset from horizon start
 * @param slotMinutes scheduling granularity (avoids divide-by-zero)
 */
export function scoreTask(
  task: EngineTask,
  nowMinute: Minutes,
  slotMinutes: Minutes,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  let urgency: number;
  let slackTerm: number;

  if (task.deadlineMinute === null) {
    // No deadline: opportunistic. Low, fixed urgency; no slack pressure.
    urgency = 0.1;
    slackTerm = 0;
  } else {
    const timeLeft = Math.max(task.deadlineMinute - nowMinute, slotMinutes);
    urgency = clamp01(task.remainingMinutes / timeLeft);
    const slack = timeLeft - task.remainingMinutes;
    slackTerm = 1 / (1 + Math.max(slack, 0) / SLACK_HORIZON_MINUTES);
  }

  const importance = PRIORITY_WEIGHT[task.priority] / PRIORITY_WEIGHT.URGENT;

  return (
    weights.urgency * urgency +
    weights.importance * importance +
    weights.slack * slackTerm
  );
}

/**
 * Order tasks highest-priority first. Stable tie-break: earlier deadline, then
 * larger remaining work (so big urgent items are placed before small ones).
 * Returns a new array; does not mutate the input.
 */
export function prioritize(
  tasks: EngineTask[],
  nowMinute: Minutes,
  slotMinutes: Minutes,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): EngineTask[] {
  return [...tasks].sort((a, b) => {
    const sa = scoreTask(a, nowMinute, slotMinutes, weights);
    const sb = scoreTask(b, nowMinute, slotMinutes, weights);
    if (sb !== sa) return sb - sa;

    // Tie-breaks for deterministic output.
    const da = a.deadlineMinute ?? Number.POSITIVE_INFINITY;
    const db = b.deadlineMinute ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return b.remainingMinutes - a.remainingMinutes;
  });
}
