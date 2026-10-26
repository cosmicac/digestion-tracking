import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { SavedMeal, SavedMealInput } from "../../shared/schema";
import { useSaveSavedMeal } from "../api";
import { capitalize } from "../lib/eventMeta";
import { useSortedSavedMeals } from "../lib/meals";
import { Chip } from "./ui";

type Props = {
  selectedId?: string;
  onPick: (meal: SavedMeal) => void;
  /** Current form values, used by "Save as saved meal" */
  current: Omit<SavedMealInput, "name">;
  onCreated: (meal: SavedMeal) => void;
};

export function SavedMealPicker({ selectedId, onPick, current, onCreated }: Props) {
  const meals = useSortedSavedMeals();
  const save = useSaveSavedMeal();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSave = current.description.trim() !== "" || current.ingredients.length > 0;

  function startNaming() {
    setName(current.mealType === "other" ? "" : `Usual ${current.mealType}`);
    setError(null);
    setNaming(true);
  }

  async function create() {
    if (!name.trim()) return setError("Give it a name");
    try {
      const meal = await save.mutateAsync({ input: { ...current, name: name.trim() } });
      onCreated(meal);
      setNaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-amber-900">⭐ Saved meals</span>
        <Link to="/saved-meals" className="text-xs font-medium text-teal-700">
          Manage
        </Link>
      </div>

      {meals.length === 0 && !naming && (
        <p className="mb-2 text-xs text-stone-600">
          Eat the same thing often? Fill in the meal below, then save it here to reuse with one tap.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {meals.map((m) => (
          <Chip key={m.id} selected={selectedId === m.id} onClick={() => onPick(m)}>
            {m.name}
            <span className={selectedId === m.id ? "text-teal-100" : "text-stone-400"}>
              {" "}
              · {capitalize(m.mealType)}
            </span>
          </Chip>
        ))}
        {!naming && (
          <button
            type="button"
            onClick={startNaming}
            disabled={!canSave}
            className="rounded-full border border-dashed border-stone-400 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-white disabled:opacity-40"
            title={canSave ? undefined : "Fill in the meal first"}
          >
            + Save this meal
          </button>
        )}
      </div>

      {naming && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // don't submit the outer event form
                  create();
                }
              }}
              placeholder="Name, e.g. Usual breakfast"
              className="input flex-1"
              autoFocus
            />
            <button
              type="button"
              onClick={create}
              disabled={save.isPending}
              className="rounded-lg bg-teal-700 px-4 font-semibold text-white disabled:opacity-60"
            >
              {save.isPending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setNaming(false)}
              className="px-2 text-sm text-stone-500"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-stone-500">
            Saves the meal type, description and ingredients currently filled in below.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
