import {
  BRISTOL_SCALE,
  EVENT_TYPE_LABELS,
  type DigestionEvent,
  type EventType,
} from "../../shared/schema";
import { formatDuration } from "./time";

export const EVENT_STYLE: Record<EventType, { emoji: string; color: string; bg: string }> = {
  meal: { emoji: "🍽️", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  bowel_movement: { emoji: "🚽", color: "text-sky-700", bg: "bg-sky-50 border-sky-200" },
  discomfort: { emoji: "😣", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
};

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function eventTitle(e: DigestionEvent): string {
  switch (e.type) {
    case "meal":
      return capitalize(e.mealType);
    case "bowel_movement":
      return `Bristol type ${e.bristolType}`;
    case "discomfort":
      return e.subtypes.map(capitalize).join(", ");
  }
}

export function eventSubtitle(e: DigestionEvent): string {
  switch (e.type) {
    case "meal":
      return e.ingredients.join(", ");
    case "bowel_movement":
      return BRISTOL_SCALE[e.bristolType]?.description ?? "";
    case "discomfort":
      return `Severity ${e.severity}/10 · ${formatDuration(e.durationMin)}`;
  }
}

export { EVENT_TYPE_LABELS };

/** Bristol colour: constipated → amber, normal → green, loose → red */
export function bristolColor(t: number): string {
  if (t <= 2) return "#d97706";
  if (t <= 4) return "#16a34a";
  if (t === 5) return "#ca8a04";
  return "#dc2626";
}

export function severityColor(s: number): string {
  if (s <= 3) return "#facc15";
  if (s <= 6) return "#f97316";
  return "#dc2626";
}
