import type { SavedMeal } from "../../shared/schema";

export type SavedMealAction =
  | { kind: "none" }
  | { kind: "create"; name: string }
  | { kind: "update"; meal: SavedMeal };

type Props = {
  /** The saved meal this event is based on (if any, and if it still exists) */
  baseMeal?: SavedMeal;
  /** Whether the form values differ from baseMeal */
  changed: boolean;
  action: SavedMealAction;
  onChange: (a: SavedMealAction) => void;
  defaultName: string;
};

/**
 * Sits just above the Save button on the meal form:
 * - not based on a saved meal → "Also save as a saved meal" (+ name)
 * - based on one and edited   → "Update <name> with these changes"
 * - based on one, unchanged   → nothing
 */
export function SaveAsSavedMeal({ baseMeal, changed, action, onChange, defaultName }: Props) {
  if (baseMeal && !changed) return null;

  if (baseMeal) {
    const checked = action.kind === "update";
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) =>
            onChange(e.target.checked ? { kind: "update", meal: baseMeal } : { kind: "none" })
          }
          className="mt-0.5 h-5 w-5 accent-teal-700"
        />
        <span className="text-sm">
          <span className="font-medium text-stone-800">
            Update “{baseMeal.name}” with these changes
          </span>
          <span className="block text-xs text-stone-500">
            Leave unchecked if this was a one-off change.
          </span>
        </span>
      </label>
    );
  }

  const checked = action.kind === "create";
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) =>
            onChange(e.target.checked ? { kind: "create", name: defaultName } : { kind: "none" })
          }
          className="mt-0.5 h-5 w-5 accent-teal-700"
        />
        <span className="text-sm">
          <span className="font-medium text-stone-800">⭐ Also save as a saved meal</span>
          <span className="block text-xs text-stone-500">
            Eat this often? Reuse it with one tap next time.
          </span>
        </span>
      </label>
      {action.kind === "create" && (
        <input
          value={action.name}
          onChange={(e) => onChange({ kind: "create", name: e.target.value })}
          placeholder="Name, e.g. Usual breakfast"
          className="input mt-3"
          aria-label="Saved meal name"
        />
      )}
    </div>
  );
}
