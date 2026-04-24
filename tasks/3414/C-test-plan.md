# Stage C: Test Plan & Test Cases — #3414

**Ticket:** [#3414](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3414)
**Environment under test:** **qa-1** (`release/2.1`, post-fix)
**Reference environment:** **stage** (`release/2.1` pre-fix — before commit `05080a9d71`) — for anchor
**Date:** 2026-04-24

---

## C.1 Test Strategy

### Scope

| Dimension | Coverage |
|---|---|
| Requirements | R.1 through R.5 (see Stage A §A.2) |
| #3404 regression | Core feature (move to earlier same-month date) + edit-icon visibility + closed-month disable |
| General day-off regression (smoke) | Create / approve / reject / delete / notification email |
| Bug reproduction | Dual-env anchor (TC-01 on stage) + verification (TC-02/03 on qa-1) |
| Boundary matrix | 7 rows covering originalDate × approvePeriod combinations |
| Out-of-scope (per user decision) | Backend API probe (ST-7), DST / leap-year live timemachine runs (ST-5), full 41-spec day-off autotest sweep |

### Approach

1. **Anchor** — reproduce the bug on stage to prove pre-fix behaviour (TC-01); if stage is down, rely on ticket reporter's screen2/screen3 + stage DB reads per 3427 D.1 precedent.
2. **Smoke verification** — TC-02, TC-03 on qa-1 — prove the fix works for the exact ticket scenario.
3. **Boundary matrix** — TC-04 through TC-10 — cover originalDate × approvePeriod combinations; assert rendered `minDate` in the datepicker matches the computed formula.
4. **Regression (Group 3)** — TC-11 through TC-14 — prove #3404 feature is preserved.
5. **Smoke (Group 4)** — TC-15 through TC-18 — core day-off flows unchanged.

### Test data requirements

| Cohort | Profile | qa-1 | Stage (anchor) | TCs |
|---|---|---|---|---|
| **Primary bug-reproduction cohort** | Employee with day-off whose `originalDate` is in current month OR very recent past, AND office's `approvePeriod.start` is in a prior month | ✅ | ✅ | TC-01..04 |
| **Closed-month cohort** | Employee with day-off whose `originalDate` is in a **closed** approve period (earlier than approvePeriod.start) | ✅ | — | TC-13, TC-14 |
| **Future-originalDate cohort** | Employee with upcoming holiday (future day-off entry) | ✅ | — | TC-08, TC-11 |
| **Year-boundary cohort** | Day-off whose `originalDate` is Jan / Dec, with approvePeriod spanning year edge | ✅ | — | TC-09, TC-10 |
| **Manager-approval cohort** | Test user + manager/approver pair; approver has rights over employee | ✅ | — | TC-15..18 |

### Discovery queries (Stage D will run these)

```sql
-- Candidate day-offs where originalDate is in open (current) period,
-- AND office's approvePeriod starts in a strictly earlier month (bug condition)
SELECT e.login, vt.last_approved_date AS original_date,
       vt.personal_date, vt.duration,
       op.start_date AS approve_period_start,
       o.name AS office
  FROM ttt_vacation.vacation_weekend_table vt
  JOIN ttt_vacation.employee e  ON e.id = vt.employee_id
  JOIN ttt_vacation.office o    ON o.id = e.office_id
  JOIN ttt_vacation.office_period op ON op.office_id = o.id AND op.type = 'APPROVE'
 WHERE vt.last_approved_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE + 30
   AND op.start_date < date_trunc('month', vt.last_approved_date)
 ORDER BY vt.last_approved_date DESC
 LIMIT 20;
```

Column names are draft — verify at run time against `\d ttt_vacation.vacation_weekend_table` and `\d ttt_vacation.office_period`. If the 3404 D.2 report already has the exact schema, reuse it.

**Fallback:** if qa-1 has no natural cohort for a boundary case (e.g., no employee with originalDate on Feb 29), **create a test holiday** via `POST /api/calendar/v1/calendar` (same technique used in TC-3404-07 — see `tasks/3404/D-test-results.md` D.7).

---

## C.2 Test Cases

Format conventions:
- **Steps** are UI-first; API / DB sub-steps labelled `(API)` / `(DB)`.
- **Screenshots** saved to `tasks/3414/screenshots/NN-description.png` with prefixes `stage-`, `qa1-`, or `tm-`.
- Test cases are numbered in execution order. Hard-pass suite is **TC-01, TC-02, TC-03, TC-04..10 (Group 2), TC-11..14 (Group 3)**. Group 4 is soft-pass.

---

### Group 1 — Bug reproduction / fix verification (dual-env)

#### TC-3414-01 — Stage anchor: reproduce bug

| Field | Value |
|---|---|
| **Precondition** | Stage env reachable. Employee and office match cohort: `originalDate` in current month (or today), `approvePeriod.start` in earlier month (e.g., March for an April original-date). Use `pvaynmaster` / SO Persei (Germany) if the same setup persists, or pick from stage DB. |
| **Steps** | 1. Login to stage as the employee.<br>2. Navigate to `My vacations and days off → Days off`.<br>3. Find the target day-off row; click the edit (pencil) icon.<br>4. "Reschedule event" modal opens; capture screenshot.<br>5. In the datepicker, navigate to the month BEFORE originalDate's month (e.g., March for April originalDate).<br>6. Capture screenshot of the earlier month showing clickable cells. |
| **Expected (pre-fix)** | **Bug visible:** Earlier month's working-day cells are SELECTABLE (not greyed). User can click them. |
| **API check** | `GET /api/ttt/v1/offices/{officeId}/periods/approve` — record `PeriodDTO.start`. Confirm it's earlier than originalDate's month start. |
| **Evidence** | Screenshots `stage-01-daysoff-table.png`, `stage-02-modal-march-enabled.png` |
| **Traces** | R.1, R.3 (bug visible) |

---

#### TC-3414-02 — qa-1 fix verification (same cohort as TC-01)

| Field | Value |
|---|---|
| **Precondition** | qa-1, same employee/office (or functionally equivalent). Build banner = `2.1.26.xxxxx` with commit `c046d88475` included. Pipeline 293668+ green. |
| **Steps** | 1. Login to qa-1 as the employee.<br>2. Navigate to `My vacations and days off → Days off`.<br>3. Click the edit icon for the target day-off.<br>4. Open the "Reschedule event" modal; capture screenshot.<br>5. Navigate to the month BEFORE originalDate's month.<br>6. Capture screenshot. |
| **Expected (post-fix)** | **Fix works:** Earlier month's ALL cells are greyed/disabled. `minDate` banner equals `startOf(originalDate.month)`. Cannot click cells earlier than the 1st of originalDate's month. |
| **API check** | Same as TC-01. |
| **Evidence** | `qa1-01-daysoff-table.png`, `qa1-02-modal-march-disabled.png` |
| **Traces** | R.1, R.3 |

---

#### TC-3414-03 — Exact ticket example reproduced

| Field | Value |
|---|---|
| **Precondition** | qa-1. Either find `pvaynmaster` day-off `07.04.2026` (referenced in ticket) or create one via `POST /api/calendar/v1/calendar`. Approve period for his office starts in March. |
| **Steps** | 1. Login to qa-1 as `pvaynmaster`.<br>2. Open `My vacations and days off → Days off`.<br>3. Click edit on the 07.04.2026 row.<br>4. Open modal; confirm header "Day off date: 07.04.2026".<br>5. Attempt to navigate to March 2026 in the picker.<br>6. Attempt to click 02.03.2026 (the value the bug report captured was accepted).<br>7. Capture screenshot. |
| **Expected** | March days all greyed. Click on 02.03.2026 has no effect. OK button does NOT enable with a March date selected. |
| **Evidence** | `qa1-03-ticket-example-blocked.png` |
| **Traces** | R.1, R.3 |

---

### Group 2 — minDate boundary matrix (qa-1 only)

For each of TC-04 through TC-10 below, the verification template is:
1. Open the modal for a day-off matching the row's `originalDate`.
2. Navigate the datepicker to the expected `minDate`'s month and the month before.
3. Assert: (a) the 1st of the expected minDate month is selectable; (b) all days in the month before are greyed; (c) all days preceding the 1st in the same month (there are none because minDate IS the 1st) are N/A.
4. Screenshot each result as `qa1-NN-TC-3414-NN-{scenario}.png`.

| ID | originalDate scenario | approvePeriod.start scenario | Expected `minDate` | Evidence |
|---|---|---|---|---|
| **TC-3414-04** | **Today** (real-time, mid-day) | 1st of current month (no past open months) | 1st of current month | `qa1-04-today-samemonth.png` |
| **TC-3414-05** | **Yesterday** (past, same month) | 2 months earlier (prior months open) | 1st of originalDate's month | `qa1-05-yesterday-multimonth-open.png` |
| **TC-3414-06** | **1st of current month** (boundary day-off) | 1st of current month (same day) | 1st of current month (same — boundary OK) | `qa1-06-first-of-month.png` |
| **TC-3414-07** | **Last day of previous month** (e.g., Mar 31) | March 1 (March still open) | March 1 | `qa1-07-last-day-prev-month.png` |
| **TC-3414-08** | **~2 months in future** (future originalDate) | Current month.1 (much earlier) | 1st of originalDate's month | `qa1-08-future-originaldate.png` |
| **TC-3414-09** | **Jan 5, current year** | Dec 1, previous year (edge: previous year open) | Jan 1, current year | `qa1-09-year-boundary-jan.png` |
| **TC-3414-10** | **Dec 31, previous year** (old day-off, closed month normally but hypothetical) | Dec 1 | Dec 1 | `qa1-10-year-boundary-dec.png` |

#### TC-3414-04 — originalDate = today, approvePeriod = current month.1

| Field | Value |
|---|---|
| **Precondition** | Find or create a day-off with `originalDate = CURRENT_DATE`. Office's approvePeriod.start ≥ 1st of current month (no past open months). |
| **Steps** | 1. Login as the employee.<br>2. Open the modal.<br>3. (Observation) While the modal is opening, watch for the "loading" frame — does minDate flash an incorrect value? (ST-2 observation).<br>4. In the datepicker, confirm the 1st of current month IS selectable; any day before (previous month) is NOT selectable. |
| **Expected** | `minDate = 01.<currentMonth>.<currentYear>`. No flash of incorrect minDate observed during load. |
| **Traces** | R.1, R.3, ST-2 |

#### TC-3414-05 — originalDate = yesterday, approvePeriod spans past months

| Field | Value |
|---|---|
| **Precondition** | Day-off with `originalDate = CURRENT_DATE - 1`. Office's `approvePeriod.start` is in the 2nd-prior month (e.g., if today is Apr 24 2026, approvePeriod.start = 2026-02-01 — Feb and Mar are still open). |
| **Steps** | 1. Login.<br>2. Open modal.<br>3. Navigate datepicker to Feb, Mar, Apr.<br>4. Assert Feb cells greyed, Mar cells greyed, Apr cells enabled (Apr 1 selectable). |
| **Expected** | `minDate = 01.Apr.2026` (originalDate's month start, NOT approvePeriod's month start). Feb + Mar locked out. |
| **Traces** | R.1, R.3 |

#### TC-3414-06 — Boundary: originalDate = approvePeriod.start = 1st of month

| Field | Value |
|---|---|
| **Precondition** | Create a holiday on `01.05.2026` (future month start) in an office whose approvePeriod.start = 2026-05-01. If no such office exists on qa-1, fall back to the current-month edge. |
| **Steps** | 1. Open modal for this specific day-off.<br>2. In the datepicker, verify May 1 is selectable (it's the day itself, renderDay will grey it via the `isCurrentDayoff` path — that's a different guard, unrelated to minDate). |
| **Expected** | `minDate = 01.05.2026`. April cells all greyed; May 1 is on the boundary and may be greyed (as the original day-off itself) but not because of minDate — because of `renderDay` marking it as `isCurrentDayoff`. |
| **Traces** | R.1 (boundary equality) |

#### TC-3414-07 — originalDate = last day of prior month

| Field | Value |
|---|---|
| **Precondition** | Day-off with `originalDate = 2026-03-31` (or equivalent last-day-of-prior-month on qa-1). Office approvePeriod.start = 2026-03-01 (March open). |
| **Steps** | 1. Open modal.<br>2. Datepicker defaults to March 31.<br>3. Confirm March 1 is selectable. Feb 28 is NOT selectable. |
| **Expected** | `minDate = 01.03.2026`. February locked out. |
| **Traces** | R.1 |

#### TC-3414-08 — originalDate in the future (~2 months ahead)

| Field | Value |
|---|---|
| **Precondition** | Day-off with `originalDate = 2026-06-15` (future). ApprovePeriod.start = 2026-03-01 (much earlier). |
| **Steps** | 1. Open modal.<br>2. Confirm `isOriginalDateAfterPeriod = false` (normal path): `minDate = 01.06.2026`. March, April, May all greyed. |
| **Expected** | `minDate = 01.06.2026`. Prior months locked out. |
| **Traces** | R.1, R.4 |

#### TC-3414-09 — Year boundary: originalDate = Jan 5, approvePeriod = Dec 1 prev year

| Field | Value |
|---|---|
| **Precondition** | Day-off with `originalDate = 2026-01-05` (or the equivalent at test time — adapt to qa-1's clock). Office approvePeriod.start = 2025-12-01 (December open). |
| **Steps** | 1. Open modal.<br>2. Navigate to December 2025 — confirm all cells greyed.<br>3. Confirm January 1 2026 is selectable. |
| **Expected** | `minDate = 01.01.2026`. Dec 2025 locked out. |
| **Traces** | R.1 (year-boundary) |

#### TC-3414-10 — originalDate = Dec 31, approvePeriod = Dec 1

| Field | Value |
|---|---|
| **Precondition** | Day-off with `originalDate = 2026-12-31` (or prior year's Dec 31 if qa-1 clock hasn't reached end of year). ApprovePeriod.start = 2026-12-01. |
| **Steps** | 1. Open modal.<br>2. Confirm December 1 is selectable. November locked out. |
| **Expected** | `minDate = 01.12.2026`. |
| **Traces** | R.1, R.5 (maxDate = 31.12.2026 also verified — should still work) |

---

### Group 3 — #3404 regression (qa-1 only)

#### TC-3414-11 — #3404 CORE: move day-off to earlier date within same month

| Field | Value |
|---|---|
| **Precondition** | Day-off with `originalDate` mid-current-month (e.g., Apr 15 if today is Apr 24); office's approvePeriod covers current month. Day-off status = `NEW` or has an edit icon. |
| **Steps** | 1. Login.<br>2. Open modal for this day-off.<br>3. Navigate datepicker to the same month.<br>4. Click an earlier date in the same month (e.g., Apr 3).<br>5. Click OK.<br>6. Verify the row now shows `15.04.2026 (tu) → 03.04.2026 (fr)`. |
| **Expected** | Transfer is created successfully. The #3404 feature (backward within same month) is preserved. |
| **API check** | `GET /v1/employee-dayoff/{id}` — `personalDate` is updated to the earlier date. |
| **Evidence** | `qa1-11-3404-backward-samemonth.png` |
| **Traces** | R.4 — core #3404 preserved |

#### TC-3414-12 — Edit icon visible on past open-period day-off

| Field | Value |
|---|---|
| **Precondition** | Day-off with `originalDate` in a past-but-still-open approve period (approvePeriod.start ≤ originalDate ≤ today). |
| **Steps** | 1. Login.<br>2. Open Days off tab.<br>3. Locate the day-off row in the table.<br>4. Verify pencil icon is visible in the Actions column. |
| **Expected** | Pencil icon rendered. (Re-execution of TC-3404-05 with a current cohort.) |
| **Traces** | R.4 |

#### TC-3414-13 — Edit icon hidden for closed-month day-off

| Field | Value |
|---|---|
| **Precondition** | Day-off with `originalDate` strictly earlier than `approvePeriod.start`. |
| **Steps** | 1. Open Days off tab.<br>2. Locate the row.<br>3. Confirm NO pencil icon. |
| **Expected** | Pencil icon absent. (Re-execution of TC-3404-09 behaviour.) |
| **Traces** | R.4 |

#### TC-3414-14 — Datepicker: closed-month days disabled

| Field | Value |
|---|---|
| **Precondition** | Any day-off with an edit icon, AND the office has at least one closed approve period earlier than `approvePeriod.start`. |
| **Steps** | 1. Open modal.<br>2. Navigate to months earlier than `approvePeriod.start`.<br>3. Confirm all cells are greyed. |
| **Expected** | Fully-greyed months for all closed periods. (Re-execution of TC-3404-04/05 behaviour.) |
| **Traces** | R.3, R.4 |

---

### Group 4 — General day-off flows (qa-1 smoke — soft pass)

#### TC-3414-15 — Create → manager approves → DB reflects

| Field | Value |
|---|---|
| **Precondition** | Test employee + manager pair. Test employee has a day-off with edit icon. |
| **Steps** | 1. Employee creates a transfer (e.g., 15.04 → 03.04).<br>2. Logout; login as manager.<br>3. Manager opens Approval → Postponements of weekends tab.<br>4. Manager approves the request.<br>5. (DB) query `ttt_vacation.vacation_weekend_table` — verify row status updated. |
| **Expected** | Transfer row status is `APPROVED`. Vacation-days ledger entries recorded. |
| **Traces** | General day-off flow |

#### TC-3414-16 — Create → manager rejects → day-off reverts

| Field | Value |
|---|---|
| **Precondition** | Same cohort as TC-15. |
| **Steps** | 1. Employee creates transfer.<br>2. Manager rejects.<br>3. Verify Days off tab shows original date, no pending transfer. |
| **Expected** | Row reverts to pre-transfer state. No entry on personalDate. |
| **Traces** | General day-off flow |

#### TC-3414-17 — Delete pending transfer

| Field | Value |
|---|---|
| **Precondition** | Employee has a NEW / pending transfer. |
| **Steps** | 1. Employee clicks the Cancel / Delete icon on the pending transfer row.<br>2. Confirm dialog.<br>3. Verify row reverts. |
| **Expected** | Transfer deleted; no email fired. |
| **Traces** | General day-off flow |

#### TC-3414-18 — Approval email notification delivered (Roundcube)

| Field | Value |
|---|---|
| **Precondition** | TC-15 completed (manager approved). |
| **Steps** | 1. Open Roundcube mailbox at `https://dev.noveogroup.com/mail` (via `roundcube-access` skill).<br>2. Search for emails with subject prefix `[QA-1]` and containing "day off" or "rescheduling" keywords, sent in the last 15 minutes.<br>3. Inspect body: employee name, dates, approver. |
| **Expected** | At least 1 email delivered to the approver's mailbox with correct dates and names. |
| **Evidence** | `tasks/3414/artifacts/approval-email-TC18.eml` (saved from Roundcube). |
| **Traces** | General day-off flow |

---

## C.3 Stage / qa-1 Matrix

| TC | qa-1 | stage (anchor) |
|---|---|---|
| TC-3414-01 | — | ✅ reproduce bug |
| TC-3414-02 | ✅ verify fix | — |
| TC-3414-03 | ✅ ticket example | — |
| TC-3414-04 .. TC-3414-10 | ✅ boundary matrix | — |
| TC-3414-11 .. TC-3414-14 | ✅ #3404 regression | — |
| TC-3414-15 .. TC-3414-18 | ✅ general smoke | — |

Stage runs are evidence anchors only — pass/fail on stage means "bug existed". Stage outage falls back to ticket-screenshot + DB evidence per 3427 D.1 precedent.

---

## C.4 Tooling Recipe

| Action | MCP / skill |
|---|---|
| UI navigation, login, screenshots | `mcp__playwright-vpn__browser_*` (VPN required) |
| Cohort DB discovery on qa-1 | `mcp__postgres-qa1__execute_sql` against `ttt_vacation` schema |
| Cohort DB discovery on stage | `mcp__postgres-stage__execute_sql` |
| Vacation API on qa-1 | `mcp__swagger-qa1-vacation-default__get-employee-time-offs-using-get`, `…ptch-using-ptch-1` (if needed — UI-only decision stands) |
| Calendar holiday insertion (if needed) | `mcp__swagger-qa1-ttt-api__crt-using-pst-*` — specifically the calendar event creation endpoint |
| Build banner + pipeline | `gitlab-access` skill — pipeline ID 293668+ on `release/2.1` |
| Backend logs | `graylog-access` skill → stream `TTT-QA-1`, search for 500 / NullPointerException / DayOff |
| Email verification | `roundcube-access` skill — mailbox `vulyanov@office.local` @ dev.noveogroup.com |
| Filing regression bugs (only with user confirmation) | `gitlab-task-creator` skill |

---

## C.5 Pass / Fail Criteria

**Hard pass (block ship if any fail):**
- TC-3414-01, 02, 03 — bug repro + fix verification dual-env
- TC-3414-04 through 10 — all 7 boundary matrix rows
- TC-3414-11 through 14 — #3404 regression preserved

**Soft pass:**
- TC-3414-15 through 18 — general day-off smoke; any FAIL logged as separate ticket with LOW severity

**Conditional ship:**
- FAIL on TC-3414-18 (email) if environment / Roundcube issue rather than code regression — separate investigation, doesn't block #3414.

**Carry-forward findings** (not blocking, document in Stage D.5):
- #3404 GAP-1 (edit-icon `>` vs `>=`)
- #3404 BUG-DO-4 (backend accepts arbitrary personalDate) — confirmed by ticket screen 3
- ST-2 (null-safety implicit `moment(undefined)` dependency) — recommend follow-up ticket
- ST-3 (`isOriginalDateAfterPeriod` misnomer) — doc-only, cosmetic
