import { randomUUID } from "node:crypto";
import {
  DISCOMFORT_SUBTYPES,
  MEAL_TYPES,
  type DigestionEvent,
  type DiscomfortSubtype,
  type EventInput,
  type MealType,
  type SavedMeal,
  type SavedMealInput,
} from "../shared/schema";
import { env } from "./env";
import { createTable, type RowRecord } from "./table";

// --- Helpers -----------------------------------------------------------------

function formatLocal(iso: string, timeZone: string): string {
  try {
    // sv-SE gives "YYYY-MM-DD HH:mm", which sorts and reads nicely in Sheets
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const toMealType = (s: string): MealType =>
  MEAL_TYPES.includes(s as MealType) ? (s as MealType) : "other";

// --- Events ------------------------------------------------------------------

/**
 * All events live in a single tab, one row per event. Columns that don't
 * apply to an event type are left blank.
 */
const events = createTable<DigestionEvent>({
  tab: env.sheetTab,
  columns: [
    "id",
    "type",
    "occurred_at",
    "local_time",
    "timezone",
    "meal_type",
    "ingredients",
    "bristol_type",
    "discomfort_types",
    "severity",
    "duration_min",
    "notes",
    "created_at",
    "updated_at",
    "saved_meal_id",
  ],
  toRow: (e) => ({
    id: e.id,
    type: e.type,
    occurred_at: new Date(e.occurredAt).toISOString(),
    local_time: formatLocal(e.occurredAt, e.timezone),
    timezone: e.timezone,
    meal_type: e.type === "meal" ? e.mealType : "",
    ingredients: e.type === "meal" ? e.ingredients.join(", ") : "",
    saved_meal_id: e.type === "meal" ? (e.savedMealId ?? "") : "",
    bristol_type: e.type === "bowel_movement" ? e.bristolType : "",
    discomfort_types: e.type === "discomfort" ? e.subtypes.join(", ") : "",
    severity: e.type === "discomfort" ? e.severity : "",
    duration_min: e.type === "discomfort" ? e.durationMin : "",
    notes: e.notes ?? "",
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  }),
  fromRow: (r: RowRecord): DigestionEvent | null => {
    const { id, type, occurred_at: occurredAt } = r;
    if (!id || !occurredAt || Number.isNaN(Date.parse(occurredAt))) return null;
    const common = {
      id,
      occurredAt,
      timezone: r.timezone || "America/Los_Angeles",
      notes: r.notes ?? "",
      createdAt: r.created_at ?? "",
      updatedAt: r.updated_at ?? "",
    };
    switch (type) {
      case "meal":
        return {
          ...common,
          type,
          mealType: toMealType(r.meal_type),
          ingredients: splitList(r.ingredients ?? ""),
          savedMealId: r.saved_meal_id || undefined,
        };
      case "bowel_movement": {
        const bristolType = Number(r.bristol_type);
        if (!(bristolType >= 1 && bristolType <= 7)) return null;
        return { ...common, type, bristolType };
      }
      case "discomfort": {
        const subtypes = splitList(r.discomfort_types ?? "").filter((s): s is DiscomfortSubtype =>
          (DISCOMFORT_SUBTYPES as readonly string[]).includes(s),
        );
        return {
          ...common,
          type,
          subtypes: subtypes.length ? subtypes : ["other"],
          severity: Number(r.severity) || 0,
          durationMin: Number(r.duration_min) || 0,
        };
      }
      default:
        return null;
    }
  },
});

export async function listEvents(): Promise<DigestionEvent[]> {
  return (await events.list()).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export const getEvent = (id: string) => events.get(id);

export function createEvent(input: EventInput): Promise<DigestionEvent> {
  const now = new Date().toISOString();
  return events.create({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
}

export function updateEvent(id: string, input: EventInput): Promise<DigestionEvent | null> {
  return events.update(id, (existing) => ({
    ...input,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  }));
}

export const deleteEvent = (id: string) => events.remove(id);

// --- Saved meals -------------------------------------------------------------

const savedMeals = createTable<SavedMeal>({
  tab: "SavedMeals",
  columns: ["id", "name", "meal_type", "description", "ingredients", "created_at", "updated_at"],
  toRow: (m) => ({
    id: m.id,
    name: m.name,
    meal_type: m.mealType,
    description: m.description,
    ingredients: m.ingredients.join(", "),
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  }),
  fromRow: (r) => {
    if (!r.id || !r.name) return null;
    return {
      id: r.id,
      name: r.name,
      mealType: toMealType(r.meal_type),
      description: r.description ?? "",
      ingredients: splitList(r.ingredients ?? ""),
      createdAt: r.created_at ?? "",
      updatedAt: r.updated_at ?? "",
    };
  },
});

export async function listSavedMeals(): Promise<SavedMeal[]> {
  return (await savedMeals.list()).sort((a, b) => a.name.localeCompare(b.name));
}

export function createSavedMeal(input: SavedMealInput): Promise<SavedMeal> {
  const now = new Date().toISOString();
  return savedMeals.create({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
}

export function updateSavedMeal(id: string, input: SavedMealInput): Promise<SavedMeal | null> {
  return savedMeals.update(id, (existing) => ({
    ...input,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  }));
}

export const deleteSavedMeal = (id: string) => savedMeals.remove(id);
