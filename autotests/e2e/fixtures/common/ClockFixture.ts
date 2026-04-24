import type { APIRequestContext, Page } from "@playwright/test";
import type { TttConfig } from "@ttt/config/tttConfig";
import {
  getServerClock,
  patchServerClock,
  resetServerClock,
} from "@utils/clockControl";

/**
 * Unified test-clock control for backend + frontend.
 *
 * **Env-agnostic.** The backend endpoint `/api/ttt/v1/test/clock` is gated by
 * `@Profile("!production")` and available on qa-1, qa-2, timemachine, preprod,
 * stage, and dev. Earlier notes that framed it as "timemachine-only" are
 * obsolete — see `patterns/test-clock-control.md` in the vault.
 *
 * The fixture coordinates two independent clocks:
 *
 * 1. **Backend** — TTT publishes a `SystemClockChangedEvent` on the
 *    `ttt.fanout` RabbitMQ exchange, which propagates the shift to all 4
 *    services (ttt, vacation, calendar, email). Only the ttt service exposes
 *    the PATCH endpoint; the other three receive the event.
 *
 * 2. **Frontend** — Playwright's `page.clock` API monkey-patches `Date`,
 *    `performance.now()`, and timer functions inside one browser context. No
 *    OS or network-level side effects.
 *
 * **Critical ordering.** `setFrontend(page, …)` must be called BEFORE
 * `page.goto(…)` — React caches `Date.now()` at module load. For the common
 * path, call `setBoth(page, iso)` *before* the first navigation.
 *
 * **Restore discipline.** Shared test envs stay broken if a test forgets to
 * reset the backend clock. Always wrap in try/finally and call `restore()`
 * — even when the clock is only shifted on the backend side.
 *
 * Usage:
 * ```ts
 * const clock = new ClockFixture(request, tttConfig);
 * try {
 *   await clock.setBoth(page, "2026-05-15T10:00:00");
 *   await page.goto(tttConfig.appUrl);
 *   // … test steps …
 * } finally {
 *   await clock.restore(page);
 * }
 * ```
 */
export class ClockFixture {
  private readonly propagationTimeoutMs: number;
  private readonly propagationIntervalMs: number;
  private readonly pagesWithFakeClock: Set<Page> = new Set();
  private backendShifted = false;

  constructor(
    private readonly request: APIRequestContext,
    private readonly tttConfig: TttConfig,
    options: {
      /** Max time to wait for MQ fanout to settle backend clock (default 15 000). */
      propagationTimeoutMs?: number;
      /** Poll interval while waiting for propagation (default 500). */
      propagationIntervalMs?: number;
    } = {},
  ) {
    this.propagationTimeoutMs = options.propagationTimeoutMs ?? 15_000;
    this.propagationIntervalMs = options.propagationIntervalMs ?? 500;
  }

  /**
   * Patches the backend clock to `isoLocal` (e.g. "2026-05-15T10:00:00") and
   * waits until a subsequent `GET /clock` reflects the new time (MQ fanout
   * can take 1–5 s). Returns the echoed server time from the PATCH response.
   *
   * Warning: this also wipes `ttt_backend.shedlock` (`lock_until = '-infinity'`)
   * as a side effect. Any @Scheduled job with a short cron will fire within
   * one window of the shift.
   */
  async setBackend(isoLocal: string): Promise<string> {
    const echoed = await patchServerClock(this.request, this.tttConfig, isoLocal);
    this.backendShifted = true;
    await this.waitForPropagation(isoLocal);
    return echoed;
  }

  /**
   * Installs Playwright's fake clock on `page` at the given instant. MUST be
   * called before `page.goto(...)` so the React bundle boots under the fake
   * clock.
   *
   * Accepts the same value types as Playwright's `page.clock.install`: ISO
   * string, `Date`, or epoch milliseconds. For server-side consistency, prefer
   * passing the exact string you pass to `setBackend`.
   */
  async setFrontend(page: Page, when: string | Date | number): Promise<void> {
    const time = typeof when === "string" ? new Date(when) : when;
    await page.clock.install({ time });
    this.pagesWithFakeClock.add(page);
  }

  /**
   * Convenience: advance both backend and frontend to the same instant in one
   * call. Frontend first (so a subsequent page.goto boots under the fake
   * clock), then backend. Returns the backend's echoed server time.
   */
  async setBoth(page: Page, isoLocal: string): Promise<string> {
    await this.setFrontend(page, isoLocal);
    return this.setBackend(isoLocal);
  }

  /**
   * Fast-forwards a frontend clock that was previously installed with
   * `setFrontend` / `setBoth`. The backend is unchanged — call `setBackend`
   * separately if you need the backend to advance too.
   *
   * `ticks` accepts the same forms as Playwright: milliseconds (number), or
   * strings like "30s", "1h", or "02:30:00".
   */
  async fastForwardFrontend(page: Page, ticks: string | number): Promise<void> {
    await page.clock.fastForward(ticks);
  }

  /** Reads the current backend clock (useful for assertions / logging). */
  async getBackend(): Promise<string> {
    return getServerClock(this.request, this.tttConfig);
  }

  /**
   * Restores both clocks to real wall time.
   *
   * - Backend: `POST /clock/reset` (idempotent on the fanout).
   * - Frontend: on each page that had a fake clock installed, jumps the clock
   *   to the current wall time and calls `resume()` so real time flows again.
   *   Playwright has no full "uninstall" — the only way to remove the fake
   *   clock entirely is to close the browser context. `resume()` gets us
   *   close enough for most cleanup needs.
   *
   * Pass `page` (or pages) explicitly if you want a specific frontend cleaned;
   * otherwise every page that was installed via this fixture is cleaned.
   *
   * Safe to call multiple times and safe to call even if nothing was shifted.
   */
  async restore(pages?: Page | Page[]): Promise<void> {
    const targets = this.resolveRestoreTargets(pages);

    for (const page of targets) {
      try {
        await page.clock.setFixedTime(new Date());
        await page.clock.resume();
      } catch {
        // Page may already be closed — that's fine
      }
      this.pagesWithFakeClock.delete(page);
    }

    if (this.backendShifted) {
      try {
        await resetServerClock(this.request, this.tttConfig);
      } finally {
        this.backendShifted = false;
      }
    }
  }

  private resolveRestoreTargets(pages?: Page | Page[]): Page[] {
    if (pages === undefined) {
      return Array.from(this.pagesWithFakeClock);
    }
    return Array.isArray(pages) ? pages : [pages];
  }

  private async waitForPropagation(targetIso: string): Promise<void> {
    const deadline = Date.now() + this.propagationTimeoutMs;
    const targetDate = isoLocalToDate(targetIso);

    while (Date.now() < deadline) {
      const actual = await this.safeGetBackend();
      if (actual && isoLocalToDate(actual).getTime() >= targetDate.getTime()) {
        return;
      }
      await sleep(this.propagationIntervalMs);
    }
    // Don't throw — the PATCH response already echoed the target time, so the
    // clock is set even if the GET round-trip races. Callers that need hard
    // propagation guarantees should poll `getBackend()` themselves.
  }

  private async safeGetBackend(): Promise<string | null> {
    try {
      return await this.getBackend();
    } catch {
      return null;
    }
  }
}

function isoLocalToDate(iso: string): Date {
  // Server returns ISO-local without timezone ("2026-05-15T10:00:00.123456789").
  // Parse by treating the string as local wall time — since we only compare
  // against the same shape on both sides, absolute offset doesn't matter.
  const base = iso.slice(0, 19); // "YYYY-MM-DDTHH:mm:ss"
  return new Date(base + "Z");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
