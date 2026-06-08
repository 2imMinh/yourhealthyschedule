// src/components/settings/profile-form.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  wakeTime: string;
  sleepTime: string;
  targetSleepHours: number;
  minSleepHours: number;
  mealTimes: string[];
  exerciseEnabled: boolean;
  exerciseMinutes: number;
  napEnabled: boolean;
  napMinutes: number;
  commuteMinutes: number;
  workBlocks: { days: number[]; start: string; end: string }[];
  optionalActivities: string[];
}

export function ProfileForm() {
  const { t } = useI18n();
  const [p, setP] = useState<Profile | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = (await api.me()) as { isPremium: boolean };
        setIsPremium(me.isPremium);
      } catch {
        setIsPremium(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = (await api.getProfile()) as Profile & {
          targetSleepHours: string;
          minSleepHours: string;
        };
        setP({
          ...data,
          targetSleepHours: Number(data.targetSleepHours),
          minSleepHours: Number(data.minSleepHours),
          mealTimes: data.mealTimes ?? [],
          napEnabled: data.napEnabled ?? false,
          napMinutes: data.napMinutes ?? 0,
        });
      } catch {
        toast.error(t("set.loadErr"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }

  function setMeal(i: number, value: string) {
    if (!p) return;
    const next = [...p.mealTimes];
    next[i] = value;
    set("mealTimes", next);
  }
  function addMeal() {
    if (!p) return;
    set("mealTimes", [...p.mealTimes, "12:00"]);
  }
  function removeMeal(i: number) {
    if (!p) return;
    set("mealTimes", p.mealTimes.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!p) return;
    setSaving(true);
    try {
      await api.updateProfile({
        wakeTime: p.wakeTime,
        sleepTime: p.sleepTime,
        targetSleepHours: p.targetSleepHours,
        minSleepHours: p.minSleepHours,
        mealTimes: p.mealTimes,
        exerciseEnabled: p.exerciseEnabled,
        exerciseMinutes: p.exerciseMinutes,
        napEnabled: p.napEnabled,
        napMinutes: p.napMinutes,
        commuteMinutes: p.commuteMinutes,
        workBlocks: p.workBlocks,
        optionalActivities: p.optionalActivities as ("cooking" | "entertainment" | "commute" | "social")[],
      });
      setDirty(false);
      toast.success(t("set.saved"));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("set.saveErr"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !p) return <Skeleton className="h-72 w-full rounded-xl" />;

  return (
    <section className="space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("set.routine")}</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wake">{t("set.wake")}</Label>
          <Input id="wake" type="time" value={p.wakeTime} onChange={(e) => set("wakeTime", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sleep">{t("set.bedtime")}</Label>
          <Input id="sleep" type="time" value={p.sleepTime} onChange={(e) => set("sleepTime", e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("set.wakeHint")}</p>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <Label>{t("set.targetSleep")}</Label>
          <span className="tabular-nums text-muted-foreground">{p.targetSleepHours.toFixed(1)}h</span>
        </div>
        <Slider min={4} max={12} step={0.5} value={[p.targetSleepHours]} onValueChange={([v]) => set("targetSleepHours", v)} />
        <p className="text-xs text-muted-foreground">{t("set.sleepHint")}</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <Label>{t("set.minSleep")}</Label>
          <span className="tabular-nums text-muted-foreground">{p.minSleepHours.toFixed(1)}h</span>
        </div>
        <Slider
          min={isPremium ? 4 : 6}
          max={10}
          step={0.5}
          value={[Math.max(p.minSleepHours, isPremium ? 4 : 6)]}
          onValueChange={([v]) => set("minSleepHours", v)}
        />
        {!isPremium && <p className="text-xs text-muted-foreground">{t("set.minPremium")}</p>}
        {p.minSleepHours > p.targetSleepHours && (
          <p className="text-xs text-destructive">{t("set.minErr")}</p>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>{t("set.meals")}</Label>
        <p className="text-xs text-muted-foreground">{t("set.mealTip")}</p>
        <div className="flex flex-wrap gap-2">
          {p.mealTimes.map((m, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input type="time" value={m} onChange={(e) => setMeal(i, e.target.value)} className="w-32" />
              <button onClick={() => removeMeal(i)} aria-label="remove" className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addMeal}>
            <Plus className="mr-1 h-4 w-4" /> {t("set.addMeal")}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <Label>{t("set.exercise")}</Label>
          <p className="text-xs text-muted-foreground">{t("set.exerciseDesc")}</p>
        </div>
        <Switch checked={p.exerciseEnabled} onCheckedChange={(v) => set("exerciseEnabled", v)} />
      </div>
      {p.exerciseEnabled && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>{t("set.exerciseDuration")}</Label>
            <span className="tabular-nums text-muted-foreground">{p.exerciseMinutes} min</span>
          </div>
          <Slider min={10} max={120} step={5} value={[p.exerciseMinutes]} onValueChange={([v]) => set("exerciseMinutes", v)} />
        </div>
      )}


      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <Label>{t("set.nap")}</Label>
          <p className="text-xs text-muted-foreground">{t("set.napDesc")}</p>
        </div>
        <Switch checked={p.napEnabled} onCheckedChange={(v) => set("napEnabled", v)} />
      </div>
      {p.napEnabled && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>{t("set.napDuration")}</Label>
            <span className="tabular-nums text-muted-foreground">{p.napMinutes} min</span>
          </div>
          <Slider min={10} max={60} step={5} value={[p.napMinutes || 30]} onValueChange={([v]) => set("napMinutes", v)} />
        </div>
      )}

      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={save} disabled={saving || p.minSleepHours > p.targetSleepHours}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("set.save")}
          </Button>
        </div>
      )}
    </section>
  );
}
