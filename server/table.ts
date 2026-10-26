import { auth, sheets, type sheets_v4 } from "@googleapis/sheets";
import { env } from "./env";

/**
 * A tiny "table" abstraction over one tab of the spreadsheet.
 *
 * - Row 1 is the header. Columns are matched by header name, so reordering
 *   columns (or adding your own extra columns) in the sheet is safe.
 * - Missing columns are appended to the header automatically, so adding a new
 *   field in code just adds a new column at the end of the sheet.
 */

const client: sheets_v4.Sheets = sheets({
  version: "v4",
  auth: new auth.GoogleAuth({
    credentials: env.serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  }),
});

type Cell = string | number;
export type RowRecord = Record<string, string>;

export type TableConfig<T extends { id: string }> = {
  tab: string;
  columns: readonly string[];
  toRow: (item: T) => Record<string, Cell>;
  /** Return null to skip malformed rows (e.g. hand-edited garbage) */
  fromRow: (row: RowRecord) => T | null;
};

type Indexed<T> = { item: T; rowNumber: number; raw: Cell[] };

const CACHE_TTL_MS = 15_000;

function colLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

// Serialize all writes (across tables) so row numbers can't shift between lookup and write.
let writeChain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

export function createTable<T extends { id: string }>(config: TableConfig<T>) {
  const range = `'${config.tab.replace(/'/g, "''")}'`;
  let setup: Promise<number> | null = null;
  let header: string[] = [];
  let cache: { at: number; rows: Indexed<T>[] } | null = null;

  /** Ensures the tab exists and the header has all our columns. Returns the numeric sheetId. */
  function ensure(): Promise<number> {
    setup ??= (async () => {
      const meta = await client.spreadsheets.get({
        spreadsheetId: env.sheetId,
        fields: "sheets.properties",
      });
      let sheetId = meta.data.sheets?.find((s) => s.properties?.title === config.tab)?.properties
        ?.sheetId;
      if (sheetId == null) {
        const res = await client.spreadsheets.batchUpdate({
          spreadsheetId: env.sheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: config.tab, gridProperties: { frozenRowCount: 1 } },
                },
              },
            ],
          },
        });
        sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
        if (sheetId == null) throw new Error(`Failed to create tab ${config.tab}`);
      }

      const res = await client.spreadsheets.values.get({
        spreadsheetId: env.sheetId,
        range: `${range}!1:1`,
      });
      const existing = (res.data.values?.[0] ?? []).map((h) => String(h).trim());
      // Drop trailing blanks so new columns go right after the last real one
      while (existing.length && !existing[existing.length - 1]) existing.pop();
      const missing = config.columns.filter((c) => !existing.includes(c));
      if (missing.length) {
        const full = [...existing, ...missing];
        await client.spreadsheets.values.update({
          spreadsheetId: env.sheetId,
          range: `${range}!A1:${colLetter(full.length - 1)}1`,
          valueInputOption: "RAW",
          requestBody: { values: [full] },
        });
        header = full;
      } else {
        header = existing;
      }
      return sheetId;
    })().catch((err) => {
      setup = null; // retry next time
      throw err;
    });
    return setup;
  }

  async function readAll(fresh = false): Promise<Indexed<T>[]> {
    if (!fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
    await ensure();
    const res = await client.spreadsheets.values.get({
      spreadsheetId: env.sheetId,
      range,
    });
    const [headerRow = [], ...dataRows] = res.data.values ?? [];
    header = headerRow.map((h) => String(h).trim());
    const rows: Indexed<T>[] = [];
    dataRows.forEach((raw, i) => {
      const record: RowRecord = {};
      header.forEach((h, j) => {
        if (h) record[h] = String(raw[j] ?? "").trim();
      });
      const item = config.fromRow(record);
      if (item) rows.push({ item, rowNumber: i + 2, raw: raw as Cell[] });
    });
    cache = { at: Date.now(), rows };
    return rows;
  }

  /** Builds a full row in header order, keeping values of columns we don't manage */
  function buildRow(item: T, base: Cell[] = []): Cell[] {
    const values = config.toRow(item);
    return header.map((h, i) => (h in values ? values[h] : (base[i] ?? "")));
  }

  const lastCol = () => colLetter(Math.max(header.length, 1) - 1);

  return {
    async list(): Promise<T[]> {
      return (await readAll()).map((r) => r.item);
    },

    async get(id: string): Promise<T | null> {
      return (await readAll()).find((r) => r.item.id === id)?.item ?? null;
    },

    create(item: T): Promise<T> {
      return serialized(async () => {
        await readAll(true); // refresh header
        await client.spreadsheets.values.append({
          spreadsheetId: env.sheetId,
          range: `${range}!A:${lastCol()}`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [buildRow(item)] },
        });
        cache = null;
        return item;
      });
    },

    /** `fn` receives the existing item and returns the replacement */
    update(id: string, fn: (existing: T) => T): Promise<T | null> {
      return serialized(async () => {
        const rows = await readAll(true);
        const existing = rows.find((r) => r.item.id === id);
        if (!existing) return null;
        const next = fn(existing.item);
        await client.spreadsheets.values.update({
          spreadsheetId: env.sheetId,
          range: `${range}!A${existing.rowNumber}:${lastCol()}${existing.rowNumber}`,
          valueInputOption: "RAW",
          requestBody: { values: [buildRow(next, existing.raw)] },
        });
        cache = null;
        return next;
      });
    },

    remove(id: string): Promise<boolean> {
      return serialized(async () => {
        const sheetId = await ensure();
        const rows = await readAll(true);
        const existing = rows.find((r) => r.item.id === id);
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
        cache = null;
        return true;
      });
    },
  };
}
