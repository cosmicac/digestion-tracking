import { useMemo, useState, type ReactNode } from "react";
import {
  BRISTOL_SCALE,
  DISCOMFORT_SUBTYPES,
  MEAL_TYPES,
  type DigestionEvent,
  type DiscomfortSubtype,
  type EventInput,
  type EventType,
  type MealType,
} from "../../shared/schema";
import { useEvents, useSaveEvent } from "../api";
import { bristolColor, capitalize, severityColor } from "../lib/eventMeta";
import { deviceTimezone } from "../lib/time";
import { DateTimePicker } from "./DateTimePicker";
import { TagInput } from "./TagInput";

type Props = {
  type: EventType;
  initial?: DigestionEvent;
  onSaved: () => void;
};

function guessMealType(d = new Date()): MealType {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 10.5) return "breakfast";
  if (h >= 11 && h < 14.5) return "lunch";
  if (h >= 17 && h < 21.5) return "dinner";
  return "snack";
}

const DURATION_PRESETS = [5, 15, 30, 60, 120, 240];

export function EventForm({ type, initial, onSaved }: Props) {
  const save = useSaveEvent(initial?.id);
  const { data: events } = useEvents();

  const [occurredAt, setOccurredAt] = useState(() =>
    initial ? new Date(initial.occurredAt) : new Date(),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Meal
  const [mealType, setMealType] = useState<MealType>(
    initial?.type === "meal" ? initial.mealType : guessMealType(),
  );
  const [ingredients, setIngredients] = useState<string[]>(
    initial?.type === "meal" ? initial.ingredients : [],
  );

  // Bowel movement
  const [bristolType, setBristolType] = useState<number | null>(
    initial?.type === "bowel_movement" ? initial.bristolType : null,
  );

  // Discomfort
  const [subtypes, setSubtypes] = useState<DiscomfortSubtype[]>(
    initial?.type === "discomfort" ? initial.subtypes : [],
  );
  const [severity, setSeverity] = useState<number | null>(
    initial?.type === "discomfort" ? initial.severity : null,
  );
  const [durationMin, setDurationMin] = useState<string>(
    initial?.type === "discomfort" ? String(initial.durationMin) : "",
  );

  const [error, setError] = useState<string | null>(null);

  // Autocomplete suggestions: past ingredients, most frequently used first
  const ingredientSuggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events ?? []) {
      if (e.type === "meal") for (const i of e.ingredients) counts.set(i, (counts.get(i) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [events]);

  function buildInput(): EventInput | string {
    if (Number.isNaN(occurredAt.getTime())) return "Please set a time";
    const base = {
      occurredAt: occurredAt.toISOString(),
      timezone: initial?.timezone ?? deviceTimezone(),
      notes: notes.trim(),
    };
    switch (type) {
      case "meal":
        if (!ingredients.length && !base.notes) return "Describe the meal or add some ingredients";
        return { type, ...base, mealType, ingredients };
      case "bowel_movement":
        if (bristolType == null) return "Pick a stool type";
        return { type, ...base, bristolType };
      case "discomfort": {
        if (!subtypes.length) return "Pick at least one type of discomfort";
        if (severity == null) return "Pick a severity";
        const d = Number(durationMin);
        if (durationMin === "" || !Number.isFinite(d) || d < 0) return "Enter a duration in minutes";
        return { type, ...base, subtypes, severity, durationMin: Math.round(d) };
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = buildInput();
    if (typeof input === "string") return setError(input);
    try {
      await save.mutateAsync(input);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Field label="When">
        <DateTimePicker value={occurredAt} onChange={setOccurredAt} />
      </Field>

      {type === "meal" && (
        <>
          <Field label="Meal">
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((m) => (
                <Chip key={m} selected={mealType === m} onClick={() => setMealType(m)}>
                  {capitalize(m)}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="What did you eat?" hint="Describe it however you like">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Chicken burrito bowl with rice, beans, salsa"
              className="input"
            />
          </Field>
          <Field label="Ingredients" hint="Optional – helps spot patterns later">
            <TagInput
              value={ingredients}
              onChange={setIngredients}
              suggestions={ingredientSuggestions}
              placeholder="e.g. dairy, garlic, wheat"
            />
          </Field>
        </>
      )}

      {type === "bowel_movement" && (
        <>
          <Field label="Stool type (Bristol scale)">
            <div className="space-y-2">
              {Object.entries(BRISTOL_SCALE).map(([k, v]) => {
                const n = Number(k);
                const selected = bristolType === n;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBristolType(n)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                      selected
                        ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                        : "border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold text-white"
                      style={{ backgroundColor: bristolColor(n) }}
                    >
                      {n}
                    </span>
                    <span className="text-sm">{v.description}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          <NotesField value={notes} onChange={setNotes} placeholder="Color, urgency, straining…" />
        </>
      )}

      {type === "discomfort" && (
        <>
          <Field label="Type" hint="Select all that apply">
            <div className="flex flex-wrap gap-2">
              {DISCOMFORT_SUBTYPES.map((s) => (
                <Chip
                  key={s}
                  selected={subtypes.includes(s)}
                  onClick={() =>
                    setSubtypes((cur) =>
                      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
                    )
                  }
                >
                  {capitalize(s)}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Severity" hint="1 = barely noticeable, 10 = worst imaginable">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeverity(n)}
                  className={`rounded-lg border py-3 font-semibold transition ${
                    severity === n
                      ? "border-transparent text-white"
                      : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                  style={severity === n ? { backgroundColor: severityColor(n) } : undefined}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Duration (minutes)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className="input"
              placeholder="e.g. 30"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((d) => (
                <Chip
                  key={d}
                  selected={Number(durationMin) === d && durationMin !== ""}
                  onClick={() => setDurationMin(String(d))}
                >
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </Chip>
              ))}
            </div>
          </Field>
          <NotesField
            value={notes}
            onChange={setNotes}
            placeholder="Where was it? What did it feel like?"
          />
        </>
      )}

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={save.isPending}
        className="w-full rounded-xl bg-teal-700 py-4 text-lg font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
      >
        {save.isPending ? "Saving…" : initial ? "Save changes" : "Save"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <div className="font-medium text-stone-800">{label}</div>
        {hint && <div className="text-xs text-stone-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function NotesField(props: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Field label="Notes" hint="Optional">
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={3}
        placeholder={props.placeholder}
        className="input"
      />
    </Field>
  );
}

function Chip(props: { selected?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        props.selected
          ? "border-teal-700 bg-teal-700 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
      }`}
    >
      {props.children}
    </button>
  );
}
