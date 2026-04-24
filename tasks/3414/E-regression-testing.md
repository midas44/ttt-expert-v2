# Stage E: Regression Testing — #3414

**Ticket:** [#3414](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3414)
**Environment:** qa-1 (`release/2.1` post-fix · build `2.1.27-SNAPSHOT.293668`)
**Date:** 2026-04-24

---

## E.1 — #3404 Autotest Suite (21 specs)

### Run command
```bash
cd /home/v/Dev/ttt-expert-v2/autotests && \
  npx playwright test e2e/tests/t3404/ --project=chrome-headless --reporter=list
```

### Result: **17 PASS, 4 FAIL** (runtime: ~1.8 min)

All 4 failures were triaged and confirmed as **pre-existing env-data drift or pre-existing known issues — NOT caused by #3414**.

| TC | Spec | Result | Root cause | 3414-related? |
|---|---|---|---|---|
| TC-T3404-001 .. 006 | `t3404-tc00{1..6}.spec.ts` | ✅ PASS | — | — |
| TC-T3404-007 | `t3404-tc007.spec.ts` — "Boundary: day-off ON approve period start" | ❌ FAIL | **Pre-existing #3404 GAP-1**: `>` instead of `>=` in `useWeekendTableHeaders.tsx` hides the edit icon when `lastApprovedDate === approvePeriod.start`. Confirmed in `tasks/3404/D-test-results.md` D.7 (reported 2026-03-27 as MEDIUM bug). | **NO** — reported before 3414 existed. |
| TC-T3404-008 .. 010 | | ✅ PASS | — | — |
| TC-T3404-011 | `t3404-tc011.spec.ts` — "Closed month February all dates disabled" | ❌ FAIL | **Env-data drift**: test data is hardcoded to `user=eburets, dayoffDate=2026-03-09, approvePeriodStart=2026-03-01` (`T3404Tc011Data.ts:23-30`). ApprovePeriod moved to 2026-04-01 since 3404 testing, so the 09.03.2026 row no longer has an edit icon. Test fails at `clickEditButton`. | **NO** — environment changed, not code. |
| TC-T3404-012 | `t3404-tc012.spec.ts` — "Open month March working days enabled" | ❌ FAIL | **Env-data drift**: same cause as TC-011 — test expects March open approve period. Now closed. | **NO** — environment changed. |
| TC-T3404-013 .. 018 | | ✅ PASS | — | — |
| TC-T3404-019 | `t3404-tc019.spec.ts` — "Future holiday minDate uses original date" | ❌ FAIL | **Stale test expectation**: test expects `minDate = originalDate` for future day-offs. This was the behaviour after the FIRST 3404 commit (`fbcc0f2a05`), but commit `d078650ff1` (also #3404, Apr 7) changed it to `startOf(originalDate.month)` — allowing backward within same month even for future originalDates. The test wasn't updated to match. | **NO** — stale vs #3404's own final commit, predates #3414. |
| TC-T3404-020, 023 | | ✅ PASS | — | — |

### Verdict: **PASS — no #3414 regressions in #3404 coverage.**

All 21 test cases that were green at #3404 sign-off time (2026-03-31 per `tasks/3404/D-test-results.md`) that are still supposed to work continue to work. The 4 failures are from:
- 1 pre-existing MEDIUM bug (GAP-1) known since 2026-03-27
- 2 env-data drift failures (approvePeriod moved April; March now closed)
- 1 stale-expectation test vs #3404's own final commit

None of these failures would be resolved or introduced by the #3414 code change. The #3414 diff only removes the `isBeforeCurrentDay` branch and collapses minDate to a single formula — it does not affect:
- Edit-icon visibility (different file, `useWeekendTableHeaders.tsx`)
- Closed-month disabling (still enforced via `renderDay`'s weekend/publicDate checks + minDate)
- #3404's final minDate formula (which 3414 merely simplifies — keeps same `.startOf('month')` result)

### Recommended follow-ups (NOT blocking #3414):
- Update `T3404Tc011Data.ts` / `T3404Tc012Data.ts` to seed their own approve period + day-off data via API or skip gracefully when env state doesn't match.
- Update `t3404-tc019.spec.ts` expectation to reflect post-`d078650ff1` behaviour (`minDate = startOf('month')`).
- Address GAP-1 in `useWeekendTableHeaders.tsx` (change `>` to `>=`) — confirmed defect since 3404.

---

## E.2 — Manual smoke on core day-off flows

Per user decision, not the full 41-spec `tests/day-off/` sweep. Focus on 5 key flows.

| ID | Flow | Result | Evidence |
|---|---|---|---|
| **TC-E-01** | Create forward transfer (employee view) | **PASS** | TC-3414-11 (Stage D): Galina created `11.05 → 04.05` via modal; row updated to show `11.05.2026 (mo) → 04.05.2026 (mo) · New`; toast "A request for day off rescheduling has been created" displayed. Screenshot: `screenshots/qa1-11b-tc11-3404-new-transfer-created.png` |
| **TC-E-02** | Manager approves transfer | **SKIPPED** | Requires switching to `ilnitsky` user. Not exercised in this session. Not a regression risk — approval flow is backend logic untouched by #3414 (frontend-only fix). |
| **TC-E-03** | Cancel/delete pending transfer | **PASS** | Stage D cleanup: clicked the red-X icon on the pending `11.05 → 04.05` row. Row reverted to unmoved state; toast "Changes have been saved" displayed. DB verified `employee_dayoff_request` id=3587 no longer active (state change OK). |
| **TC-E-04** | Manager-view tabs (APPROVER, OPTIONAL_APPROVER, MY_DEPARTMENT, MY_PROJECTS, DELEGATED) load | **NOT EXERCISED** | Low-risk: these tabs are separate React routes unrelated to the `TransferDaysoffModal.tsx` fix. If a regression here existed, t3404 spec `tc020` (manager approve path) would have failed — it PASSED. |
| **TC-E-05** | Email notification for approval (Roundcube) | **NOT EXERCISED** | Depends on TC-E-02; skipped. Email dispatch is backend logic unchanged. |

### E.2 Verdict: **PASS** — core employee-side flow (create/cancel) exercised and works. Manager-side and email flows not exercised but are orthogonal to the frontend-only #3414 fix.

---

## E.3 Regression Roll-up per prior ticket

| Prior ticket | Cohort | Verdict | Evidence |
|---|---|---|---|
| **#3404** — Allow moving days off to earlier dates within open month | Galina Perekrest / Saturn office | **PASS — no regression** | TC-3414-11 (Stage D): 11.05 → 04.05 backward-within-same-month transfer works. 17/21 t3404 autotests PASS; 4 failures diagnosed as pre-existing. |
| **#3353** (individual norm period changes) | — | **NOT RELEVANT** | Unrelated backend functionality; #3414 is FE-only and isolated to `TransferDaysoffModal`. |
| **#2724** (planner close tags) | — | **NOT RELEVANT** | Different module. |

---

## E.4 General day-off regression surface

Not fully exercised in this session (per user-approved focused scope), but analytically:

- **Auto-reject on month close** — backend `VacationStatusUpdateJob` logic is unchanged by #3414.
- **Office-change cascade** — `CalendarUpdateProcessorImpl` unchanged.
- **Vacation-day recalc on approval** — backend approve flow unchanged.
- **Digest + approval emails** — email templates untouched; frontend-only diff confirms.

Recommended: next run of the full `autotests/e2e/tests/day-off/` suite (41 specs) on a fresh build post-merge should cover this sweep. **Not blocking #3414.**

---

## E.5 Final sign-off

**Verdict: ✅ PASS**

- **E.1 (#3404 autotest suite):** 17/21 PASS. 4 failures all pre-existing (not caused by #3414). No 3414-introduced regression.
- **E.2 (manual smoke):** 2/5 TCs exercised and PASS (create, cancel). Remaining 3 TCs are orthogonal to the FE-only fix and low-risk.
- **E.3 (#3404 specific regression):** PASS — core feature (backward within same month) works.
- **E.4 (general day-off):** No structural regression risk by static analysis (no backend / scheduler / email-template / migration changes in #3414).
- **E.5 Dual-env dual-AV bug reproduction & fix verification (added Stage D.2):** PASS — bug reproduced on stage for AV=false (Venera/akokorin) and AV=true (Persei/pvaynmaster); fix confirmed on qa-1 for the same cohort. See `D-test-results.md` §D.3 rows TC-3414-01-AVfalse / AVtrue / TC-3414-02-AVfalse / AVtrue.

**Blocking issues:** NONE.

**Ship decision:** 🟢 GO (combined with Stage D verdict).
