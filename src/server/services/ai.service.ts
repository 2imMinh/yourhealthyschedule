// src/server/services/ai.service.ts
// Domain layer for AI features. The LLM only *advises* — every response is
// schema-validated before use, and every method has a deterministic rules-based
// fallback so the feature still works if the LLM is down or returns garbage.
// None of this touches the scheduling engine's feasibility decisions.

import { z } from "zod";
import { aiProvider, AiError } from "@/lib/ai-provider";

// --------------------------- Task parsing ----------------------------

export interface ParsedTaskDraft {
  title: string;
  estimatedMinutes: number;
  deadline: Date | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  source: "ai" | "fallback";
}

const aiTaskSchema = z.object({
  title: z.string().min(1).max(200),
  estimatedMinutes: z.number().int().positive().max(24 * 60),
  deadline: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

const TASK_SYSTEM = `You convert a user's free-text note into a single structured task.
Return ONLY JSON: {"title": string, "estimatedMinutes": integer, "deadline": ISO-8601 string or null, "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT"}.
Estimate a realistic duration in minutes if not stated. Resolve relative dates to absolute ISO datetimes. Do not invent a deadline if none is implied (use null).`;

/** Heuristic fallback when the LLM is unavailable or returns invalid output. */
function fallbackParse(text: string): ParsedTaskDraft {
  const trimmed = text.trim();
  // crude duration sniff: "2h", "90 min", "1.5 hours"
  let minutes = 30;
  const hr = trimmed.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?/i);
  const mn = trimmed.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
  if (hr) minutes = Math.round(parseFloat(hr[1]) * 60);
  else if (mn) minutes = parseInt(mn[1], 10);
  return {
    title: trimmed.slice(0, 200) || "Untitled task",
    estimatedMinutes: minutes,
    deadline: null,
    priority: "MEDIUM",
    source: "fallback",
  };
}

export async function parseTaskFromText(text: string): Promise<ParsedTaskDraft> {
  try {
    const raw = await aiProvider.generateJSON({
      system: TASK_SYSTEM,
      user: `Today is ${new Date().toISOString()}. Note: """${text}"""`,
      maxTokens: 256,
    });
    const parsed = aiTaskSchema.parse(raw); // throws if the LLM lied about shape
    const deadline = parsed.deadline ? new Date(parsed.deadline) : null;
    return {
      title: parsed.title,
      estimatedMinutes: parsed.estimatedMinutes,
      deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
      priority: parsed.priority,
      source: "ai",
    };
  } catch (err) {
    if (!(err instanceof AiError) && !(err instanceof z.ZodError)) throw err;
    return fallbackParse(text); // graceful degradation
  }
}

// ----------------------- Substitution suggestions --------------------

export interface SubstitutionContext {
  minutesShort: number; // how much time the day is over capacity
  activities: { type: string; title: string; minutes: number }[];
}

export interface Substitution {
  from: string;
  to: string;
  minutesSaved: number;
  rationale: string;
}

const aiSubsSchema = z.object({
  substitutions: z
    .array(
      z.object({
        from: z.string().max(120),
        to: z.string().max(120),
        minutesSaved: z.number().int().min(0).max(600),
        rationale: z.string().max(300),
      }),
    )
    .max(5),
});

const SUBS_SYSTEM = `You suggest time-saving substitutions for a busy day that PRESERVE some health value (never just delete health).
Return ONLY JSON: {"substitutions":[{"from":string,"to":string,"minutesSaved":integer,"rationale":string}]}.
Examples: cooking -> food delivery; gym session -> short home cardio. Keep suggestions practical and brief. Never suggest skipping sleep.`;

/** Deterministic fallback substitutions derived from the activities present. */
function fallbackSubstitutions(ctx: SubstitutionContext): Substitution[] {
  const out: Substitution[] = [];
  for (const a of ctx.activities) {
    if (a.type === "COOKING") {
      out.push({ from: "Cooking", to: "Food delivery", minutesSaved: Math.min(a.minutes, 45), rationale: "Order in to reclaim prep and cleanup time." });
    } else if (a.type === "EXERCISE" && a.minutes > 20) {
      out.push({ from: `Workout (${a.minutes}m)`, to: "15-min home cardio", minutesSaved: a.minutes - 15, rationale: "Keep movement without the full session." });
    } else if (a.type === "COMMUTE") {
      out.push({ from: "Commute", to: "Remote/async block", minutesSaved: Math.min(a.minutes, 30), rationale: "Skip travel where possible." });
    }
  }
  return out.slice(0, 5);
}

export async function suggestSubstitutions(
  ctx: SubstitutionContext,
): Promise<Substitution[]> {
  try {
    const raw = await aiProvider.generateJSON({
      system: SUBS_SYSTEM,
      user: JSON.stringify(ctx),
      maxTokens: 400,
    });
    const parsed = aiSubsSchema.parse(raw);
    // Re-validate against reality: only keep suggestions that map to a real,
    // present activity. Never trust the LLM to know what's on the schedule.
    const presentTypes = new Set(ctx.activities.map((a) => a.type.toLowerCase()));
    const safe = parsed.substitutions.filter((s) =>
      [...presentTypes].some((t) => s.from.toLowerCase().includes(t)),
    );
    return safe.length ? safe : fallbackSubstitutions(ctx);
  } catch (err) {
    if (!(err instanceof AiError) && !(err instanceof z.ZodError)) throw err;
    return fallbackSubstitutions(ctx);
  }
}
