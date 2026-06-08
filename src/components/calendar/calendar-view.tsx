// src/components/calendar/calendar-view.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { activityMeta } from "@/components/schedule/activity-meta";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Block {
  id: string;
  activityType: string;
  title: string | null;
  startTime: string;
  endTime: string;
}
interface Schedule {
  date: string;
  blocks: Block[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const START_HOUR = 6;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const PX_PER_HOUR = 44;

/** Monday-start week containing `ref`. */
function weekStart(ref: Date): Date {
  const d = new Date(ref);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function CalendarView() {
  const { t } = useI18n();
  const [anchor, setAnchor] = useState(() => weekStart(new Date()));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [anchor],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const startStr = anchor.toLocaleDateString("en-CA");
      const data = (await api.getSchedule(startStr, 7)) as Schedule[];
      setSchedules(data);
    } finally {
      setLoading(false);
    }
  }, [anchor]);

  useEffect(() => {
    void load();
  }, [load]);

  const blocksFor = (day: Date) => {
    const key = day.toLocaleDateString("en-CA");
    const sched = schedules.find((s) => new Date(s.date).toLocaleDateString("en-CA") === key);
    return sched?.blocks ?? [];
  };

  const shiftWeek = (dir: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * 7);
    setAnchor(d);
  };

  const label = `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="Previous week">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAnchor(weekStart(new Date()))}>
          {t("cal.today")}
        </Button>
        <Button variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="Next week">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-sm font-medium">{label}</span>
      </div>

      {loading ? (
        <Skeleton className="h-[640px] w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <div className="grid min-w-[720px] grid-cols-[48px_repeat(7,1fr)]">
            {/* header row */}
            <div className="border-b border-border" />
            {days.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className={cn(
                    "border-b border-l border-border py-2 text-center text-xs",
                    isToday ? "font-semibold text-primary" : "text-muted-foreground",
                  )}
                >
                  {DAY_LABELS[d.getDay()]} {d.getDate()}
                </div>
              );
            })}

            {/* time gutter + day columns */}
            <div className="relative">
              {HOURS.map((h) => (
                <div key={h} style={{ height: PX_PER_HOUR }} className="pr-1 text-right text-[10px] text-muted-foreground">
                  {h}:00
                </div>
              ))}
            </div>

            {days.map((d, i) => (
              <div key={i} className="relative border-l border-border" style={{ height: HOURS.length * PX_PER_HOUR }}>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: PX_PER_HOUR }} className="border-b border-border/50" />
                ))}
                {blocksFor(d).map((b) => {
                  const start = new Date(b.startTime);
                  const end = new Date(b.endTime);
                  const top = (start.getHours() + start.getMinutes() / 60 - START_HOUR) * PX_PER_HOUR;
                  const height = Math.max(14, ((end.getTime() - start.getTime()) / 3_600_000) * PX_PER_HOUR);
                  if (top + height < 0) return null;
                  const meta = activityMeta(b.activityType);
                  return (
                    <div
                      key={b.id}
                      title={b.activityType === "TASK" ? (b.title ?? t("act.TASK")) : t(`act.${b.activityType}`)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border-l-2 bg-secondary/70 px-1.5 py-0.5 text-[10px] leading-tight",
                        meta.accent,
                      )}
                      style={{ top: Math.max(0, top), height }}
                    >
                      {b.activityType === "TASK" ? (b.title ?? t("act.TASK")) : t(`act.${b.activityType}`)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
