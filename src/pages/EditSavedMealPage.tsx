import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MEAL_TYPES, savedMealInput, type MealType, type SavedMeal } from "../../shared/schema";
import { useDeleteSavedMeal, useSavedMeals, useSaveSavedMeal } from "../api";
import { TagInput } from "../components/TagInput";
import { Chip, ErrorMessage, Field, PrimaryButton } from "../components/ui";
import { capitalize } from "../lib/eventMeta";
import { useIngredientSuggestions } from "../lib/meals";

const route = getRouteApi("/authed/saved-meals/$savedMealId");

export function EditSavedMealPage() {
  const { savedMealId } = route.useParams();
  const isNew = savedMealId === "new";
  const { data: meals, isLoading } = useSavedMeals();
  const meal = meals?.find((m) => m.id === savedMealId);

  if (!isNew && isLoading) return <p className="py-8 text-center text-stone-500">Loading…</p>;
  if (!isNew && !meal) {
    return (
      <div className="py-8 text-center text-stone-500">
        Not found.{" "}
        <Link to="/saved-meals" className="text-teal-700 underline">
          Back
        </Link>
      </div>
    );
  }
  return <SavedMealForm key={meal?.id ?? "new"} initial={meal} />;
}

function SavedMealForm({ initial }: { initial?: SavedMeal }) {
  const navigate = useNavigate();
  const save = useSaveSavedMeal();
  const del = useDeleteSavedMeal();
  const suggestions = useIngredientSuggestions();

  const [name, setName] = useState(initial?.name ?? "");
  const [mealType, setMealType] = useState<MealType>(initial?.mealType ?? "breakfast");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [ingredients, setIngredients] = useState<string[]>(initial?.ingredients ?? []);
  const [error, setError] = useState<string | null>(null);

  const back = () => navigate({ to: "/saved-meals" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = savedMealInput.safeParse({ name, mealType, description, ingredients });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid");
    if (!parsed.data.description && !parsed.data.ingredients.length) {
      return setError("Add a description or ingredients");
    }
    try {
      await save.mutateAsync({ id: initial?.id, input: parsed.data });
      back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    }
  }

  async function onDelete() {
    if (!initial || !confirm(`Delete “${initial.name}”?`)) return;
    try {
      await del.mutateAsync(initial.id);
      back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">
        ⭐ {initial ? "Edit saved meal" : "New saved meal"}
      </h1>
      <form onSubmit={submit} className="space-y-6">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Usual breakfast"
            className="input"
          />
        </Field>
        <Field label="Meal">
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((m) => (
              <Chip key={m} selected={mealType === m} onClick={() => setMealType(m)}>
                {capitalize(m)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Oatmeal with banana"
            className="input"
          />
        </Field>
        <Field label="Ingredients">
          <TagInput
            value={ingredients}
            onChange={setIngredients}
            suggestions={suggestions}
            placeholder="e.g. oats, banana"
          />
        </Field>

        <ErrorMessage>{error}</ErrorMessage>
        <PrimaryButton pending={save.isPending}>{initial ? "Save changes" : "Save"}</PrimaryButton>
      </form>

      {initial && (
        <button
          onClick={onDelete}
          disabled={del.isPending}
          className="mt-4 w-full rounded-xl border border-red-200 py-3 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {del.isPending ? "Deleting…" : "Delete"}
        </button>
      )}
    </div>
  );
}
