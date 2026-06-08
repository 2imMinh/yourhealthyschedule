// src/components/schedule/day-circle.tsx
// 24-hour radial "circle planner": midnight at top, clockwise. Each activity is
// a colored wedge from its start to end time. Gaps = free time.
"use client";

import { useI18n } from "@/lib/i18n";

export interface CircleBlock {
  id: string;
  type: string;
  label: string;
  startTime: string;
  endTime: string;
}

const COLORS: Record<string, string> = {
  SLEEP: "#b9a3e3",
  MEAL: "#f3c277",
  EXERCISE: "#8fd0a0",
  WORK: "#9ab2d6",
  STUDY: "#8fa9cf",
  NAP: "#d3c0ee",
  TASK: "#f0a868",
  COOKING: "#f0b8a0",
  ENTERTAINMENT: "#9ed7cf",
  COMMUTE: "#c7ccd4",
  SOCIAL: "#e3a9c7",
  BUFFER: "#d8d8d8",
};
const colorFor = (t: string) => COLORS[t] ?? "#cbd5e1";

const CX = 150;
const CY = 150;
const R_OUT = 128;
const R_IN = 62;

function minutesOf(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
function polar(r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180; // 0° at top
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
function wedgePath(startAngle: number, endAngle: number): string {
  const sweep = endAngle - startAngle;
  const large = sweep % 360 > 180 ? 1 : 0;
  const [x1, y1] = polar(R_OUT, startAngle);
  const [x2, y2] = polar(R_OUT, endAngle);
  const [x3, y3] = polar(R_IN, endAngle);
  const [x4, y4] = polar(R_IN, startAngle);
  return `M${x1},${y1} A${R_OUT},${R_OUT} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${R_IN},${R_IN} 0 ${large} 0 ${x4},${y4} Z`;
}

export function DayCircle({ blocks }: { blocks: CircleBlock[] }) {
  const { t } = useI18n();

  const segments = blocks.map((b) => {
    const start = minutesOf(b.startTime);
    let end = minutesOf(b.endTime);
    if (end <= start) end += 1440; // crosses midnight (e.g. sleep)
    const startAngle = (start / 1440) * 360;
    const sweep = ((end - start) / 1440) * 360;
    return { ...b, startAngle, endAngle: startAngle + sweep, sweep };
  });

  const present = Array.from(new Map(blocks.map((b) => [b.type, b.label])).entries());

  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 300 300" className="w-full max-w-sm">
        {/* nền vòng */}
        <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} fill="none" stroke="var(--border)" strokeWidth={R_OUT - R_IN} opacity={0.25} />

        {/* các múi hoạt động */}
        {segments.map((s) => (
          <path key={s.id} d={wedgePath(s.startAngle, s.endAngle)} fill={colorFor(s.type)} stroke="var(--background)" strokeWidth={1.5} />
        ))}

        {/* nhãn cho múi đủ lớn */}
        {segments.map((s) =>
          s.sweep >= 22 ? (
            (() => {
              const [tx, ty] = polar((R_OUT + R_IN) / 2, s.startAngle + s.sweep / 2);
              return (
                <text key={`l-${s.id}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#2b2b2b" className="font-medium">
                  {s.label.length > 10 ? s.label.slice(0, 9) + "…" : s.label}
                </text>
              );
            })()
          ) : null,
        )}

        {/* số giờ quanh viền (mỗi 2 giờ) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const h = i * 2;
          const [tx, ty] = polar(R_OUT + 12, (h / 24) * 360);
          return (
            <text key={`h-${h}`} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="currentColor" className="text-muted-foreground">
              {h}
            </text>
          );
        })}

        {/* tâm */}
        <circle cx={CX} cy={CY} r={R_IN - 4} fill="var(--card)" stroke="var(--border)" />
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="13" fill="currentColor" className="font-display font-semibold">24h</text>
        <text x={CX} y={CY + 11} textAnchor="middle" fontSize="7.5" fill="currentColor" className="text-muted-foreground">timetable</text>
      </svg>

      {/* chú thích */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {present.map(([type, label]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorFor(type) }} />
            {label}
          </span>
        ))}
      </div>
      <p className="sr-only">{t("view.legend")}</p>
    </div>
  );
}
