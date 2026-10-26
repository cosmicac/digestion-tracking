import { z } from "zod";

export const EVENT_TYPES = ["meal", "bowel_movement", "discomfort"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meal: "Meal",
  bowel_movement: "Bowel movement",
  discomfort: "Stomach discomfort",
};

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "drink", "other"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const DISCOMFORT_SUBTYPES = [
  "pain",
  "cramping",
  "bloating",
  "gas",
  "nausea",
  "heartburn",
  "other",
] as const;
export type DiscomfortSubtype = (typeof DISCOMFORT_SUBTYPES)[number];

export const BRISTOL_SCALE: Record<number, { label: string; description: string }> = {
  1: { label: "Type 1", description: "Separate hard lumps (severe constipation)" },
  2: { label: "Type 2", description: "Lumpy and sausage-like (mild constipation)" },
  3: { label: "Type 3", description: "Sausage with cracks on surface (normal)" },
  4: { label: "Type 4", description: "Smooth, soft sausage or snake (ideal)" },
  5: { label: "Type 5", description: "Soft blobs with clear-cut edges (lacking fiber)" },
  6: { label: "Type 6", description: "Mushy, fluffy pieces with ragged edges (mild diarrhea)" },
  7: { label: "Type 7", description: "Watery, no solid pieces (severe diarrhea)" },
};

const base = {
  /** ISO 8601 timestamp (UTC) of when the event happened */
  occurredAt: z.iso.datetime({ offset: true }),
  /** IANA timezone of the device that logged it, e.g. America/Los_Angeles */
  timezone: z.string().min(1).max(64),
  notes: z.string().max(5000).default(""),
};

const ingredientList = z
  .array(z.string().trim().toLowerCase().min(1).max(100).regex(/^[^,]+$/, "No commas in ingredients"))
  .max(100)
  .default([]);

export const mealInput = z.object({
  type: z.literal("meal"),
  ...base,
  mealType: z.enum(MEAL_TYPES),
  ingredients: ingredientList,
  /** Set when the meal was logged from a saved meal */
  savedMealId: z.string().max(64).optional(),
});

export const bowelMovementInput = z.object({
  type: z.literal("bowel_movement"),
  ...base,
  bristolType: z.number().int().min(1).max(7),
});

export const discomfortInput = z.object({
  type: z.literal("discomfort"),
  ...base,
  subtypes: z.array(z.enum(DISCOMFORT_SUBTYPES)).min(1, "Pick at least one type"),
  severity: z.number().int().min(1).max(10),
  durationMin: z.number().int().min(0).max(60 * 24 * 7),
});

export const eventInput = z.discriminatedUnion("type", [
  mealInput,
  bowelMovementInput,
  discomfortInput,
]);
export type EventInput = z.infer<typeof eventInput>;

export type EventMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type MealEvent = z.infer<typeof mealInput> & EventMeta;
export type BowelMovementEvent = z.infer<typeof bowelMovementInput> & EventMeta;
export type DiscomfortEvent = z.infer<typeof discomfortInput> & EventMeta;
export type DigestionEvent = MealEvent | BowelMovementEvent | DiscomfortEvent;

// --- Saved meals (templates for meals eaten often) -------------------------

export const savedMealInput = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  mealType: z.enum(MEAL_TYPES),
  description: z.string().trim().max(5000).default(""),
  ingredients: ingredientList,
});
export type SavedMealInput = z.infer<typeof savedMealInput>;
export type SavedMeal = SavedMealInput & EventMeta;
