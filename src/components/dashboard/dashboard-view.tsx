// src/components/dashboard/dashboard-view.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, AlertTriangle, Loader2, ShieldAlert, ChevronLeft, ChevronRight, Pencil, List, Table2, PieChart, Plus, CalendarCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { formatTime, cn } from "@/lib/utils";
import { activityMeta } from "@/components/schedule/activity-meta";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DayCircle } from "@/components/schedule/day-circle";
import { BlocksTable } from "@/components/schedule/blocks-table";
import { AddEventDialog } from "@/components/schedule/add-event-dialog";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Block {
  id: string;
  activityType: string;
  title: string | null;
  startTime: string;
  endTime: string;
  isHealthBlock: boolean;
  completion: { status: string } | null;
}
interface Schedule {
  id: string;
  mode: string;
  isOverloaded: boolean;
  blocks: Block[];
}
interface Warning {
  code: string;
  message: string;
}

const dateStrOf = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD local
};

export function DashboardView() {
  const { t, lang } = useI18n();
  const [maxDays, setMaxDays] = useState(3); // mặc định free; cập nhật sau khi biết gói
  const [isPremium, setIsPremium] = useState(false);
  const [view, setView] = useState<"list" | "table" | "pie">("list");
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offset, setOffset] = useState(0); // 0 = hôm nay
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [editBlock, setEditBlock] = useState<Block | null>(null);
  const [eStart, setEStart] = useState("");
  const [eEnd, setEEnd] = useState("");
  const [savingTime, setSavingTime] = useState(false);

  // Xác định gói để biết phạm vi xem (free 3 ngày, premium 7 ngày)
  useEffect(() => {
    (async () => {
      try {
        const me = (await api.me()) as { isPremium: boolean };
        setIsPremium(me.isPremium);
        setMaxDays(me.isPremium ? 7 : 3);
      } catch {
        setMaxDays(3);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.getSchedule(dateStrOf(offset), 1)) as Schedule[];
      setSchedule(data[0] ?? null);
    } catch {
      toast.error(t("dash.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [offset, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate(mode: "STANDARD" | "EMERGENCY" = "STANDARD") {
    setGenerating(true);
    try {
      const res = (await api.generateSchedule({
        date: dateStrOf(0),
        horizonDays: maxDays, // lập lịch cho đúng phạm vi được xem
        mode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // giờ thật của trình duyệt
      })) as { warnings: Warning[]; feasible: boolean };
      setWarnings(res.warnings ?? []);
      await load();
      toast.success(res.feasible ? t("dash.ready") : t("dash.builtWarn"));
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "PREMIUM_REQUIRED") toast.error(t("dash.premiumOnly"));
        else toast.error(err.message);
      } else toast.error(t("dash.genErr"));
    } finally {
      setGenerating(false);
    }
  }

  async function toggle(block: Block) {
    const done = block.completion?.status === "COMPLETED";
    const next = done ? "SKIPPED" : "COMPLETED";
    setSchedule((s) =>
      s ? { ...s, blocks: s.blocks.map((b) => (b.id === block.id ? { ...b, completion: { status: next } } : b)) } : s,
    );
    try {
      await api.completeBlock(block.id, { status: next });
    } catch {
      toast.error(t("dash.updateErr"));
      void load();
    }
  }

  function toHHmm(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function withTime(baseIso: string, hhmm: string) {
    const d = new Date(baseIso);
    const [h, m] = hhmm.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }
  function openEdit(b: Block) {
    setEditBlock(b);
    setEStart(toHHmm(b.startTime));
    setEEnd(toHHmm(b.endTime));
  }
  async function saveTime() {
    if (!editBlock) return;
    const start = withTime(editBlock.startTime, eStart);
    const end = withTime(editBlock.startTime, eEnd);
    if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1); // qua nửa đêm
    setSavingTime(true);
    try {
      await api.updateBlock(editBlock.id, { startTime: start.toISOString(), endTime: end.toISOString() });
      setEditBlock(null);
      await load();
      toast.success(t("sched.timeSaved"));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("sched.timeErr"));
    } finally {
      setSavingTime(false);
    }
  }

  async function syncGoogle() {
    if (!isPremium) {
      toast.error(t("gcal.premium"));
      return;
    }
    setSyncing(true);
    try {
      const res = (await api.syncCalendar(dateStrOf(0), maxDays)) as { synced: number; empty?: boolean };
      if (res.empty) toast.error(t("gcal.empty"));
      else toast.success(t("gcal.done", { n: String(res.synced) }));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("gcal.err"));
    } finally {
      setSyncing(false);
    }
  }

  function blockLabel(b: Block) {
    // Show the user-entered name for tasks AND fixed activities/events;
    // health blocks (sleep/meal/…) have no title and fall back to the type label.
    if (b.title && b.title.trim()) return b.title;
    return t(`act.${b.activityType}`);
  }

  const segCls = (a: boolean) =>
    cn(
      "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition",
      a ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  const selectedDate = new Date();
  selectedDate.setDate(selectedDate.getDate() + offset);
  const dateLabel =
    offset === 0
      ? t("dash.today")
      : selectedDate.toLocaleDateString(lang === "vi" ? "vi-VN" : undefined, {
          weekday: "long",
          day: "numeric",
          month: "short",
        });
  const atRangeEnd = offset >= maxDays - 1;

  // Thanh điều hướng ngày
  const dayNav = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - 1))} aria-label="prev">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[7rem] text-center text-sm font-medium capitalize">{dateLabel}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={atRangeEnd}
          onClick={() => setOffset((o) => Math.min(maxDays - 1, o + 1))} aria-label="next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {offset > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>{t("dash.today")}</Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setAddEventOpen(true)} disabled={generating}>
          <Plus className="mr-1 h-4 w-4" />
          {t("sched.addEvent")}
        </Button>
        <Button variant="outline" size="sm" onClick={syncGoogle} disabled={syncing || generating}>
          {syncing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-1 h-4 w-4" />}
          {t("gcal.sync")}{!isPremium ? " ★" : ""}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEmergencyOpen(true)} disabled={generating}>
          <ShieldAlert className="mr-1 h-4 w-4" />
          {t("dash.emergency")}
        </Button>
        <Button size="sm" onClick={() => generate("STANDARD")} disabled={generating}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("dash.regenerate")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {dayNav}

      <AddEventDialog open={addEventOpen} onOpenChange={setAddEventOpen} onCreated={() => generate("STANDARD")} />

      {maxDays < 7 && atRangeEnd && (
        <p className="text-center text-xs text-muted-foreground">{t("dash.premiumRange")}</p>
      )}

      {warnings.map((w, i) => (
        <Alert key={i} variant={w.code === "SLEEP_BELOW_MINIMUM" || w.code === "OVERLOADED" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">{t("dash.headsUp")}</AlertTitle>
          <AlertDescription className="text-sm">{w.message}</AlertDescription>
        </Alert>
      ))}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !schedule || schedule.blocks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" />
          <h2 className="font-display text-xl font-semibold">{t("dash.planTitle")}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{t("dash.planDesc")}</p>
          <Button className="mt-5" onClick={() => generate()} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {t("dash.generateToday")}
          </Button>
        </div>
      ) : (
        <>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button onClick={() => setView("list")} className={segCls(view === "list")}>
            <List className="h-4 w-4" /> {t("view.list")}
          </button>
          <button onClick={() => setView("table")} className={segCls(view === "table")}>
            <Table2 className="h-4 w-4" /> {t("view.table")}
          </button>
          <button
            onClick={() => (isPremium ? setView("pie") : toast.error(t("view.piePremium")))}
            className={segCls(view === "pie")}
          >
            <PieChart className="h-4 w-4" /> {t("view.pie")}{!isPremium ? " ★" : ""}
          </button>
        </div>

        {view === "list" && (
        <ul className="space-y-1.5">
          {schedule.blocks.map((b) => {
            const meta = activityMeta(b.activityType);
            const done = b.completion?.status === "COMPLETED";
            return (
              <li key={b.id} className={cn("group flex items-center gap-3 rounded-lg border border-border border-l-4 bg-card px-4 py-3", meta.accent)}>
                <Checkbox checked={done} onCheckedChange={() => toggle(b)} className="h-5 w-5" />
                <span className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground">
                  {formatTime(b.startTime)} – {formatTime(b.endTime)}
                </span>
                <span className={cn("flex-1 text-sm", done && "text-muted-foreground line-through")}>{blockLabel(b)}</span>
                {b.isHealthBlock && <Badge variant="outline" className="text-[11px]">{t("common.health")}</Badge>}
                <button onClick={() => openEdit(b)} aria-label={t("sched.editTime")}
                  className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
        )}
        {view === "table" && (
          <BlocksTable
            blocks={schedule.blocks.map((b) => ({
              id: b.id,
              label: blockLabel(b),
              startTime: b.startTime,
              endTime: b.endTime,
              isHealthBlock: b.isHealthBlock,
              done: b.completion?.status === "COMPLETED",
            }))}
          />
        )}
        {view === "pie" && isPremium && (
          <DayCircle
            blocks={schedule.blocks.map((b) => ({
              id: b.id,
              type: b.activityType,
              label: blockLabel(b),
              startTime: b.startTime,
              endTime: b.endTime,
            }))}
          />
        )}
        </>
      )}

      <Dialog open={!!editBlock} onOpenChange={(o) => !o && setEditBlock(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sched.editTime")}</DialogTitle>
          </DialogHeader>
          {editBlock && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("sched.start")}</Label>
                <Input type="time" value={eStart} onChange={(e) => setEStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("sched.end")}</Label>
                <Input type="time" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBlock(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveTime} disabled={savingTime}>
              {savingTime && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              {t("dash.emergencyTitle")}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left">
              <span className="block">{t("dash.emergencyIntro")}</span>
              <span className="block">{t("dash.emergencyL1")}</span>
              <span className="block">{t("dash.emergencyL2")}</span>
              <span className="block pt-1 text-xs">{t("dash.emergencyNote")}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmergencyOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => { setEmergencyOpen(false); void generate("EMERGENCY"); }}>
              {t("dash.runEmergency")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
