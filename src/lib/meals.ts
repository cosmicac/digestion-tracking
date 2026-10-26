import { useMemo } from "react";
import type { DigestionEvent, MealType, SavedMeal } from "../../shared/schema";
import { useEvents, useSavedMeals } from "../api";

export function guessMealType(d = new Date()): MealType {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 10.5) return "breakfast";
  if (h >= 11 && h < 14.5) return "lunch";
  if (h >= 17 && h < 21.5) return "dinner";
  return "snack";
}

/**
 * Saved meals ordered for "right now": ones matching the current time of day
 * first (breakfast in the morning), then most recently used, then by name.
 */
export function sortSavedMeals(
  meals: SavedMeal[],
  events: DigestionEvent[] | undefined,
  now = new Date(),
): SavedMeal[] {
  const lastUsed = new Map<string, number>();
  for (const e of events ?? []) {
    if (e.type === "meal" && e.savedMealId) {
      const t = Date.parse(e.occurredAt);
      if (t > (lastUsed.get(e.savedMealId) ?? 0)) lastUsed.set(e.savedMealId, t);
    }
  }
  const current = guessMealType(now);
  return [...meals].sort(
    (a, b) =>
      Number(b.mealType === current) - Number(a.mealType === current) ||
      (lastUsed.get(b.id) ?? 0) - (lastUsed.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name),
  );
}

export function useSortedSavedMeals() {
  const { data: savedMeals } = useSavedMeals();
  const { data: events } = useEvents();
  return useMemo(() => sortSavedMeals(savedMeals ?? [], events), [savedMeals, events]);
}

/** All ingredients seen in past meals and saved meals, most frequently used first */
export function useIngredientSuggestions() {
  const { data: events } = useEvents();
  const { data: savedMeals } = useSavedMeals();
  return useMemo(() => {
    const counts = new Map<string, number>();
    const add = (list: string[]) => {
      for (const i of list) counts.set(i, (counts.get(i) ?? 0) + 1);
    };
    for (const e of events ?? []) if (e.type === "meal") add(e.ingredients);
    for (const m of savedMeals ?? []) add(m.ingredients);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [events, savedMeals]);
}
