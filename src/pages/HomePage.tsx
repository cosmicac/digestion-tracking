import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EVENT_TYPES, EVENT_TYPE_LABELS, type DigestionEvent } from "../../shared/schema";
import { useEvents } from "../api";
import { EVENT_STYLE, eventSubtitle, eventTitle } from "../lib/eventMeta";
import { formatDayHeading, formatTime, localDayKey } from "../lib/time";

const PAGE_DAYS = 14;

export function HomePage() {
  const { data: events, isLoading, error, refetch, isFetching } = useEvents();
  const [daysShown, setDaysShown] = useState(PAGE_DAYS);

  const days = useMemo(() => {
    const groups = new Map<string, DigestionEvent[]>();
    for (const e of events ?? []) {
      const key = localDayKey(e.occurredAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return [...groups.entries()];
  }, [events]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-3">
        {EVENT_TYPES.map((t) => (
          <Link
            key={t}
            to="/log/$type"
            params={{ type: t }}
            className={`flex flex-col items-center gap-1 rounded-2xl border p-4 text-center shadow-sm active:scale-95 ${EVENT_STYLE[t].bg}`}
          >
            <span className="text-3xl">{EVENT_STYLE[t].emoji}</span>
            <span className={`text-xs font-semibold leading-tight ${EVENT_STYLE[t].color}`}>
              {EVENT_TYPE_LABELS[t]}
            </span>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Timeline</h2>
          <button
            onClick={() => refetch()}
            className="text-sm text-teal-700 disabled:opacity-50"
            disabled={isFetching}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {isLoading && <p className="py-8 text-center text-stone-500">Loading…</p>}
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error.message}</p>
        )}
        {events && events.length === 0 && (
          <p className="py-8 text-center text-stone-500">
            Nothing logged yet. Tap a button above to get started.
          </p>
        )}

        <div className="space-y-5">
          {days.slice(0, daysShown).map(([day, items]) => (
            <div key={day}>
              <h3 className="mb-2 text-sm font-semibold text-stone-700">
                {formatDayHeading(day)}
              </h3>
              <ul className="space-y-2">
                {items.map((e) => (
                  <li key={e.id}>
                    <EventRow event={e} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {days.length > daysShown && (
          <button
            onClick={() => setDaysShown((d) => d + PAGE_DAYS)}
            className="mt-4 w-full rounded-lg border border-stone-300 py-2 text-sm text-stone-700"
          >
            Show older
          </button>
        )}
      </section>
    </div>
  );
}

function EventRow({ event: e }: { event: DigestionEvent }) {
  const style = EVENT_STYLE[e.type];
  const subtitle = eventSubtitle(e);
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: e.id }}
      className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm hover:bg-stone-50"
    >
      <span className="text-2xl">{style.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-medium ${style.color}`}>{eventTitle(e)}</span>
          <span className="shrink-0 text-xs text-stone-500">{formatTime(e.occurredAt)}</span>
        </div>
        {subtitle && <div className="truncate text-sm text-stone-600">{subtitle}</div>}
        {e.notes && <div className="line-clamp-2 text-sm text-stone-500">{e.notes}</div>}
      </div>
    </Link>
  );
}
