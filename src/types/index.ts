// src/types/index.ts
// Single source of truth for request/response contracts.
// Route handlers validate input with these; the frontend imports the inferred
// types for end-to-end type safety. Keep this framework-free.

import { z } from "zod";

// ----------------------------- Enums ---------------------------------
// Mirror the Prisma enums as zod enums so validation matches the DB.

export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const TaskStatusEnum = z.enum([
  "PENDING",
  "SCHEDULED",
  "IN_PROGRESS",
  "DONE",
  "DEFERRED",
  "CANCELED",
]);
export const ScheduleModeEnum = z.enum(["STANDARD", "OVERLOAD", "EMERGENCY"]);
export const CompletionStatusEnum = z.enum(["COMPLETED", "SKIPPED", "PARTIAL"]);
export const ActivityTypeEnum = z.enum([
  "SLEEP",
  "MEAL",
  "EXERCISE",
  "WORK",
  "STUDY",
  "COOKING",
  "ENTERTAINMENT",
  "COMMUTE",
  "SOCIAL",
  "TASK",
  "BUFFER",
]);

// ----------------------------- Helpers -------------------------------

/** "HH:mm" 24-hour time, e.g. "07:30" or "23:00". */
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm (24h)");

/** ISO datetime string coerced to a Date; rejects invalid dates. */
const isoDate = z.coerce.date();

// ----------------------------- Tasks ---------------------------------

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  estimatedMinutes: z.number().int().positive().max(24 * 60),
  deadline: isoDate.optional(),
  priority: PriorityEnum.default("MEDIUM"),
  isSplittable: z.boolean().default(true),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: TaskStatusEnum.optional(),
});

export const listTasksQuerySchema = z.object({
  status: TaskStatusEnum.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ----------------------------- Profile -------------------------------

export const workBlockSchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)).min(1), // 0=Sun..6=Sat
    start: timeString,
    end: timeString,
  })
  .refine((b) => b.start < b.end, { message: "start must be before end" });

export const updateProfileSchema = z.object({
  wakeTime: timeString,
  sleepTime: timeString,
  targetSleepHours: z.number().min(4).max(12),
  minSleepHours: z.number().min(4).max(10),
  mealTimes: z.array(timeString).min(1).max(6),
  exerciseEnabled: z.boolean(),
  exerciseMinutes: z.number().int().min(0).max(300),
  napEnabled: z.boolean().default(false),
  napMinutes: z.number().int().min(0).max(60).default(0),
  commuteMinutes: z.number().int().min(0).max(300),
  workBlocks: z.array(workBlockSchema).max(14),
  optionalActivities: z.array(
    z.enum(["cooking", "entertainment", "commute", "social"]),
  ),
});

// --------------------------- Account ---------------------------------

export const accountSchema = z.object({
  name: z.string().max(120).optional(),
  avatarUrl: z.string().max(2000).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
});
export type AccountInput = z.infer<typeof accountSchema>;

// --------------------------- Schedule --------------------------------

export const generateScheduleSchema = z.object({
  // local calendar day, "YYYY-MM-DD"
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  horizonDays: z.number().int().min(1).max(14).default(1),
  mode: ScheduleModeEnum.default("STANDARD"),
  // IANA timezone of the browser (e.g. "Asia/Ho_Chi_Minh"); keeps clock times correct.
  timezone: z.string().max(64).optional(),
});

export const scheduleQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rangeDays: z.coerce.number().int().min(1).max(31).default(1),
});

// --------------------------- Checklist -------------------------------

export const completeBlockSchema = z.object({
  status: CompletionStatusEnum,
  actualMinutes: z.number().int().min(0).max(24 * 60).optional(),
});

// --------------------------- Analytics -------------------------------

export const analyticsQuerySchema = z.object({
  range: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// --------------------------- Billing ---------------------------------

export const checkoutSchema = z.object({
  priceId: z.string().min(1),
});

// --------------------------- Inferred DTOs ---------------------------

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type WorkBlock = z.infer<typeof workBlockSchema>;
export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>;
export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;
export type CompleteBlockInput = z.infer<typeof completeBlockSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// --------------------------- API envelope ----------------------------

export type ApiError = { error: { code: string; message: string; details?: unknown } };
export type ApiOk<T> = { data: T };
export type ApiResponse<T> = ApiOk<T> | ApiError;
