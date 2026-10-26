import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { env } from "./env";

const COOKIE_NAME = "dt_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// Mixing the password into the signing key means changing APP_PASSWORD logs everyone out.
const signingKey = createHash("sha256")
  .update(`${env.sessionSecret}:${env.appPassword}`)
  .digest("hex");

export function checkPassword(candidate: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(env.appPassword).digest();
  return timingSafeEqual(a, b);
}

export async function startSession(c: Context) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await setSignedCookie(c, COOKIE_NAME, `v1.${expiresAt}`, signingKey, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "Lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function endSession(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export async function isAuthenticated(c: Context): Promise<boolean> {
  const value = await getSignedCookie(c, signingKey, COOKIE_NAME);
  if (!value) return false;
  const [version, exp] = value.split(".");
  if (version !== "v1") return false;
  const expiresAt = Number(exp);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!(await isAuthenticated(c))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};

// --- Very small in-memory login rate limiter -------------------------------
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function clientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

export function clearAttempts(ip: string) {
  attempts.delete(ip);
}
