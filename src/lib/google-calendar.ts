// src/lib/google-calendar.ts
// Thin wrappers over the Google Calendar REST API (v3) using a Bearer token.
const BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Google Calendar API error ${status}`);
    this.name = "GoogleCalendarError";
  }
}

async function gfetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GoogleCalendarError(res.status, detail);
  }
  return res.status === 204 ? null : res.json();
}

export interface GEvent {
  summary: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export const gcal = {
  createCalendar: (token: string, summary: string) =>
    gfetch(token, "/calendars", { method: "POST", body: JSON.stringify({ summary }) }),
  listEvents: (
    token: string,
    calId: string,
    timeMin: string,
    timeMax: string,
    privateExtendedProperty?: string,
  ) =>
    gfetch(
      token,
      `/calendars/${encodeURIComponent(calId)}/events?singleEvents=true&maxResults=2500` +
        `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
        (privateExtendedProperty
          ? `&privateExtendedProperty=${encodeURIComponent(privateExtendedProperty)}`
          : ""),
    ),
  deleteEvent: (token: string, calId: string, eventId: string) =>
    gfetch(token, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    }),
  insertEvent: (token: string, calId: string, ev: GEvent) =>
    gfetch(token, `/calendars/${encodeURIComponent(calId)}/events`, {
      method: "POST",
      body: JSON.stringify(ev),
    }),
};
