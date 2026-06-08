// src/components/settings/commitments-form.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import { api, ApiClientError, type Commitment } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TYPES = ["WORK", "STUDY", "COMMUTE", "SOCIAL", "ENTERTAINMENT", "COOKING"];
const todayStr = () => new Date().toLocaleDateString("en-CA");
const emptyDraft = (): Commitment => ({
  id: "", title: "", activityType: "WORK", daysOfWeek: [1, 2, 3, 4, 5],
  startTime: "09:00", endTime: "10:30", startDate: todayStr(), endDate: "",
});

export function CommitmentsForm() {
  const { t } = useI18n();
  const [items, setItems] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Commitment | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.listCommitments()) as { commitments: Commitment[] };
      setItems(data.commitments);
    } catch {
      /* im lặng */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function toggleDay(d: number) {
    if (!draft) return;
    const has = draft.daysOfWeek.includes(d);
    setDraft({ ...draft, daysOfWeek: has ? draft.daysOfWeek.filter((x) => x !== d) : [...draft.daysOfWeek, d].sort() });
  }

  const valid = !!draft && draft.title.trim() && draft.daysOfWeek.length > 0 && draft.startTime < draft.endTime;

  async function save() {
    if (!draft || !valid) return;
    setSaving(true);
    const body = {
      title: draft.title, activityType: draft.activityType, daysOfWeek: draft.daysOfWeek,
      startTime: draft.startTime, endTime: draft.endTime, startDate: draft.startDate, endDate: draft.endDate,
    };
    try {
      if (draft.id) await api.updateCommitment(draft.id, body);
      else await api.createCommitment(body);
      setDraft(null);
      await load();
      toast.success(t("com.saved"));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("com.saveErr"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    try {
      await api.deleteCommitment(id);
      toast.success(t("com.deleted"));
    } catch {
      void load();
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("set.commitments")}</h2>
          <p className="text-xs text-muted-foreground">{t("com.desc")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft())}>
          <Plus className="mr-1 h-4 w-4" /> {t("com.add")}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("com.empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((c) => (
            <li key={c.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <span className="flex-1 text-sm">
                <span className="font-medium">{c.title}</span>
                <span className="text-muted-foreground"> · {c.startTime}–{c.endTime} · {c.daysOfWeek.map((d) => t(`dow.${d}`)).join(" ")}</span>
              </span>
              <button onClick={() => setDraft(c)} aria-label={t("com.editTitle")}
                className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => remove(c.id)} aria-label="delete"
                className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("com.editTitle") : t("com.add")}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("com.title")}</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("com.type")}</Label>
                <Select value={draft.activityType} onValueChange={(v) => setDraft({ ...draft, activityType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((ty) => <SelectItem key={ty} value={ty}>{t(`act.${ty}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("com.days")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      className={cn("rounded-md border px-2.5 py-1 text-xs",
                        draft.daysOfWeek.includes(d) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                      {t(`dow.${d}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("com.startTime")}</Label>
                  <Input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("com.endTime")}</Label>
                  <Input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("com.from")}</Label>
                  <Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("com.to")}</Label>
                  <Input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
            <Button onClick={save} disabled={saving || !valid}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
