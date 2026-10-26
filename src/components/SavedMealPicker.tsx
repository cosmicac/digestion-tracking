import type { SavedMeal } from "../../shared/schema";
import { capitalize } from "../lib/eventMeta";
import { useSortedSavedMeals } from "../lib/meals";
import { Chip } from "./ui";

type Props = {
  selectedId?: string;
  onPick: (meal: SavedMeal) => void;
};

/** "Start from a saved meal" chips. Hidden entirely when there are no saved meals. */
export function SavedMealPicker({ selectedId, onPick }: Props) {
  const meals = useSortedSavedMeals();
  if (!meals.length) return null;

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-stone-600">⭐ Start from a saved meal</div>
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
      </div>
    </div>
  );
}
