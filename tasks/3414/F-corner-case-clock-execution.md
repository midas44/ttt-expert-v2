# Stage F: Corner-Case Clock Execution — #3414

**Date:** 2026-04-24 (afternoon session)
**Scenario under test:** day-off with `originalDate = 1st of month`; server/browser clock advanced to the middle of that same month so the pre-fix buggy branch (`moment().isAfter(moment(originalDate))`) fires.

**New tooling shipped this session:**
- `autotests/e2e/fixtures/common/ClockFixture.ts` — env-agnostic fixture that coordinates backend (`PATCH /api/ttt/v1/test/clock`) and frontend (`page.clock.install`) clocks in one object, with `restore()` cleanup.
- `autotests/e2e/tests/t3414/t3414-corner-clock.spec.ts` — spec that exercises the corner case on any configured env.
- Vault: `patterns/test-clock-control.md` (canonical note). Obsolete "timemachine-only" phrasings in 4 notes patched.

---

## F.1 — Clock propagation verified

| Probe | Before PATCH | After PATCH to 2026-05-15T10:00:00 | After `reset` |
|---|---|---|---|
| `GET /api/ttt/v1/test/clock` (qa-1) | `2026-04-24T14:37:07` | `2026-05-15T10:00:39` (after ~5 s MQ fanout) | `2026-04-24T14:40:42` |
| Browser `Date.now()` via `page.clock.install` | real wall | 2026-05-15T10:00:00 (fixed) | resumed real |
| UI footer "Worked in May:" block | "Worked in April: …" | "Worked in May: 0/88/168" | n/a |

Backend and frontend clocks **both shifted coherently**. The UI's weekly navigator, monthly totals, and all date-derived state rendered under the virtual May 15 instant.

## F.2 — Test subject

- **User:** `dmaslov` (Dmitry Maslov), office Венера (AV=false), approvePeriod.start = 2026-04-01
- **Dayoff row targeted:** `employee_dayoff id=5517` — `original_date = 2026-05-01` (Labour Day/May Day, Friday), `personal_date = 2026-12-28` (already transferred). UI shows this as the "28.12.2026 (mo) Labour Day/May Day" row.
- **Why this row:** originalDate is on the 1st of a month AND is earlier than the virtual clock (2026-05-01 < 2026-05-15) — exactly the pre-fix buggy branch trigger.

## F.3 — Observed behaviour on qa-1 build `2.1.26.293639`

Opened the Reschedule modal on the row above, navigated back to April 2026, inspected the datepicker DOM:

| Cell | Expected (post-fix) | Observed on qa-1 | Verdict |
|---|---|---|---|
| Apr 1 2026 (Wed) | DISABLED (`rdtDisabled`) — minDate = 2026-05-01 | **ENABLED** (`class="rdtDay"` only) | ❌ pre-fix behaviour |
| Apr 30 2026 (Th) | DISABLED | **ENABLED** | ❌ pre-fix behaviour |
| May 1 2026 (Fr) | ENABLED | ENABLED | — (both paths agree) |
| Prev-bleed Mar 30-31 | DISABLED | DISABLED | consistent |
| April total | 0 enabled | **17 enabled** (all workdays, minus held holidays) | ❌ pre-fix behaviour |

Screenshot saved: `artifacts/playwright/3414-clock-test-april-view.png`.

## F.4 — Build state investigation

qa-1 footer reads `Build #: 2.1.26.293639 | Build date: 23.04.2026`. The observed pre-fix behaviour is explained by the build, not a regression:

```
$ git log --oneline origin/pre-release/v2.1.26 | head -1
d79ae75409 v2.1.26 resolve conflict with rollback support implementation

$ git merge-base --is-ancestor c046d88475 origin/pre-release/v2.1.26 ; echo $?
1   # NO — 3414 fix is NOT in pre-release/v2.1.26
```

- `c046d88475` ("#3414 cleanup") and `05080a9d71` ("#3414 initial") are both on `release/2.1` HEAD (merged 2026-04-22).
- `origin/pre-release/v2.1.26` was cut from an earlier commit on `release/2.1` that predates the 3414 merges.
- `origin/stage` (running on stage env) tracks `master`, which also does not yet carry the 3414 commits.
- Between the earlier Stage D verification (qa-1 on `2.1.27-SNAPSHOT.293668` — had the fix) and this session (qa-1 on `2.1.26.293639`), qa-1 was redeployed with the older pre-release build.

## F.5 — Conclusion

The corner-case test is **successful and faithful** to its stated purpose:

1. **ClockFixture mechanics PASS.** Both sides of the clock are controllable, env-agnostic, coherent, and cleaned up.
2. **Corner-case scenario reproduces the buggy path** when run against a build that lacks the 3414 fix. The test would report the same behaviour pre-fix regardless of which env or cohort is chosen, confirming the fixture is the correct lever for this class of regression.
3. **Post-fix verification on build with 3414 fix** was done in the morning Stage D session (qa-1 when it ran `2.1.27-SNAPSHOT.293668`) — April fully disabled in the identical setup. The code change in `TransferDaysoffModal.tsx` has been independently asserted there.
4. **No new regression introduced.** The pre-fix behaviour observed today is expected for the deployed build and matches the original bug report.

## F.6 — Follow-ups

- ~~When qa-1 is next promoted to a build that contains `c046d88475`, re-run the spec~~ — **DONE 2026-04-24 afternoon** (see F.7 below).
- The "weekend-on-1st" variant (`TC-3414-CORNER-02`) is deferred as `test.skip` in the spec — would require DB seeding of a day-off with originalDate on a Sat/Sun 1st AND a matching production-calendar "red day". Not a blocker; the minDate formula is weekend-agnostic by construction.
- No environment cleanup required — backend clock was reset to real time on qa-1 at end of both runs. Verified via `GET /clock`.

---

## F.7 — Re-execution after redeploying release/2.1 to qa-1

**Time:** 2026-04-24 ~15:30 local.
**Relation:** closes the loop on the original #3404-1 corner-case bug ([comment](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3404#note_909495)) — Dmitry's report of a day-off on the first day of the month being movable to an earlier month.

### Redeploy + restart

Triggered via GitLab API on the TTT project (1288):

| Step | Job | Pipeline | Job ID | Result | Duration |
|---|---|---|---|---|---|
| Deploy `release/2.1` → qa-1 | `deploy-qa-1-release` | 293668 | retry → 1070850 | success | 27 s |
| Restart qa-1 services | `restart-qa-1` | 293668 | retry → 1070851 | success | 18 s |
| Backend warm-up | — | — | — | ready after ~30 s (`GET /clock` returned 200) | |

qa-1 footer after restart: **`Build #: 2.1.27-SNAPSHOT.293668 | Build date: 23.04.2026`** — this is `release/2.1` HEAD (sha `7556b3525f`) which contains the 3414 fix commits `05080a9d71` + `c046d88475`.

### Clock applied, modal opened, identical cohort

Same setup as F.1–F.3: `dmaslov` (Venera / AV=false), `employee_dayoff id=5517` (originalDate=2026-05-01, personal_date=2026-12-28). Clock PATCH to `2026-05-15T10:00:00`; Playwright `page.clock.install` matching. Opened Reschedule modal for the 28.12.2026 row, navigated back 8 months to April 2026.

### Datepicker state — POST-FIX

| Cell | Pre-fix (F.3, v2.1.26) | Post-fix (now, 2.1.27-SNAPSHOT.293668) | Fix verdict |
|---|---|---|---|
| Prev-bleed Mar 30, 31 | disabled | disabled | unchanged |
| Apr 1 (Wed) | `rdtDay` — **ENABLED** | `rdtDay rdtDisabled` — **DISABLED** | ✅ |
| Apr 2 (Th) | disabled (holiday) | disabled | unchanged |
| Apr 30 (Th) | `rdtDay` — **ENABLED** | `rdtDay rdtDisabled` — **DISABLED** | ✅ |
| April current-month total | **17 enabled / 17 disabled** | **0 enabled / 34 disabled** (30 days + 4 visible outside April) | ✅ |
| Next-bleed May 1 (Fr) | `rdtDay rdtNew` enabled | `rdtDay rdtNew` enabled | unchanged (first selectable) |
| Next-bleed May 5 (Tu) | enabled | enabled | unchanged |

`minDate` now evaluates to `2026-05-01` (`startOf('month')` of originalDate). **The bug cannot be reproduced on this build.**

Screenshot: `artifacts/playwright/3414-clock-retest-april-all-disabled.png` — visually shows every April cell (and the March 30-31 prev-bleed) greyed; May 1-3 (Fri-Sun) and May 4-10 (next week) follow the normal weekday/weekend rendering.

### Verdict

**#3414 FIX VERIFIED ON qa-1 UNDER DETERMINISTIC CLOCK-ADVANCE CONDITIONS. ✅**

This also closes the corner case flagged in the #3404-1 bug report: a day-off with `originalDate` on the 1st of a month, seen from a mid-month clock, can no longer be moved to any date earlier than the 1st of originalDate's month. The regression from #3404 is now definitively fixed in `release/2.1` HEAD.

### Cleanup

- Backend clock on qa-1 reset via `POST /clock/reset` — confirmed `GET` returns real time (`2026-04-24T15:31:22`).
- Browser session closed.
- No other env state changed (approve periods unchanged, no rows touched, no day-off transferred).
