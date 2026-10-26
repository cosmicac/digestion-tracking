import { randomUUID } from "node:crypto";
import { auth, sheets, type sheets_v4 } from "@googleapis/sheets";
import {
  DISCOMFORT_SUBTYPES,
  MEAL_TYPES,
  type DigestionEvent,
  type DiscomfortSubtype,
  type EventInput,
  type MealType,
} from "../shared/schema";
import { env } from "./env";

/**
 * All events live in a single tab, one row per event. Columns that don't
 * apply to an event type are left blank.
 */
const COLUMNS = [
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
] as const;
type Column = (typeof COLUMNS)[number];

const LAST_COL = String.fromCharCode("A".charCodeAt(0) + COLUMNS.length - 1);
const tab = `'${env.sheetTab.replace(/'/g, "''")}'`;

const client: sheets_v4.Sheets = sheets({
  version: "v4",
  auth: new auth.GoogleAuth({
    credentials: env.serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  }),
});

// --- Setup -----------------------------------------------------------------

let tabIdPromise: Promise<number> | null = null;

/** Ensures the tab + header row exist. Returns the numeric sheetId of the tab. */
function ensureTab(): Promise<number> {
  tabIdPromise ??= (async () => {
    const meta = await client.spreadsheets.get({
      spreadsheetId: env.sheetId,
      fields: "sheets.properties",
    });
    let sheetId = meta.data.sheets?.find((s) => s.properties?.title === env.sheetTab)?.properties
      ?.sheetId;

    if (sheetId == null) {
      const res = await client.spreadsheets.batchUpdate({
        spreadsheetId: env.sheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: env.sheetTab, gridProperties: { frozenRowCount: 1 } },
              },
            },
          ],
        },
      });
      sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
      if (sheetId == null) throw new Error("Failed to create sheet tab");
    }

    const header = await client.spreadsheets.values.get({
      spreadsheetId: env.sheetId,
      range: `${tab}!A1:${LAST_COL}1`,
    });
    if (!header.data.values?.[0]?.length) {
      await client.spreadsheets.values.update({
        spreadsheetId: env.sheetId,
        range: `${tab}!A1:${LAST_COL}1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...COLUMNS]] },
      });
    }
    return sheetId;
  })().catch((err) => {
    tabIdPromise = null; // retry next time
    throw err;
  });
  return tabIdPromise;
}

// --- Row <-> event conversion ---------------------------------------------

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

function toRow(e: DigestionEvent): (string | number)[] {
  const r: Record<Column, string | number> = {
    id: e.id,
    type: e.type,
    occurred_at: new Date(e.occurredAt).toISOString(),
    local_time: formatLocal(e.occurredAt, e.timezone),
    timezone: e.timezone,
    meal_type: "",
    ingredients: "",
    bristol_type: "",
    discomfort_types: "",
    severity: "",
    duration_min: "",
    notes: e.notes ?? "",
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
  if (e.type === "meal") {
    r.meal_type = e.mealType;
    r.ingredients = e.ingredients.join(", ");
  } else if (e.type === "bowel_movement") {
    r.bristol_type = e.bristolType;
  } else {
    r.discomfort_types = e.subtypes.join(", ");
    r.severity = e.severity;
    r.duration_min = e.durationMin;
  }
  return COLUMNS.map((c) => r[c]);
}

const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function fromRow(row: unknown[]): DigestionEvent | null {
  const get = (c: Column) => String(row[COLUMNS.indexOf(c)] ?? "").trim();
  const id = get("id");
  const type = get("type");
  const occurredAt = get("occurred_at");
  if (!id || !occurredAt || Number.isNaN(Date.parse(occurredAt))) return null;

  const common = {
    id,
    occurredAt,
    timezone: get("timezone") || "America/Los_Angeles",
    notes: get("notes"),
    createdAt: get("created_at"),
    updatedAt: get("updated_at"),
  };

  switch (type) {
    case "meal": {
      const mealType = get("meal_type") as MealType;
      return {
        ...common,
        type,
        mealType: MEAL_TYPES.includes(mealType) ? mealType : "other",
        ingredients: splitList(get("ingredients")),
      };
    }
    case "bowel_movement": {
      const bristolType = Number(get("bristol_type"));
      if (!(bristolType >= 1 && bristolType <= 7)) return null;
      return { ...common, type, bristolType };
    }
    case "discomfort": {
      const subtypes = splitList(get("discomfort_types")).filter((s): s is DiscomfortSubtype =>
        (DISCOMFORT_SUBTYPES as readonly string[]).includes(s),
      );
      return {
        ...common,
        type,
        subtypes: subtypes.length ? subtypes : ["other"],
        severity: Number(get("severity")) || 0,
        durationMin: Number(get("duration_min")) || 0,
      };
    }
    default:
      return null;
  }
}

// --- Reads (with a short cache) -------------------------------------------

type Indexed = { event: DigestionEvent; rowNumber: number };
const CACHE_TTL_MS = 15_000;
let cache: { at: number; rows: Indexed[] } | null = null;

async function readAll(fresh = false): Promise<Indexed[]> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  await ensureTab();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: env.sheetId,
    range: `${tab}!A2:${LAST_COL}`,
  });
  const rows: Indexed[] = [];
  (res.data.values ?? []).forEach((row, i) => {
    const event = fromRow(row);
    if (event) rows.push({ event, rowNumber: i + 2 });
  });
  cache = { at: Date.now(), rows };
  return rows;
}

const invalidate = () => {
  cache = null;
};

export async function listEvents(): Promise<DigestionEvent[]> {
  const rows = await readAll();
  return rows
    .map((r) => r.event)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function getEvent(id: string): Promise<DigestionEvent | null> {
  const rows = await readAll();
  return rows.find((r) => r.event.id === id)?.event ?? null;
}

// --- Writes ----------------------------------------------------------------

// Serialize writes so row numbers can't shift between lookup and write.
let writeChain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

export function createEvent(input: EventInput): Promise<DigestionEvent> {
  return serialized(async () => {
    await ensureTab();
    const now = new Date().toISOString();
    const event = { ...input, id: randomUUID(), createdAt: now, updatedAt: now } as DigestionEvent;
    await client.spreadsheets.values.append({
      spreadsheetId: env.sheetId,
      range: `${tab}!A:${LAST_COL}`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [toRow(event)] },
    });
    invalidate();
    return event;
  });
}

export function updateEvent(id: string, input: EventInput): Promise<DigestionEvent | null> {
  return serialized(async () => {
    const rows = await readAll(true);
    const existing = rows.find((r) => r.event.id === id);
    if (!existing) return null;
    const event = {
      ...input,
      id,
      createdAt: existing.event.createdAt,
      updatedAt: new Date().toISOString(),
    } as DigestionEvent;
    await client.spreadsheets.values.update({
      spreadsheetId: env.sheetId,
      range: `${tab}!A${existing.rowNumber}:${LAST_COL}${existing.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [toRow(event)] },
    });
    invalidate();
    return event;
  });
}

export function deleteEvent(id: string): Promise<boolean> {
  return serialized(async () => {
    const sheetId = await ensureTab();
    const rows = await readAll(true);
    const existing = rows.find((r) => r.event.id === id);
    if (!existing) return false;
    await client.spreadsheets.batchUpdate({
      spreadsheetId: env.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: existing.rowNumber - 1,
                endIndex: existing.rowNumber,
              },
            },
          },
        ],
      },
    });
    invalidate();
    return true;
  });
}
