import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BowelMovementEvent,
  DiscomfortEvent,
  MealEvent,
} from "../../shared/schema";
import { useEvents } from "../api";
import { bristolColor, severityColor } from "../lib/eventMeta";
import { formatDuration, localDayKey } from "../lib/time";

const RANGES = [7, 30, 90] as const;

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });

export function InsightsPage() {
  const { data: events, isLoading } = useEvents();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const data = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (range - 1));
    const startMs = start.getTime();
    const endMs = Date.now();

    const inRange = (events ?? []).filter((e) => Date.parse(e.occurredAt) >= startMs);
    const meals = inRange.filter((e): e is MealEvent => e.type === "meal");
    const bms = inRange.filter((e): e is BowelMovementEvent => e.type === "bowel_movement");
    const discomforts = inRange.filter((e): e is DiscomfortEvent => e.type === "discomfort");

    // One bucket per local day in the range
    const days: { key: string; ms: number; maxSeverity: number; minutes: number; count: number }[] =
      [];
    for (let d = new Date(start); d.getTime() <= endMs; d.setDate(d.getDate() + 1)) {
      days.push({ key: localDayKey(d), ms: d.getTime(), maxSeverity: 0, minutes: 0, count: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const e of discomforts) {
      const day = byKey.get(localDayKey(e.occurredAt));
      if (!day) continue;
      day.maxSeverity = Math.max(day.maxSeverity, e.severity);
      day.minutes += e.durationMin;
      day.count++;
    }

    const ingredientCounts = new Map<string, number>();
    for (const m of meals)
      for (const i of m.ingredients) ingredientCounts.set(i, (ingredientCounts.get(i) ?? 0) + 1);
    const topIngredients = [...ingredientCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    const avgBristol = bms.length ? bms.reduce((s, e) => s + e.bristolType, 0) / bms.length : null;
    const normalPct = bms.length
      ? (bms.filter((e) => e.bristolType === 3 || e.bristolType === 4).length / bms.length) * 100
      : null;
    const avgSeverity = discomforts.length
      ? discomforts.reduce((s, e) => s + e.severity, 0) / discomforts.length
      : null;

    return {
      startMs,
      endMs,
      meals,
      bms,
      discomforts,
      days,
      topIngredients,
      avgBristol,
      normalPct,
      avgSeverity,
      bmPerDay: bms.length / range,
      stoolPoints: bms.map((e) => ({ x: Date.parse(e.occurredAt), y: e.bristolType })),
    };
  }, [events, range]);

  if (isLoading) return <p className="py-8 text-center text-stone-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              range === r
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {r} days
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Bowel movements" value={`${data.bms.length}`} sub={`${data.bmPerDay.toFixed(1)} / day`} />
        <Stat
          label="Avg stool type"
          value={data.avgBristol ? data.avgBristol.toFixed(1) : "–"}
          sub={data.normalPct != null ? `${Math.round(data.normalPct)}% type 3–4` : undefined}
        />
        <Stat
          label="Discomfort"
          value={`${data.discomforts.length}`}
          sub={formatDuration(data.discomforts.reduce((s, e) => s + e.durationMin, 0)) + " total"}
        />
        <Stat
          label="Avg severity"
          value={data.avgSeverity ? data.avgSeverity.toFixed(1) : "–"}
          sub="out of 10"
        />
      </div>

      <Card title="Stool type over time" hint="Green = normal (3–4)">
        {data.stoolPoints.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <ReferenceArea y1={2.5} y2={4.5} fill="#16a34a" fillOpacity={0.08} />
              <XAxis
                type="number"
                dataKey="x"
                domain={[data.startMs, data.endMs]}
                tickFormatter={shortDate}
                fontSize={11}
                scale="time"
              />
              <YAxis type="number" dataKey="y" domain={[1, 7]} ticks={[1, 2, 3, 4, 5, 6, 7]} fontSize={11} />
              <Tooltip
                formatter={(v, name) => (name === "x" ? shortDate(Number(v)) : `Type ${v}`)}
                labelFormatter={() => ""}
              />
              <Scatter data={data.stoolPoints}>
                {data.stoolPoints.map((p, i) => (
                  <Cell key={i} fill={bristolColor(p.y)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Worst discomfort per day">
        {data.discomforts.length === 0 ? (
          <Empty />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.days} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="ms" tickFormatter={shortDate} fontSize={11} minTickGap={20} />
              <YAxis domain={[0, 10]} ticks={[0, 5, 10]} fontSize={11} />
              <Tooltip
                labelFormatter={(v) => shortDate(Number(v))}
                formatter={(v, _n, item) => [
                  `${v}/10 · ${item.payload.count} episode(s), ${formatDuration(item.payload.minutes)}`,
                  "Max severity",
                ]}
              />
              <Bar dataKey="maxSeverity" radius={[3, 3, 0, 0]}>
                {data.days.map((d) => (
                  <Cell key={d.key} fill={severityColor(d.maxSeverity)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card title="Top ingredients" hint={`${data.meals.length} meals`}>
        {data.topIngredients.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5">
            {data.topIngredients.map(([name, count]) => (
              <li key={name} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 truncate">{name}</span>
                <div className="h-2 flex-1 rounded bg-stone-100">
                  <div
                    className="h-2 rounded bg-amber-400"
                    style={{ width: `${(count / data.topIngredients[0][1]) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-stone-500">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mb-3 text-xs text-stone-500">{hint}</p>}
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-stone-400">No data yet</p>;
}
