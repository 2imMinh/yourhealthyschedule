// src/lib/api.ts
// Thin typed fetch client for the frontend. Unwraps the { data } envelope and
// throws a typed ApiClientError carrying the server's { code, message } so the
// UI can branch (e.g. show an upgrade prompt on PREMIUM_REQUIRED).

import type {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateProfileInput,
  GenerateScheduleInput,
  CompleteBlockInput,
} from "@/types";

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error ?? { code: "UNKNOWN", message: "Request failed" };
    throw new ApiClientError(err.code, err.message, res.status);
  }
  return json.data as T;
}

export interface Commitment {
  id: string;
  title: string;
  activityType: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
}
export type CommitmentBody = Omit<Commitment, "id">;

export const api = {
  // Tasks
  listTasks: (status?: string) =>
    request<{ tasks: unknown[]; nextCursor: string | null }>(
      `/tasks${status ? `?status=${status}` : ""}`,
    ),
  createTask: (body: CreateTaskInput) =>
    request("/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: UpdateTaskInput) =>
    request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (id: string) => request(`/tasks/${id}`, { method: "DELETE" }),
  parseTask: (text: string) =>
    request("/tasks/parse", { method: "POST", body: JSON.stringify({ text }) }),

  // Profile
  getProfile: () => request("/profile"),
  updateProfile: (body: UpdateProfileInput) =>
    request("/profile", { method: "PUT", body: JSON.stringify(body) }),

  // Current user (tier source of truth)
  me: () => request<{ isPremium: boolean; subscriptionTier: string; email: string }>("/me"),

  // Account (name / avatar / date of birth)
  getAccount: () =>
    request<{ name: string; avatarUrl: string; birthDate: string; email: string }>("/account"),
  updateAccount: (body: { name?: string; avatarUrl?: string; birthDate?: string }) =>
    request("/account", { method: "PUT", body: JSON.stringify(body) }),

  // Schedule
  generateSchedule: (body: GenerateScheduleInput) =>
    request("/schedule/generate", { method: "POST", body: JSON.stringify(body) }),
  getSchedule: (date: string, rangeDays = 1) =>
    request(`/schedule?date=${date}&rangeDays=${rangeDays}`),

  // Google Calendar sync (premium)
  syncCalendar: (date: string, rangeDays: number) =>
    request<{ synced: number; empty?: boolean; calendarId?: string }>("/calendar/sync", {
      method: "POST",
      body: JSON.stringify({ date, rangeDays }),
    }),

  // Fixed commitments (timetable / work schedule)
  listCommitments: () =>
    request<{ commitments: Commitment[] }>("/commitments"),
  createCommitment: (body: CommitmentBody) =>
    request("/commitments", { method: "POST", body: JSON.stringify(body) }),
  updateCommitment: (id: string, body: CommitmentBody) =>
    request(`/commitments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCommitment: (id: string) =>
    request(`/commitments/${id}`, { method: "DELETE" }),

  // Schedule blocks (manual time edits)
  updateBlock: (blockId: string, body: { startTime: string; endTime: string }) =>
    request(`/schedule/blocks/${blockId}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Checklist
  completeBlock: (blockId: string, body: CompleteBlockInput) =>
    request(`/checklist/${blockId}`, { method: "POST", body: JSON.stringify(body) }),

  // Analytics
  analytics: (range: "daily" | "weekly" | "monthly", date?: string) =>
    request(`/analytics?range=${range}${date ? `&date=${date}` : ""}`),

  // Billing
  checkout: (priceId: string) =>
    request<{ url: string }>("/stripe/checkout", {
      method: "POST",
      body: JSON.stringify({ priceId }),
    }),
  billingPortal: () =>
    request<{ url: string }>("/stripe/portal", { method: "POST" }),
};
