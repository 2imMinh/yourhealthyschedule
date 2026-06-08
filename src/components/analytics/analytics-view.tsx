// src/components/analytics/analytics-view.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  LineChart,
  Line,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

type Range = "daily" | "weekly" | "monthly";

interface DaySeries {
  date: string;
  completionRate: number;
  healthAdherenceRate: number;
  sleepMinutes: number;
  minutesByActivity: Record<string, number>;
}
interface Analytics {
  series: DaySeries[];
  totals: {
    avgCompletionRate: number;
    avgHealthAdherenceRate: number;
    avgSleepMinutes: number;
    minutesByActivity: Record<string, number>;
    daysTracked: number;
  };
}

const fmtPct = (x: number) => `${Math.round(x * 100)}%`;
const fmtHrs = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsView() {
  const { t } = useI18n();
  const [range, setRange] = useState<Range>("weekly");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await api.analytics(range)) as Analytics);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData =
    data?.series.map((d) => ({
      date: shortDate(d.date),
      sleep: Math.round((d.minutesByActivity.SLEEP ?? 0) / 60),
      work: Math.round(((d.minutesByActivity.WORK ?? 0) + (d.minutesByActivity.TASK ?? 0)) / 60),
      health: Math.round(((d.minutesByActivity.MEAL ?? 0) + (d.minutesByActivity.EXERCISE ?? 0)) / 60),
      completion: Math.round(d.completionRate * 100),
      sleepH: +(d.sleepMinutes / 60).toFixed(1),
    })) ?? [];

  return (
    <div className="space-y-6">
      <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
        <TabsList>
          <TabsTrigger value="daily">{t("an.daily")}</TabsTrigger>
          <TabsTrigger value="weekly">{t("an.weekly")}</TabsTrigger>
          <TabsTrigger value="monthly">{t("an.monthly")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Skeleton className="h-[420px] w-full rounded-xl" />
      ) : !data || data.totals.daysTracked === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {t("an.empty")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("an.statCompletion")} value={fmtPct(data.totals.avgCompletionRate)} />
            <Stat label={t("an.statSleep")} value={fmtHrs(data.totals.avgSleepMinutes)} />
            <Stat label={t("an.statHealth")} value={fmtPct(data.totals.avgHealthAdherenceRate)} />
            <Stat label={t("an.statDays")} value={String(data.totals.daysTracked)} />
          </div>

          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-medium">{t("an.chartBalance")}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="sleep" stackId="a" fill="var(--primary)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="work" stackId="a" fill="var(--muted-foreground)" />
                  <Bar dataKey="health" stackId="a" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-medium">{t("an.chartSleep")}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <RTooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <ReferenceLine y={6} stroke="var(--destructive)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="sleepH" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
