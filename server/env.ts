function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseServiceAccount(raw: string): { client_email: string; private_key: string } {
  let text = raw.trim();
  if (!text.startsWith("{")) {
    // Assume base64-encoded JSON
    text = Buffer.from(text, "base64").toString("utf8");
  }
  const parsed = JSON.parse(text);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must contain client_email and private_key");
  }
  return parsed;
}

export const env = {
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 3001),
  appPassword: required("APP_PASSWORD"),
  sessionSecret: required("SESSION_SECRET"),
  sheetId: required("GOOGLE_SHEET_ID"),
  sheetTab: process.env.GOOGLE_SHEET_TAB?.trim() || "Events",
  serviceAccount: parseServiceAccount(required("GOOGLE_SERVICE_ACCOUNT_JSON")),
};

if (env.sessionSecret.length < 16) {
  throw new Error("SESSION_SECRET should be at least 16 characters (try `openssl rand -hex 32`)");
}
