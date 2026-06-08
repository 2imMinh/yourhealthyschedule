// src/server/scheduling/types.ts
// Pure type vocabulary for the scheduling engine. NO imports — not Next.js,
// not Prisma, not the network. The engine operates entirely on integers
// (minute offsets) so placement, overlap, and capacity math are exact and the
// whole module is unit-testable in microseconds. The service layer is
// responsible for mapping DB rows <-> these types (Dates <-> minute offsets).

/** Integer minutes. Offsets are measured from local 00:00 of horizon day 0. */
export type Minutes = number;

// --- Enums mirrored as string unions (decoupled from the Prisma client) ---

export type EngineActivityType =
  | "SLEEP"
  | "MEAL"
  | "EXERCISE"
  | "WORK"
  | "STUDY"
  | "COOKING"
  | "ENTERTAINMENT"
  | "COMMUTE"
  | "SOCIAL"
  | "NAP"
  | "TASK"
  | "BUFFER";

export type EnginePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type EngineMode = "STANDARD" | "OVERLOAD" | "EMERGENCY";

// ------------------------------- Inputs ------------------------------

/** Times-of-day are minutes from local midnight (0..1439). */
export interface EngineWorkBlock {
  days: number[]; // 0=Sun .. 6=Sat
  startMinute: Minutes;
  endMinute: Minutes;
}

export interface EngineProfile {
  timezone: string;
  wakeMinute: Minutes; // from midnight
  sleepMinute: Minutes; // bedtime from midnight (may wrap past midnight)
  targetSleepMinutes: Minutes;
  minSleepMinutes: Minutes;
  mealMinutes: Minutes[]; // meal start times from midnight
  mealDurationMinutes: Minutes; // per meal
  exerciseEnabled: boolean;
  exerciseMinutes: Minutes;
  napMinutes: Minutes; // 0 = no nap; capped at 60 by the engine
  commuteMinutes: Minutes;
  workBlocks: EngineWorkBlock[];
  optionalActivities: string[];
}

export interface EngineTask {
  id: string;
  title: string;
  remainingMinutes: Minutes;
  deadlineMinute: Minutes | null; // offset from horizon start; null = no deadline
  priority: EnginePriority;
  isSplittable: boolean;
}

/** A predicted-productive window, expressed per-day (minutes from midnight). */
export interface ProductivityWindow {
  startMinute: Minutes;
  endMinute: Minutes;
  score: number; // 0..1 (smoothed completion rate)
  confidence: number; // 0..1
}

/** Constraint relaxations; only emergency mode sets these. */
export interface RelaxationOverrides {
  minSleepMinutes?: Minutes; // lowered toward the safety floor
  allowTasksInWorkBlocks?: boolean;
}

export interface EngineInput {
  startDate: string; // YYYY-MM-DD, horizon day 0 (user-local)
  horizonDays: number;
  slotMinutes: Minutes; // discretization granularity (default 15)
  nowMinute: Minutes; // current time as offset from horizon start
  mode: EngineMode;
  profile: EngineProfile;
  tasks: EngineTask[];
  productivity: ProductivityWindow[];
  /** When true (default), meals can't start after their fixed caps (08:30/13:00/20:00). Premium passes false. */
  enforceMealCaps?: boolean;
  overrides?: RelaxationOverrides;
}

// ----------------------------- Internals -----------------------------

/** A contiguous gap available for placement. capacity = endMinute - startMinute. */
export interface FreeInterval {
  startMinute: Minutes;
  endMinute: Minutes;
}

export type Constraint =
  | { kind: "HARD"; type: "NO_OVERLAP" | "MIN_SLEEP" | "DEADLINE" | "FIXED_BLOCK" }
  | { kind: "SOFT"; type: "PREFERRED_TIME" | "PRODUCTIVITY" | "BUFFER"; weight: number };

// ------------------------------- Outputs -----------------------------

export interface PlacedBlock {
  activityType: EngineActivityType;
  title?: string;
  taskId?: string;
  startMinute: Minutes; // offset from horizon start
  endMinute: Minutes;
  isFixed: boolean;
  isHealthBlock: boolean;
}

export type WarningCode =
  | "SLEEP_BELOW_TARGET"
  | "SLEEP_BELOW_MINIMUM"
  | "TASK_AT_RISK"
  | "TASK_MIGRATED"
  | "OVERLOADED"
  | "HEALTH_BLOCK_SKIPPED";

export interface Warning {
  code: WarningCode;
  message: string;
  taskId?: string;
  day?: number;
}

export interface OverloadInfo {
  isOverloaded: boolean;
  overflowMinutes: Minutes;
  breaks: { deadlineMinute: Minutes; gapMinutes: Minutes }[];
}

export interface MigrationInfo {
  taskId: string;
  title: string;
  toDay: number;
  reason: string;
}

export interface GenerationResult {
  blocks: PlacedBlock[];
  warnings: Warning[];
  overload: OverloadInfo;
  migrations: MigrationInfo[];
  atRiskTaskIds: string[];
  feasible: boolean;
  meta: { version: string; inputsHash: string; slotMinutes: Minutes };
}
