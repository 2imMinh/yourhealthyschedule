// src/components/schedule/blocks-table.tsx
"use client";

import { formatTime, formatDuration, cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

export interface TableBlock {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  isHealthBlock: boolean;
  done: boolean;
}

export function BlocksTable({ blocks }: { blocks: TableBlock[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t("sched.start")}–{t("sched.end")}</th>
            <th className="px-4 py-2 font-medium">{t("table.activity")}</th>
            <th className="px-4 py-2 text-right font-medium">{t("table.duration")}</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => {
            const mins = Math.max(0, Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000));
            return (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                  {formatTime(b.startTime)} – {formatTime(b.endTime)}
                </td>
                <td className={cn("px-4 py-2", b.done && "text-muted-foreground line-through")}>
                  {b.label}
                  {b.isHealthBlock && <Badge variant="outline" className="ml-2 text-[10px]">{t("common.health")}</Badge>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatDuration(mins)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
