import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { eventInput } from "../shared/schema";
import {
  checkPassword,
  clearAttempts,
  clientIp,
  endSession,
  isAuthenticated,
  rateLimited,
  recordFailedAttempt,
  requireAuth,
  startSession,
} from "./auth";
import { env } from "./env";
import { createEvent, deleteEvent, getEvent, listEvents, updateEvent } from "./sheets";

const app = new Hono();
app.use(secureHeaders());

// --- API ---------------------------------------------------------------------
const api = new Hono();

api.get("/health", (c) => c.json({ ok: true }));

api.get("/session", async (c) => c.json({ authenticated: await isAuthenticated(c) }));

api.post("/login", async (c) => {
  const ip = clientIp(c);
  if (rateLimited(ip)) {
    return c.json({ error: "Too many attempts. Try again in a few minutes." }, 429);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ password: z.string() }).safeParse(body);
  if (!parsed.success || !checkPassword(parsed.data.password)) {
    recordFailedAttempt(ip);
    return c.json({ error: "Incorrect password" }, 401);
  }
  clearAttempts(ip);
  await startSession(c);
  return c.json({ ok: true });
});

api.post("/logout", (c) => {
  endSession(c);
  return c.json({ ok: true });
});

api.use("/events/*", requireAuth);
api.use("/events", requireAuth);

api.get("/events", async (c) => c.json(await listEvents()));

api.get("/events/:id", async (c) => {
  const event = await getEvent(c.req.param("id"));
  return event ? c.json(event) : c.json({ error: "Not found" }, 404);
});

api.post("/events", async (c) => {
  const parsed = eventInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
  return c.json(await createEvent(parsed.data), 201);
});

api.put("/events/:id", async (c) => {
  const parsed = eventInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
  const event = await updateEvent(c.req.param("id"), parsed.data);
  return event ? c.json(event) : c.json({ error: "Not found" }, 404);
});

api.delete("/events/:id", async (c) => {
  const ok = await deleteEvent(c.req.param("id"));
  return ok ? c.json({ ok: true }) : c.json({ error: "Not found" }, 404);
});

api.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong talking to Google Sheets" }, 500);
});

app.route("/api", api);

// --- Static SPA (production) -------------------------------------------------
if (env.isProd) {
  const root = "./dist/client";
  const indexHtml = readFileSync(`${root}/index.html`, "utf8");
  app.use("/assets/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "public, max-age=31536000, immutable");
  });
  app.use("/*", serveStatic({ root }));
  app.get("*", (c) => c.html(indexHtml));
}

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
