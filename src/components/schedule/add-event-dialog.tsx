// src/components/schedule/add-event-dialog.tsx
// A short one-off event: name + date + start time + duration. Stored as a
// single-day fixed commitment so the engine places it on exactly that date.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => new Date().toLocaleDateString("en-CA");
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function AddEventDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("15:00");
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);

  const valid = title.trim() && date && startTime && duration > 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay(); // 0=Sun..6=Sat
      await api.createCommitment({
        title: title.trim(),
        activityType: "SOCIAL",
        daysOfWeek: [weekday],
        startTime,
        endTime: addMinutes(startTime, duration),
        startDate: date,
        endDate: date,
      });
      onOpenChange(false);
      setTitle("");
      toast.success(t("ev.added"));
      onCreated(); // trigger a regenerate so the event is placed
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("ev.addErr"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sched.addEvent")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("ev.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("ev.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("ev.startTime")}</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("ev.duration")}</Label>
            <Input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={saving || !valid}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
