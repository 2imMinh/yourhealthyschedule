// src/server/scheduling/prediction.ts
// Feature 5 — productivity prediction. A transparent statistical model, NOT an
// LLM. Per hour-of-day, estimate completion rate with recency-weighted
// Beta-Binomial smoothing toward a population prior. The prior solves cold
// start (a new user starts on the population curve with honest low confidence);
// recency weighting (exponential half-life) keeps it current; pseudo-counts
// stabilize small samples.

import type { ProductivityWindow, Minutes } from "./types";

const HOURS = 24;

/** One observed scheduled block and whether it was completed. */
export interface CompletionObservation {
  hour: number; // 0..23 local hour the block was scheduled
  completed: boolean;
  ageDays: number; // days since it occurred (>= 0)
}

export interface PredictionConfig {
  /** Strength of the population prior, in pseudo-observations. */
  priorStrength: number;
  /** Recency half-life in days. */
  halfLifeDays: number;
  /** Population prior completion rate per hour (0..1), length 24. */
  populationPriorByHour: number[];
}

/** Mild population curve: late-morning and late-afternoon peaks, low overnight. */
const DEFAULT_POPULATION_PRIOR: number[] = [
  0.1, 0.1, 0.1, 0.1, 0.1, 0.15, 0.25, 0.4, 0.55, 0.65, 0.68, 0.65, // 0..11
  0.5, 0.5, 0.55, 0.6, 0.62, 0.6, 0.55, 0.45, 0.4, 0.3, 0.2, 0.12, // 12..23
];

export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  priorStrength: 4,
  halfLifeDays: 14,
  populationPriorByHour: DEFAULT_POPULATION_PRIOR,
};

interface HourScore {
  hour: number;
  rate: number;
  confidence: number;
  score: number;
}

function scoreHours(
  observations: CompletionObservation[],
  cfg: PredictionConfig,
): HourScore[] {
  const wDone = new Array(HOURS).fill(0);
  const wSched = new Array(HOURS).fill(0);

  for (const o of observations) {
    if (o.hour < 0 || o.hour >= HOURS) continue;
    const w = Math.pow(0.5, Math.max(o.ageDays, 0) / cfg.halfLifeDays);
    wSched[o.hour] += w;
    if (o.completed) wDone[o.hour] += w;
  }

  const out: HourScore[] = [];
  for (let h = 0; h < HOURS; h++) {
    const S = cfg.priorStrength;
    const prior = cfg.populationPriorByHour[h] ?? 0.4;
    // Beta-Binomial posterior mean, prior expressed as S pseudo-observations.
    const rate = (S * prior + wDone[h]) / (S + wSched[h]);
    const confidence = wSched[h] / (wSched[h] + S); // 0..1, rises with data
    const score = rate * (0.5 + 0.5 * confidence);
    out.push({ hour: h, rate, confidence, score });
  }
  return out;
}

/** Merge contiguous selected hours into windows (minutes from midnight). */
function toWindows(selected: HourScore[]): ProductivityWindow[] {
  const byHour = [...selected].sort((a, b) => a.hour - b.hour);
  const windows: ProductivityWindow[] = [];
  let run: HourScore[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const startMinute: Minutes = run[0].hour * 60;
    const endMinute: Minutes = (run[run.length - 1].hour + 1) * 60;
    windows.push({
      startMinute,
      endMinute,
      score: Math.max(...run.map((r) => r.score)),
      confidence: run.reduce((s, r) => s + r.confidence, 0) / run.length,
    });
    run = [];
  };

  for (const h of byHour) {
    if (run.length === 0 || h.hour === run[run.length - 1].hour + 1) {
      run.push(h);
    } else {
      flush();
      run.push(h);
    }
  }
  flush();
  return windows.sort((a, b) => b.score - a.score);
}

/**
 * Predict tomorrow's productive windows. Selects above-average hours and merges
 * contiguous ones. Result windows are per-day (minutes from midnight); the
 * engine offsets them per horizon day to bias task placement.
 */
export function predictProductivity(
  observations: CompletionObservation[],
  cfg: PredictionConfig = DEFAULT_PREDICTION_CONFIG,
): ProductivityWindow[] {
  const scores = scoreHours(observations, cfg);
  const mean = scores.reduce((s, x) => s + x.score, 0) / HOURS;
  // Pick hours meaningfully above the daily mean (waking hours only).
  const selected = scores.filter((s) => s.score > mean * 1.05 && s.hour >= 6);
  return toWindows(selected);
}
