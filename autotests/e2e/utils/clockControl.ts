import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";

/**
 * Helpers for the TTT test-clock endpoint (`/api/ttt/v1/test/clock`).
 *
 * Auth: API_SECRET_TOKEN header (same token the rest of the API fixtures use).
 *
 * Contract (see reference/api-tc1.spec.ts for the original read/write/reset
 * round-trip): the server accepts `{ time: "YYYY-MM-DDTHH:mm:ss" }` (local,
 * no timezone suffix) and returns the same shape in the response body.
 */

function clockBaseUrl(tttConfig: TttConfig): string {
  return tttConfig.buildUrl("/api/ttt/v1/test/clock");
}

function authHeaders(tttConfig: TttConfig): Record<string, string> {
  return { API_SECRET_TOKEN: tttConfig.apiToken };
}

/** Returns the server's current ISO-local time (e.g. `2026-04-21T10:15:32.1234`). */
export async function getServerClock(
  request: APIRequestContext,
  tttConfig: TttConfig,
): Promise<string> {
  const resp = await request.get(clockBaseUrl(tttConfig), {
    headers: authHeaders(tttConfig),
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  return String(body.time);
}

/** Patches the server clock to the given ISO-local time. Returns the server's echoed time. */
export async function patchServerClock(
  request: APIRequestContext,
  tttConfig: TttConfig,
  isoLocal: string,
): Promise<string> {
  const resp = await request.patch(clockBaseUrl(tttConfig), {
    headers: { ...authHeaders(tttConfig), "Content-Type": "application/json" },
    data: { time: isoLocal },
  });
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  return String(body.time);
}

/** Resets the server clock back to real wall time. Idempotent. */
export async function resetServerClock(
  request: APIRequestContext,
  tttConfig: TttConfig,
): Promise<void> {
  const resp = await request.post(`${clockBaseUrl(tttConfig)}/reset`, {
    headers: authHeaders(tttConfig),
  });
  expect(resp.status()).toBe(200);
}

/**
 * Builds an ISO-local time string for "next Monday at 07:59:55" given the
 * server's current time. Used to position the clock 5 s before the 08:00
 * digest fire on Monday — the vacation-digest code path
 * (`DigestServiceImpl.addSoonVacationEvents`) is gated on
 * `today.getDayOfWeek() == MONDAY`, so any other weekday makes the digest a
 * no-op for vacation events even though the @Scheduled wrapper runs daily.
 *
 * If the server day already is Monday, the SAME-DAY 07:59:55 is returned —
 * the scheduler will fire within seconds. Otherwise the date is advanced to
 * the next calendar Monday at 07:59:55.
 *
 * The server interprets the ISO string as its local wall time; we keep the
 * date portion's calendar arithmetic in UTC for simplicity (the server's
 * default zone is configured separately and the digest cron uses
 * `TimeUtils.DEFAULT_ZONE_NAME`).
 */
export function fireSoonIso(serverTime: string): string {
  const date = parseServerLocalDate(serverTime);
  const monday = nextMondayInclusive(date);
  return `${formatLocalDate(monday)}T07:59:55`;
}

/**
 * Returns the next Monday on or after `serverTime`'s calendar day, formatted
 * as an ISO local date (YYYY-MM-DD). Useful for the data layer to align the
 * seeded vacation start with the patched digest day.
 */
export function nextMondayDateIso(serverTime: string): string {
  const date = parseServerLocalDate(serverTime);
  const monday = nextMondayInclusive(date);
  return formatLocalDate(monday);
}

function parseServerLocalDate(serverTime: string): Date {
  const datePart = serverTime.slice(0, 10);
  const [y, m, d] = datePart.split("-").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function nextMondayInclusive(date: Date): Date {
  const dow = date.getUTCDay();
  const offset = dow === 1 ? 0 : (8 - dow) % 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + offset);
  return monday;
}

function formatLocalDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** POST the vacation-service digest test endpoint; bypasses the @Scheduled wrapper. */
export async function triggerDigestTestEndpoint(
  request: APIRequestContext,
  tttConfig: TttConfig,
): Promise<void> {
  const url = tttConfig.buildUrl("/api/vacation/v1/test/digest");
  const resp = await request.post(url, {
    headers: authHeaders(tttConfig),
  });
  expect(
    resp.ok(),
    `POST ${url} returned ${resp.status()}: ${await resp.text()}`,
  ).toBe(true);
}
