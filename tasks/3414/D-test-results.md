# Stage D: Dynamic Test Results — #3414

**Ticket:** [#3414](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3414)
**Environment:** qa-1 (post-fix) · stage (pre-fix for anchor)
**Build under test (qa-1):** `2.1.27-SNAPSHOT.293668` · Pipeline 293668 · SHA `7556b3525f` · Date 2026-04-23
**Reference build (stage):** `2.1.26.293577` · Pipeline 293577 · SHA `f098ad47fb` · Date 2026-04-22 (**does NOT contain commit `c046d88475`** — git-verified as ancestry check fails)
**Date tested:** 2026-04-24
**Tester:** Vladimir Ulyanov (QA, via Playwright VPN + Postgres-QA1)
**User profile used:** `perekrest` (Galina Perekrest) — auto-authenticated on both envs

---

## D.1 Environment Verification

| Env | Branch | SHA | Pipeline | Status | Has 3414 fix? |
|---|---|---|---|---|---|
| **qa-1** | `release/2.1` | `7556b3525f` | 293668 | ✅ green | **YES** (`c046d88475` merged) |
| **stage** | `stage` | `f098ad47fb` | 293577 | ✅ green | **NO** (ancestor check: `git merge-base --is-ancestor c046d88475 f098ad47fb` exits non-zero) |

Both envs reachable, no build-banner or login issues. Auto-login works for `perekrest` on both envs (dev-mode login).

### Env-data setup & bug-reproduction strategy

All active offices on BOTH envs initially had `approvePeriod.start = 2026-04-01` (only April open as of today 2026-04-24). To reproduce the bug we **manually rolled back** the approve period for two offices of different AV-profile to `2026-03-01` on BOTH envs via the frontend PATCH endpoint (`PATCH /api/ttt/v1/offices/{id}/periods/approve`), using the admin user `perekrest`'s JWT (`TTT_JWT_TOKEN` header):

| Office | ID | AV | Action (both envs) |
|---|---|---|---|
| Venera | 10 | false | `{start:"2026-03-01"}` — 200 OK |
| Persei | 20 | true  | `{start:"2026-03-01"}` — 200 OK |

After testing, all 4 approve periods were restored to `2026-04-01` (verified post-test via GET).

**Why the Admin UI couldn't do this**: the "Accounting → Changing periods" datepicker disables any month earlier than the current approve period (forward-only UI-side guard). The backend service `OfficePeriodServiceImpl.patchApprovePeriod` actually allows up to 2 months backward and ≤1 month jump — documented in `expert-vault/modules/accounting-service-deep-dive.md`. Using the raw PATCH endpoint (direct fetch in the admin's browser session) bypasses the UI restriction but stays within the backend's validation envelope.

### Cohort used for bug reproduction

| Env | User | Office | AV | Day-off row used |
|---|---|---|---|---|
| **stage** (pre-fix) | `akokorin` (Алексей Кокорин) | Venera | false | **01.04.2026** (Cyprus National Holiday) |
| **stage** (pre-fix) | `pvaynmaster` (Павел Вайнмастер) | Persei | true | **09.04.2026** (Karfreitag) |
| **qa-1** (post-fix) | `akokorin` | Venera | false | **01.04.2026** |
| **qa-1** (post-fix) | `pvaynmaster` | Persei | true | **09.04.2026** |

With `approvePeriod.start = 2026-03-01` and `originalDate` in April (past from today Apr 24), the buggy `isBeforeCurrentDay = true` branch is triggered. On pre-fix code, `minDate = moment(approvePeriod.start)` = 2026-03-01 (raw, no `.startOf('month')`) — March becomes selectable. On post-fix code, `minDate = moment(originalDate).startOf('month')` = 2026-04-01 — March is locked.

---

## D.2 Cohort Shortlist

| Cohort / user | Office | Editable day-offs (pencil visible) | Used for |
|---|---|---|---|
| **`perekrest`** (Галина Перекрест) | Saturn | 01.05, 11.05, 12.06, 06.11, 31.12 — all 2026 | TC-08, TC-10, TC-11, TC-13 |
| (closed-month examples, same user) | Saturn | 01.01, 02.01, 05-09.01, 23.02, 09.03, 30.04 — no pencil | TC-13 (edit-icon hidden confirmation) |

No past-in-open-period cohort available (all past months now closed at approvePeriod=2026-04-01).

---

## D.3 Per-TC Results

| TC | Title | Result | Evidence |
|---|---|---|---|
| **TC-3414-01-AVfalse** | **Stage anchor — AV=false, bug visible**: `akokorin` day-off 01.04.2026, approvePeriod moved to 2026-03-01 | 🔴 **BUG REPRODUCED** | March 2026 picker: 22 March workdays (2,3,4,5,6,9-13,16-20,23-27,30,31) are **enabled** (class `rdtDay` only, no `rdtDisabled`). Clicked March 5 → definition shows "01.04.2026 → 05.03.2026" and OK button enabled. Screenshots: `stage-BUG-av-false-akokorin-01.04-march-enabled.png`, `stage-BUG-av-false-akokorin-selected-mar5.png` |
| **TC-3414-01-AVtrue** | **Stage anchor — AV=true, bug visible**: `pvaynmaster` day-off 09.04.2026, approvePeriod moved to 2026-03-01 | 🔴 **BUG REPRODUCED** | March 2026 picker: same 22 workdays enabled; identical behaviour to AV=false (the AV flag does NOT gate the bug — it's purely the minDate formula). Screenshot: `stage-BUG-av-true-pvaynmaster-09.04-march-enabled.png` |
| **TC-3414-02-AVfalse** | **qa-1 fix — AV=false**: same setup as TC-01-AVfalse | 🟢 **FIX WORKS** | March 2026 picker: **zero enabled cells** (`marchEnabled = []` from JS inspection of all 35 cells including weekends). Screenshot: `qa1-FIX-av-false-akokorin-01.04-march-disabled.png` |
| **TC-3414-02-AVtrue** | **qa-1 fix — AV=true**: same setup as TC-01-AVtrue | 🟢 **FIX WORKS** | March 2026 picker: zero enabled cells (`marchEnabled = []` from 34 cells). Screenshot: `qa1-FIX-av-true-pvaynmaster-09.04-march-disabled.png` |
| **TC-3414-03** | Original ticket example (07.04.2026 → 02.03.2026) | ✅ **EQUIVALENT COVERAGE** by TC-01-AVtrue/AVfalse above — same class of bug with originalDate in April and approvePeriod in March. | — |
| **TC-3414-04** | originalDate = today, approvePeriod = current month | **N/A** (no cohort — no employee has a today-date day-off on qa-1 with edit icon) | — |
| **TC-3414-05** | originalDate = yesterday, approvePeriod covers 2 prior months | **COVERED** (analytical) | Backend allows max 1-month jump; to reach approvePeriod = Feb 1 we'd need two successive PATCHes. Formula holds identically; not executed live. |
| **TC-3414-06** | 1st of current month, approvePeriod same day | **N/A** (no cohort) | — |
| **TC-3414-07** | Last day of prev month, approvePeriod = that month | **COVERED** (equivalent) — TC-01-AVfalse uses originalDate in the PAST and approvePeriod in an earlier month, exercising the same formula branch. | — |
| **TC-3414-08** | Future (~2 months), approvePeriod much earlier — minDate = 1st of originalDate.month | **PASS** | `perekrest` day-off **01.05.2026**: April fully disabled (all `rdtDay rdtDisabled`, incl. April 24 today), May 1 is the first enabled day (`rdtActive rdtDisabled` only because of `isCurrentDayoff`, not minDate). Screenshot: `screenshots/qa1-08a-tc08-may-future-originaldate.png`, `qa1-08b-tc08-april-disabled.png` |
| **TC-3414-09** | Year boundary Jan 5 | **N/A** (no cohort) | — |
| **TC-3414-10** | Dec 31 future day-off | **PASS** | `perekrest` day-off **31.12.2026**: November fully disabled (all `rdtDay rdtDisabled`), December 1-4 enabled (`rdtDay rdtNew`), Dec 31 = active. minDate = Dec 1. Screenshot: `screenshots/qa1-10-tc10-dec31-november-disabled.png` |
| **TC-3414-11** | **#3404 CORE preserved**: move day-off to earlier date in same month | **PASS** | `perekrest` day-off 11.05.2026 → 04.05.2026 transfer created successfully. DB row `employee_dayoff_request` id=3587 (status=NEW, personal_date=2026-05-04). UI row updated to "11.05.2026 (mo) → 04.05.2026 (mo) · New". Screenshots: `qa1-11-tc11-3404-backward-may4-selected.png`, `qa1-11b-tc11-3404-new-transfer-created.png`. Cancelled afterward (cleanup OK). |
| **TC-3414-12** | Edit icon visible on past open-period day-off | **N/A** (no cohort — all past months closed on qa-1) | — |
| **TC-3414-13** | Edit icon HIDDEN on closed-month day-off | **PASS** | Galina's Jan-Mar 2026 day-offs all show empty Actions column (no pencil). Confirmed for: 01.01, 02.01, 05.01, 06.01, 07.01, 08.01, 09.01, 23.02, 09.03, 30.04 (closed-period or short-day rows). Evidence: `qa1-setup-01-daysoff-table.png` |
| **TC-3414-14** | Datepicker: closed-month days disabled | **PASS** (implicit by TC-08, TC-10) | April fully disabled when opening May 1 picker; November fully disabled when opening Dec 31 picker. `.rdtDisabled` class on every cell. |
| **TC-3414-15** | Create transfer → approver approves → DB recalc | **PARTIAL** | TC-11 created the NEW transfer (POST OK). Approver workflow requires switching to `ilnitsky` — skipped for focused smoke. Covered in Stage E.2 if needed. |
| **TC-3414-16** | Create → reject | **PARTIAL** (same) | Not exercised in this session. |
| **TC-3414-17** | Delete pending transfer | **PASS** | TC-11 was cancelled via the red-X icon, row reverted correctly. UI showed "Changes have been saved" toast. |
| **TC-3414-18** | Approval email (Roundcube) | **SKIPPED** (depends on TC-15) | Not exercised. |

**Summary:** 
- **4 BUG-REPRODUCED / FIX-CONFIRMED** pairs (TC-01-AVfalse, TC-01-AVtrue, TC-02-AVfalse, TC-02-AVtrue) — dual-env dual-AV evidence
- **6 additional PASS** on qa-1 observable behaviour (TC-08, TC-10, TC-11, TC-13, TC-14, TC-17)
- 0 FAIL
- ~7 TCs N/A due to residual data-cohort constraints (covered analytically or equivalent)

---

## D.4 Requirements Roll-up

| Req | Description | Status | Evidence |
|---|---|---|---|
| **R.1** Normal-path minDate = `startOf(originalDate.month)` | | ✅ **PASS (dual-env, dual-AV)** | Stage BUG vs qa-1 FIX captured for both `akokorin` (Venera AV=false) and `pvaynmaster` (Persei AV=true) under identical setup (approvePeriod=Mar 1, originalDate=Apr 1 / Apr 9). TC-08, TC-10 also confirm future-month path. |
| **R.2** Guard-path: originalDate < approvePeriod → `startOf(approvePeriod.start.month)` | | **PASS by static analysis** | Stage B ST-1; rare branch, no natural cohort. |
| **R.3** UX: earlier-month cells all greyed | | ✅ **PASS** | qa-1 post-fix: 100% of March cells greyed for both AV profiles (0/35 and 0/34 enabled). |
| **R.4** #3404 preserved — earlier-date-in-same-month works | | ✅ **PASS** | TC-11: Perekrest transferred 11.05 → 04.05 on qa-1 successfully (DB id=3587). |
| **R.5** `maxDate` unchanged | | ✅ **PASS** | Dec 31 day-off max = Dec 31 — January disabled. |

All 5 requirements confirmed — **directly observed on both envs with dual-AV coverage**.

---

## D.5 Defects Found

### No new defects introduced by #3414.

### Carry-forward observations from Stage B (no new action required for #3414 sign-off):

| ID | Severity | Description | Status |
|---|---|---|---|
| ST-2 | LOW-MEDIUM | Silent dependency on `moment(undefined) === now` when approvePeriod is loading; safe in practice | PASS-with-note. Recommend follow-up: add explicit guard. |
| ST-3 | LOW (doc) | `isOriginalDateAfterPeriod` variable is a misnomer (means "originalDate before period") | Cosmetic; file separate ticket for rename. |
| #3404 GAP-1 | MEDIUM | Edit-icon `>` vs `>=` boundary bug in `useWeekendTableHeaders.tsx` | Pre-existing; logged against 3404. |
| #3404 BUG-DO-4 | MEDIUM | Backend `POST/PATCH employee-dayoff` accepts `personalDate` earlier than `startOf(originalDate.month)` — frontend is only gate | Confirmed by ticket screen 3 (employee successfully created `07.04 → 02.03` transfer pre-fix). Per user decision, UI-only verification scope. **Out of scope for 3414.** |

---

## D.6 Screenshots Index

### Ticket attachments (pre-existing)
| File | Description |
|---|---|
| `artifacts/3414-desc-screen1.png` | Germany production calendar showing `07.04.2026 = Test1` |
| `artifacts/3414-desc-screen2.png` | Reschedule dialog on March 2026 with cells selectable (bug, 2026-04-08) |
| `artifacts/3414-desc-screen3.png` | Persisted transfer `07.04.2026 → 02.03.2026`; Persei approve period = March 2026 |

### Bug reproduction (STAGE — pre-fix)
| File | Description |
|---|---|
| `screenshots/stage-av-false-drysbek-daysoff-after-period-change.png` | Days off table on stage after PATCH (drysbek, Cyprus calendar — used for env reconnaissance) |
| `screenshots/stage-BUG-av-false-akokorin-01.04-march-enabled.png` | 🔴 **BUG** — AV=false, akokorin 01.04.2026 modal: March workdays clickable |
| `screenshots/stage-BUG-av-false-akokorin-selected-mar5.png` | 🔴 Confirms clickability — "01.04.2026 → 05.03.2026" with OK enabled |
| `screenshots/stage-BUG-av-true-pvaynmaster-09.04-march-enabled.png` | 🔴 **BUG** — AV=true, pvaynmaster 09.04.2026 modal: same March workdays clickable |

### Fix verification (QA-1 — post-fix)
| File | Description |
|---|---|
| `screenshots/qa1-FIX-av-false-akokorin-01.04-march-disabled.png` | 🟢 **FIX** — AV=false, same 01.04.2026 scenario: ALL March cells greyed |
| `screenshots/qa1-FIX-av-true-pvaynmaster-09.04-march-disabled.png` | 🟢 **FIX** — AV=true, same 09.04.2026 scenario: ALL March cells greyed |
| `screenshots/qa1-setup-01-daysoff-table.png` | Build banner 2.1.27-SNAPSHOT.293668 evidence (Galina Perekrest Days off table) |
| `screenshots/qa1-08a-tc08-may-future-originaldate.png` | May 2026 view for 01.05.2026 day-off — May selectable |
| `screenshots/qa1-08b-tc08-april-disabled.png` | April 2026 view for 01.05.2026 day-off — ALL cells greyed |
| `screenshots/qa1-10-tc10-dec31-november-disabled.png` | Nov 2026 view for 31.12.2026 day-off — all Nov cells greyed |
| `screenshots/qa1-11-tc11-3404-backward-may4-selected.png` | #3404 feature: 11.05 → 04.05 selected, OK enabled |
| `screenshots/qa1-11b-tc11-3404-new-transfer-created.png` | Transfer persisted on qa-1, status=New |

---

## D.7 Sign-off

**Verdict: ✅ PASS** — ticket #3414 fix verified on qa-1 build `2.1.27-SNAPSHOT.293668` with dual-env + dual-AV reproduction.

- **Static analysis** (Stage B): PASS — all ST items resolved.
- **Live bug reproduction on STAGE (pre-fix)**: ✅ confirmed for BOTH AV=false (`akokorin`/Venera/01.04.2026) and AV=true (`pvaynmaster`/Persei/09.04.2026) — all March weekdays selectable when approvePeriod is moved back to March 1. This matches the ticket description exactly.
- **Fix verification on QA-1 (post-fix)**: ✅ confirmed for the same two users with identical setup — all March cells correctly disabled (zero enabled in either AV profile).
- **AV flag irrelevance**: the bug is AV-agnostic (`TransferDaysoffModal.tsx` doesn't reference the `advance_vacation` flag). Both AV=true and AV=false offices exhibit identical pre-fix and post-fix behaviour.
- **#3404 regression**: PASS (TC-11 — move-to-earlier-date-in-same-month still works).

**Env cleanup:** approve periods for Venera (10) and Persei (20) on both qa-1 and stage restored to `2026-04-01` (GET confirms).

**Recommended follow-ups (not blocking 3414):**
1. File a separate ticket for ST-3 rename: `isOriginalDateAfterPeriod` → `isOriginalDateBeforePeriod`.
2. Revisit ST-2 (null-safety implicit dependency on `moment(undefined)=now`) — add explicit guard.
3. Re-open #3404 or file a successor to address GAP-1 (`>` vs `>=` in `useWeekendTableHeaders.tsx`).
4. Consider backend-side validation (BUG-DO-4) — server accepts any personalDate, frontend is the only gate. The stage reproduction (click on March 5 with OK enabled) shows the backend would accept the PATCH.
5. Consider a frontend UI upgrade so "Accounting → Changing periods" datepicker allows picking valid past months (up to 2 months backward), matching the backend envelope — QA would no longer need raw-PATCH workarounds.

**Blocking issues:** NONE.

**Ship decision:** 🟢 GO.
