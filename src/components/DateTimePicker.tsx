import { useState } from "react";

type Props = {
  value: Date;
  onChange: (d: Date) => void;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const SHORTCUTS = [
  { label: "Now", minutes: 0 },
  { label: "−15m", minutes: -15 },
  { label: "−30m", minutes: -30 },
  { label: "−1h", minutes: -60 },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

function describeDay(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

/** Inline date + time picker styled to match the app (no native datetime input). */
export function DateTimePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    () => new Date(value.getFullYear(), value.getMonth(), 1),
  );

  const today = startOfDay(new Date());
  const hours24 = value.getHours();
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const isPm = hours24 >= 12;

  function setDay(day: Date) {
    const d = new Date(value);
    d.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(d);
  }

  function setTime(h12: number, minute: number, pm: boolean) {
    const d = new Date(value);
    d.setHours((h12 % 12) + (pm ? 12 : 0), minute, 0, 0);
    onChange(d);
  }

  function applyShortcut(minutes: number) {
    const base = minutes === 0 ? new Date() : new Date(value.getTime() + minutes * 60_000);
    base.setSeconds(0, 0);
    onChange(base);
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }

  // Calendar grid for the visible month
  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1),
    ),
  ];
  const canGoNext =
    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1).getTime() <= today.getTime();

  const shiftMonth = (delta: number) =>
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));

  const timeLabel = value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <CalendarIcon />
          <span>
            <span className="font-semibold text-stone-900">{describeDay(value)}</span>
            <span className="text-stone-400"> · </span>
            <span className="font-semibold text-stone-900">{timeLabel}</span>
          </span>
        </span>
        <span className="text-sm font-medium text-teal-700">{open ? "Done" : "Change"}</span>
      </button>

      <div className="flex flex-wrap gap-2 border-t border-stone-100 px-4 py-3">
        {SHORTCUTS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => applyShortcut(s.minutes)}
            className="rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 active:bg-stone-200"
          >
            {s.label}
          </button>
        ))}
      </div>

      {open && (
        <div className="space-y-4 border-t border-stone-100 px-4 pt-3 pb-4">
          {/* Calendar */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <NavButton onClick={() => shiftMonth(-1)} label="Previous month">
                ‹
              </NavButton>
              <span className="font-medium text-stone-800">
                {viewMonth.toLocaleDateString([], { month: "long", year: "numeric" })}
              </span>
              <NavButton onClick={() => shiftMonth(1)} label="Next month" disabled={!canGoNext}>
                ›
              </NavButton>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="py-1 text-xs font-medium text-stone-400">
                  {w}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const selected = sameDay(d, value);
                const isToday = sameDay(d, today);
                const future = d.getTime() > today.getTime();
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={future}
                    onClick={() => setDay(d)}
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition ${
                      selected
                        ? "bg-teal-700 font-semibold text-white"
                        : isToday
                          ? "font-semibold text-teal-700 ring-1 ring-teal-600"
                          : future
                            ? "text-stone-300"
                            : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center justify-center gap-2">
            <TimeSelect
              value={hour12}
              options={Array.from({ length: 12 }, (_, i) => i + 1)}
              onChange={(h) => setTime(h, value.getMinutes(), isPm)}
              label="Hour"
            />
            <span className="text-xl font-semibold text-stone-400">:</span>
            <TimeSelect
              value={value.getMinutes()}
              options={Array.from({ length: 60 }, (_, i) => i)}
              onChange={(m) => setTime(hour12, m, isPm)}
              format={(m) => String(m).padStart(2, "0")}
              label="Minute"
            />
            <div className="ml-2 flex overflow-hidden rounded-lg border border-stone-300">
              {(["AM", "PM"] as const).map((p) => {
                const active = (p === "PM") === isPm;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTime(hour12, value.getMinutes(), p === "PM")}
                    className={`px-3 py-2 text-sm font-semibold ${
                      active ? "bg-teal-700 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeSelect(props: {
  value: number;
  options: number[];
  onChange: (v: number) => void;
  format?: (v: number) => string;
  label: string;
}) {
  const fmt = props.format ?? String;
  return (
    <select
      aria-label={props.label}
      value={props.value}
      onChange={(e) => props.onChange(Number(e.target.value))}
      className="appearance-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-center text-lg font-semibold text-stone-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
    >
      {props.options.map((o) => (
        <option key={o} value={o}>
          {fmt(o)}
        </option>
      ))}
    </select>
  );
}

function NavButton(props: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-stone-600 hover:bg-stone-100 disabled:opacity-30"
    >
      {props.children}
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-teal-700"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
