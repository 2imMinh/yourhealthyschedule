// src/components/schedule/activity-meta.ts
// Shared visual metadata for activity types: a faint left-border accent and a
// human label. Token-based so it works under any theme palette.

export interface ActivityMeta {
  label: string;
  accent: string; // tailwind left-border class
}

export function activityMeta(type: string): ActivityMeta {
  switch (type) {
    case "SLEEP":
      return { label: "Sleep", accent: "border-l-primary/70" };
    case "MEAL":
      return { label: "Meal", accent: "border-l-primary/70" };
    case "EXERCISE":
      return { label: "Exercise", accent: "border-l-primary/70" };
    case "NAP":
      return { label: "Nap", accent: "border-l-primary/50" };
    case "WORK":
      return { label: "Work", accent: "border-l-foreground/30" };
    case "STUDY":
      return { label: "Study", accent: "border-l-foreground/30" };
    case "TASK":
      return { label: "Task", accent: "border-l-accent" };
    case "COMMUTE":
      return { label: "Commute", accent: "border-l-muted-foreground/40" };
    default:
      return { label: type.charAt(0) + type.slice(1).toLowerCase(), accent: "border-l-border" };
  }
}

export const isHealth = (type: string) =>
  type === "SLEEP" || type === "MEAL" || type === "EXERCISE" || type === "NAP";
