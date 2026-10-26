import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { DigestionEvent, SavedMeal } from "../../shared/schema";
import { useDeleteEvent, useSaveEvent } from "../api";
import { useSortedSavedMeals } from "../lib/meals";
import { deviceTimezone } from "../lib/time";

const MAX_SHOWN = 4;
const TOAST_MS = 6000;

/** One-tap logging of saved meals at the current time, with undo. */
export function QuickLog() {
  const meals = useSortedSavedMeals();
  const save = useSaveEvent();
  const del = useDeleteEvent();
  const [toast, setToast] = useState<
    { kind: "logged"; event: DigestionEvent; name: string } | { kind: "message"; text: string } | null
  >(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function show(t: NonNullable<typeof toast>) {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  async function log(m: SavedMeal) {
    try {
      const event = await save.mutateAsync({
        type: "meal",
        occurredAt: new Date().toISOString(),
        timezone: deviceTimezone(),
        notes: m.description,
        mealType: m.mealType,
        ingredients: m.ingredients,
        savedMealId: m.id,
      });
      show({ kind: "logged", event, name: m.name });
    } catch (err) {
      show({ kind: "message", text: err instanceof Error ? err.message : "Failed to log" });
    }
  }

  async function undo(event: DigestionEvent) {
    clearTimeout(timer.current);
    setToast(null);
    try {
      await del.mutateAsync(event.id);
      show({ kind: "message", text: "Removed" });
    } catch {
      show({ kind: "message", text: "Couldn't undo. Delete it from the timeline instead." });
    }
  }

  if (!meals.length) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Quick log
      </h2>
      <div className="flex flex-wrap gap-2">
        {meals.slice(0, MAX_SHOWN).map((m) => (
          <button
            key={m.id}
            onClick={() => log(m)}
            disabled={save.isPending}
            className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm active:scale-95 disabled:opacity-60"
          >
            <span>⭐</span>
            {m.name}
          </button>
        ))}
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-16 z-20 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="flex w-full max-w-md items-center gap-3 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
            {toast.kind === "logged" ? (
              <>
                <span className="flex-1 truncate">✓ Logged {toast.name}</span>
                <button onClick={() => undo(toast.event)} className="font-semibold text-amber-300">
                  Undo
                </button>
                <Link
                  to="/events/$eventId"
                  params={{ eventId: toast.event.id }}
                  className="font-semibold text-teal-300"
                >
                  Edit
                </Link>
              </>
            ) : (
              <span className="flex-1">{toast.text}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
