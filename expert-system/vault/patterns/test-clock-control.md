---
type: pattern
tags:
  - test-clock
  - testing
  - scheduler
  - integration
  - rabbitmq
  - env-agnostic
created: '2026-04-24'
updated: '2026-04-24'
status: active
related:
  - '[[exploration/api-findings/cron-job-live-verification]]'
  - '[[modules/cross-service-integration]]'
  - '[[patterns/email-notification-triggers]]'
---
# Test-Clock Control (Backend + Frontend)

Canonical note for manipulating test time in TTT during QA / autotest runs. **The "timemachine-only" framing in older notes is obsolete** — the test-clock endpoint is available on every non-production environment (qa-1, qa-2, timemachine, preprod, stage, dev). Older notes that still say "requires timemachine" are stale unless the scenario specifically depends on timemachine's seeded fixtures.

## Backend — server-side clock

### Endpoint

`PATCH /api/ttt/v1/test/clock` — shifts the server clock to the given ISO-local time.
`POST  /api/ttt/v1/test/clock/reset` — returns the clock to real wall-time.
`GET   /api/ttt/v1/test/clock` — reads the current server clock (post-shift).

**Note the path ordering:** `v1/test/clock`, *not* `test/v1/clock`. A few older notes had the segments flipped; trust this note or `autotests/e2e/utils/clockControl.ts`.

Controller: `TestClockController` (ttt/rest) — `@Profile("!production")`. Guarded by the same `API_SECRET_TOKEN` header every other API fixture uses (`tttConfig.apiToken`). Body for PATCH is a `ClockDTO`: `{"time": "YYYY-MM-DDTHH:mm:ss"}` — local datetime, no timezone suffix, seconds required, nanoseconds optional.

### Availability matrix (verified 2026-04-24)

| Env | GET clock | PATCH clock | POST reset | Notes |
|---|---|---|---|---|
| qa-1 | ✓ | ✓ | ✓ | Verified this session — shifted to 2026-05-15, then reset |
| qa-2 | ✓ | ✓ | ✓ | Same controller bundle |
| timemachine | ✓ | ✓ | ✓ | Historically the only env used; still works |
| preprod | ✓ | ✓ | ✓ | `@Profile("!production")` — preprod profile is not `production` |
| stage | ✓ | ✓ | ✓ | Verified in session 129 (t3423) |
| dev | ✓ | ✓ | ✓ | Same |
| production | — | — | — | Blocked by `@Profile("!production")` |

### Propagation across services (critical — READ THIS)

TTT is a 4-service Spring Boot monorepo (ttt, vacation, calendar, email). Only the **ttt** service exposes the test controller; the other three do not. But each has its own `ClockServiceImpl` with a `changeTime()` method that updates its local `TimeUtils.clock`.

The cross-service sync is:
1. Caller `PATCH /api/ttt/v1/test/clock` → ttt controller calls `ClockServiceImpl.patch()`.
2. `patch()` computes the offset and **publishes an in-process `SystemClockChangedApplicationEvent`**, then immediately returns the computed time in the response (the *returned* time is accurate even before the clock actually shifts).
3. In the ttt service, `SystemApplicationEventListener.handle(@Async @EventListener)` picks up the event and sends a `SystemClockChangedEvent` onto the RabbitMQ `ttt.fanout` exchange.
4. All 4 services (ttt included) subscribe to `ttt.fanout` via `SystemClockChangedEventHandler.handle(event)` → `clockService.changeTime(offset)`.
5. `changeTime()` then: sets `TimeUtils.clock` (static), reconfigures the `ThreadPoolTaskScheduler`, **clears ShedLock** (`UPDATE ttt_backend.shedlock SET lock_until = '-infinity'`), updates `cs_sync_status` timestamps, and restarts scheduled jobs so next-fire times recompute.

**Observable lag:** 1–5 s between PATCH response and all four services actually reading the new clock. Tests that read the clock or trigger a scheduled job immediately after PATCH should either wait ≥3 s or poll `GET /api/ttt/v1/test/clock` until the time matches.

### Side effects the test author must know

- **ShedLock wiped to `-infinity`** on every PATCH. Any `@Scheduled` job with a short cron (20s-5min) will fire within one window of the shift. If your test doesn't want other jobs firing, either schedule the shift into a quiet window or accept the noise.
- **cs_sync_status rows** with future timestamps get capped. Time travel *backward* (e.g., from May to April) can create duplicate rows — see [[modules/cross-service-integration|#2629 incident]]. Prefer forward-only shifts.
- **Static `TimeUtils.clock`** means every service instance affected. Don't parallelize tests that fight over the clock across CI shards unless each gets its own env.
- **`OfficeCalendarServiceImpl.update()` uses `LocalDate.now()` directly** (bug tracked in [[modules/calendar-service-deep-dive]] §357). Some code paths ignore the test clock — read the note's pitfall list before assuming the shift is global.

### CLI recipe

```bash
# PATCH
curl -sk -X PATCH \
  -H 'Content-Type: application/json' \
  -H 'API_SECRET_TOKEN: <apiToken>' \
  -d '{"time":"2026-05-15T10:00:00"}' \
  https://ttt-<env>.noveogroup.com/api/ttt/v1/test/clock

# GET (poll to confirm propagation)
curl -sk -H 'API_SECRET_TOKEN: <apiToken>' \
  https://ttt-<env>.noveogroup.com/api/ttt/v1/test/clock

# RESET
curl -sk -X POST -H 'API_SECRET_TOKEN: <apiToken>' \
  https://ttt-<env>.noveogroup.com/api/ttt/v1/test/clock/reset
```

MCP Swagger equivalents: `mcp__swagger-<env>-ttt-test__ptch-using-ptch-11`, `get-using-get-5`, `reset-using-pst`. **Heads-up:** the MCP tool currently has a body-marshalling issue for PATCH (NPE on `temporal`) — prefer the raw curl path or the autotest helper until the tool is fixed.

## Frontend — browser-side clock

The frontend (React + moment.js) runs in the user's browser, so the *browser's* `Date.now()` is independent from the server's test clock. A backend-only shift leaves moment-based validations (datepickers, disabled-date predicates, stale-flag banners) comparing a patched server date against the real client wall time — which breaks reproductions that depend on "today" being a specific value on the client.

### Playwright `page.clock` — the right lever

Playwright ships a clock API (`page.clock`, since 1.45) that monkey-patches `Date`, `performance.now()`, `setTimeout`, `setInterval`, `requestAnimationFrame` inside the browser context. Scope = one browser context; no OS, network, or host-clock side effects.

```ts
// Before navigation
await page.clock.install({ time: new Date('2026-05-15T10:00:00Z') });
await page.goto(tttConfig.appUrl);   // app boots under the virtual clock

// Later in the test
await page.clock.fastForward('01:00');            // advance 1 hour
await page.clock.setFixedTime(new Date(...));      // jump to a fixed instant
```

Critical rules:
- **Install before `page.goto`.** React bundles cache `Date.now()` at module load — install late and the cached value leaks through.
- **Set `timezoneId` on the browser context** to keep moment's zone math stable: `browser.newContext({ timezoneId: 'Europe/Kaliningrad' })`.
- **Pair with a backend shift** for coherent end-to-end semantics. Use `ClockFixture` (below) — it shifts both sides to the same ISO instant in one call.
- **JWT expiry** — the browser sees a frozen clock but the gateway sees real time. If you freeze past the token's `exp`, requests 401. Refresh the token immediately before `page.clock.install`, or keep test runs short.
- **`page.clock.install` blocks JS `setTimeout`/`setInterval`** unless you explicitly `runFor` / `fastForward`. React Query `refetchInterval`, SSE reconnect backoffs, and debounced input handlers all pause until the clock advances. Usually desirable for determinism.

### Alternatives (why we don't use them)

- **OS-level `date -s`** — poisons git timestamps, TLS cert validation, NTP, Docker host, cron, filesystem mtime, backup scripts, other browsers on the host. Never acceptable.
- **Inject `moment.now()` override via `addInitScript`** — works but doesn't cover raw `Date.now()`, `new Date()`, timer APIs. Strictly worse than `page.clock`.
- **Chrome DevTools Protocol `Emulation.setVirtualTimePolicy`** — lower-level than `page.clock`; no reason to reach for it unless `page.clock` itself is the thing under test.

## The fixture — `ClockFixture`

Location: `autotests/e2e/fixtures/common/ClockFixture.ts`. Depends on:
- `autotests/e2e/utils/clockControl.ts` — already provides `getServerClock`, `patchServerClock`, `resetServerClock`.
- Playwright `page.clock` API for the frontend side.

The fixture keeps both sides in sync and cleans both up in `restore()`. See the fixture source for the current contract; the important invariant is that tests that advance the clock MUST call `restore()` in `afterEach` (or a try/finally wrapper) so the shared env doesn't stay shifted.

## Related

- [[exploration/api-findings/cron-job-live-verification]] — which schedulers emit markers that survive clock jumps, which ones don't
- [[patterns/email-notification-triggers]] — dual-trigger pattern (scheduler clock-advance vs test endpoint)
- [[modules/cross-service-integration]] — the `SystemClockChangedEvent` fanout across 4 services and the #2629 backward-shift incident
- [[exploration/tickets/t3423-investigation]] — session notes that first confirmed cross-env availability
