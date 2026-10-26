# 🌿 Digestion Tracker

A small password-protected web app for logging meals, bowel movements and stomach discomfort. Data is stored in a Google Sheet.

**Stack:** Vite + React + TanStack Router + TanStack Query + Tailwind (frontend), Hono on Node (API), Google Sheets API (storage). Frontend and API run as one service.

## Event types

| Type | Fields |
| --- | --- |
| Meal | meal type (breakfast/lunch/dinner/snack/drink/other), free-text description, ingredient tags (autocomplete from earlier entries) |
| Bowel movement | Bristol Stool Scale type 1–7, notes |
| Stomach discomfort | subtypes (pain, cramping, bloating, gas, nausea, heartburn, other), severity 1–10, duration (minutes), notes |

Every event gets a time that defaults to now and can be changed. Entries can be edited or deleted in the app.

## Google Sheet format

All events go in one tab (default name `Events`). The app creates the tab and header row if they're missing:

```
id | type | occurred_at | local_time | timezone | meal_type | ingredients | bristol_type | discomfort_types | severity | duration_min | notes | created_at | updated_at
```

- `occurred_at` is in UTC (ISO 8601). `local_time` is the same moment in the device's timezone, so it's easy to read.
- List fields (`ingredients`, `discomfort_types`) are comma-separated.
- You can edit rows by hand in the sheet. Keep `id`, `type` and `occurred_at` valid, or the app will skip the row.

## Setup

### 1. Google service account

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create (or pick) a project.
2. Enable the **Google Sheets API** (APIs & Services → Library).
3. Go to IAM & Admin → Service Accounts → **Create service account**. No roles are needed.
4. Open the service account → Keys → Add key → **JSON**. A key file downloads.
5. Create your Google Sheet. Click **Share** and give the service account's `client_email` **Editor** access.
6. Copy the sheet ID from its URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.

### 2. Environment variables

See `.env.example`.

| Var | Description |
| --- | --- |
| `APP_PASSWORD` | Shared login password |
| `SESSION_SECRET` | Random string for signing cookies, e.g. `openssl rand -hex 32` |
| `GOOGLE_SHEET_ID` | Spreadsheet ID |
| `GOOGLE_SHEET_TAB` | Tab name (default `Events`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The key file's contents, as raw JSON or base64 (`base64 -i key.json \| tr -d '\n'`) |

Sessions last 7 days. Changing `APP_PASSWORD` or `SESSION_SECRET` logs everyone out.

### 3. Local development

```sh
cp .env.example .env   # then fill it in
npm install
npm run dev            # web on http://localhost:5173, API on :3001
```

### 4. Deploy to Railway

1. Create a new Railway project from this GitHub repo.
2. Add the environment variables above. Don't set `PORT`; Railway provides it.
3. Railway runs `npm run build` and `npm start` (see `railway.json`). The health check is `/api/health`.
4. Settings → Networking → **Generate domain**.
