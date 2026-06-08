// src/components/tasks/tasks-view.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Sparkles } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
interface Task {
  id: string;
  title: string;
  estimatedMinutes: number;
  deadline: string | null;
  priority: Priority;
  status: string;
}
interface Draft {
  id: string | null; // null = đang tạo mới
  title: string;
  estimatedMinutes: number;
  deadline: string | null; // ISO
  priority: Priority;
}

const PRIORITY_DOT: Record<Priority, string> = {
  LOW: "bg-muted-foreground/40",
  MEDIUM: "bg-primary/70",
  HIGH: "bg-accent",
  URGENT: "bg-destructive",
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyDraft = (): Draft => ({ id: null, title: "", estimatedMinutes: 60, deadline: null, priority: "MEDIUM" });

export function TasksView() {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  function deadlineLabel(iso: string | null) {
    if (!iso) return t("tasks.noDeadline");
    const d = new Date(iso);
    const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
    if (days < 0) return t("tasks.overdue");
    if (days === 0) return t("tasks.today");
    if (days === 1) return t("tasks.tomorrow");
    return t("tasks.inDays", { n: days });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.listTasks()) as { tasks: Task[] };
      setTasks(data.tasks);
    } catch {
      toast.error(t("dash.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Gõ mô tả tự nhiên -> phân tích -> MỞ FORM điền sẵn (không tự lưu).
  async function parseToDraft() {
    if (!text.trim()) {
      setDraft(emptyDraft());
      return;
    }
    setParsing(true);
    try {
      const d = (await api.parseTask(text)) as {
        title: string;
        estimatedMinutes: number;
        deadline: string | null;
        priority: Priority;
        source?: "ai" | "fallback";
      };
      toast.success(d.source === "ai" ? t("tasks.aiParsed") : t("tasks.basicParsed"));
      setDraft({
        id: null,
        title: d.title || text,
        estimatedMinutes: d.estimatedMinutes || 60,
        deadline: d.deadline,
        priority: d.priority || "MEDIUM",
      });
      setText("");
    } catch {
      setDraft({ ...emptyDraft(), title: text });
      setText("");
    } finally {
      setParsing(false);
    }
  }

  // Bắt buộc: tên, thời lượng > 0, hạn chót, độ ưu tiên.
  const valid =
    !!draft && draft.title.trim().length > 0 && draft.estimatedMinutes > 0 && !!draft.deadline;

  async function saveDraft() {
    if (!draft || !valid) return;
    setSaving(true);
    try {
      if (draft.id) {
        await api.updateTask(draft.id, {
          title: draft.title,
          estimatedMinutes: draft.estimatedMinutes,
          deadline: draft.deadline ? new Date(draft.deadline) : undefined,
          priority: draft.priority,
        });
        toast.success(t("tasks.updated"));
      } else {
        await api.createTask({
          title: draft.title,
          estimatedMinutes: draft.estimatedMinutes,
          deadline: draft.deadline ? new Date(draft.deadline) : undefined,
          priority: draft.priority,
          isSplittable: true,
        });
        toast.success(t("tasks.created"));
      }
      setDraft(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("tasks.saveErr"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(task: Task) {
    const next = task.status === "DONE" ? "PENDING" : "DONE";
    setTasks((ts) => ts.map((x) => (x.id === task.id ? { ...x, status: next } : x)));
    try {
      await api.updateTask(task.id, { status: next });
    } catch {
      void load();
    }
  }

  async function remove(task: Task) {
    setTasks((ts) => ts.filter((x) => x.id !== task.id));
    try {
      await api.deleteTask(task.id);
    } catch {
      void load();
    }
  }

  const visible = tasks.filter((x) => (filter === "ALL" ? true : x.status === filter));

  return (
    <div className="space-y-5">
      {/* Mô tả nhanh (tuỳ chọn) -> mở form điền sẵn; hoặc bấm "Thêm công việc" */}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && parseToDraft()}
          placeholder={t("tasks.placeholder")}
          className="flex-1"
        />
        {text.trim() ? (
          <Button variant="outline" onClick={parseToDraft} disabled={parsing}>
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        ) : null}
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">{t("tasks.newTask")}</span>
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="ALL">{t("tasks.all")}</TabsTrigger>
          <TabsTrigger value="PENDING">{t("tasks.pending")}</TabsTrigger>
          <TabsTrigger value="SCHEDULED">{t("tasks.scheduled")}</TabsTrigger>
          <TabsTrigger value="DONE">{t("tasks.done")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("tasks.empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((task) => {
            const overdue = task.deadline && new Date(task.deadline).getTime() < Date.now();
            return (
              <li key={task.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <Checkbox checked={task.status === "DONE"} onCheckedChange={() => toggle(task)} />
                <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])} />
                <span className={cn("flex-1 text-sm", task.status === "DONE" && "text-muted-foreground line-through")}>
                  {task.title}
                </span>
                <Badge variant="outline" className="text-[11px]">{formatDuration(task.estimatedMinutes)}</Badge>
                <span className={cn("w-24 text-right text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                  {deadlineLabel(task.deadline)}
                </span>
                <button
                  onClick={() => setDraft({ id: task.id, title: task.title, estimatedMinutes: task.estimatedMinutes, deadline: task.deadline, priority: task.priority })}
                  aria-label={t("tasks.editTitle")}
                  className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(task)} aria-label="delete"
                  className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Form thêm/sửa — bắt buộc điền thời lượng, hạn, độ ưu tiên */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("tasks.editTitle") : t("tasks.addTitle")}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("tasks.fieldTitle")}</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{t("tasks.duration")}</Label>
                  <Input type="number" min={1} value={draft.estimatedMinutes}
                    onChange={(e) => setDraft({ ...draft, estimatedMinutes: Number(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("tasks.priority")}</Label>
                  <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v as Priority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">{t("prio.LOW")}</SelectItem>
                      <SelectItem value="MEDIUM">{t("prio.MEDIUM")}</SelectItem>
                      <SelectItem value="HIGH">{t("prio.HIGH")}</SelectItem>
                      <SelectItem value="URGENT">{t("prio.URGENT")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("tasks.deadline")}</Label>
                <Input type="datetime-local" value={toLocalInput(draft.deadline)}
                  onChange={(e) => setDraft({ ...draft, deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveDraft} disabled={saving || !valid}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
