import { Link } from "@tanstack/react-router";
import { useSavedMeals } from "../api";
import { capitalize } from "../lib/eventMeta";

export function SavedMealsPage() {
  const { data: meals, isLoading, error } = useSavedMeals();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">⭐ Saved meals</h1>
        <Link
          to="/saved-meals/$savedMealId"
          params={{ savedMealId: "new" }}
          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
        >
          + New
        </Link>
      </div>
      <p className="text-sm text-stone-500">
        Meals you eat often. Log them with one tap from the home screen or the meal form.
        Editing a saved meal doesn't change meals already logged.
      </p>

      {isLoading && <p className="py-8 text-center text-stone-500">Loading…</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      {meals?.length === 0 && (
        <p className="py-8 text-center text-stone-500">No saved meals yet.</p>
      )}

      <ul className="space-y-2">
        {meals?.map((m) => (
          <li key={m.id}>
            <Link
              to="/saved-meals/$savedMealId"
              params={{ savedMealId: m.id }}
              className="block rounded-xl border border-stone-200 bg-white p-3 shadow-sm hover:bg-stone-50"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-amber-800">{m.name}</span>
                <span className="text-xs text-stone-500">{capitalize(m.mealType)}</span>
              </div>
              {m.description && (
                <div className="line-clamp-2 text-sm text-stone-600">{m.description}</div>
              )}
              {m.ingredients.length > 0 && (
                <div className="truncate text-sm text-stone-500">{m.ingredients.join(", ")}</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
