# Stage A: Requirements Analysis — #3414

**Ticket:** [#3414](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3414) — `[Bug] [Days off] A day off can be moved to a month earlier than the month of the original date`
**Reporter:** Vladimir Ulyanov · 2026-04-08
**Assignee:** Vladimir Ulyanov (testing) · previously Ilya Shumchenko (dev)
**Branch under test:** `release/2.1` (HEAD `7556b3525f`, qa-1 post-fix)
**Reference branch:** `stage` deployment — pre-fix snapshot of `release/2.1` (before `05080a9d71`)
**Labels:** `Ready to Test`, `Sprint 16`
**Related:** #3404 (marked related 2026-04-08) — prior ticket in the same code path
**Date:** 2026-04-24

---

## A.0 Ping-Pong History — minDate of TransferDaysoffModal

Commits to `frontend/frontend-js/src/modules/vacation/components/transferDaysoff/TransferDaysoffModal.tsx` on `release/2.1`, newest first.

| # | Date | Commit | Subject | Change (abbrev.) |
|---|------|--------|---------|------------------|
| **#3414 B** | 2026-04-22 08:39 | `c046d88475` | fix (cleanup) | **Remove `isBeforeCurrentDay` branch + console.log;** collapse to single formula `minDate = moment(…).startOf('month')` |
| **#3414 A** | 2026-04-22 08:09 | `05080a9d71` | fix (initial) | Add console.log debug; provisional simplified formula |
| #3404 final | 2026-04-07 12:46 | `d078650ff1` | relaxation — final | Add `isOriginalDateAfterPeriod` fallback branch. `isBeforeCurrentDay` still short-circuits to `moment(approvePeriod?.start)` **without** `.startOf('month')` — this is what #3414 later fixes. |
| #3404 earlier | 2026-03-24 .. 2026-04-07 | `fbcc0f2a05` .. `729088ca05` (6 commits) | relaxation — iterative | First migrated from `moment().subtract(1,'d')` to `approvePeriod`-aware minDate; transitioned from `useSelector(selectApprovePeriod)` to `useGetOfficePeriodApprove(office.id)` hook; refined the visibility condition in `useWeekendTableHeaders.tsx` |

**Why #3414 exists:** #3404's last commit (d078650ff1) introduced the `isBeforeCurrentDay` branch to accommodate past originalDates. That branch bypassed `.startOf('month')` — allowing minDate to land mid-month at `approvePeriod.start`, and therefore permitting the user to pick days in months **earlier** than originalDate's month. #3414 is a one-line structural fix that removes the broken branch and always floors via `.startOf('month')`.

The #3404 QA (`tasks/3404/B-static-testing.md` ST-3, `tasks/3404/D-test-results.md` GAP-2) **predicted** this exact class of bug but classified it as "not observable — periods align with month boundaries". The current ticket proves it was observable after all — on 2026-04-07 the approve period for Persei (Germany) was `2026-03-01`, strictly before originalDate `07.04.2026`, exposing the missing `.startOf('month')`.

---

## A.1 Bug Summary (verbatim from ticket)

> `My vacations and days off > Days off`
>
> It is possible to create day-off transfer request to **any open period in the past** when original date of day-off = **current date** (real time): dates are not disabled in date-picker.
>
> **Example:**
>
> qa-1, `pvaynmaster` (SO Persei), day-off with original date = current date in real time (07.04.2026) can be transferred to past open period (March), because March is available in date-picker
>
> [screen1, screen2, screen3]
>
> **Expected:**
>
> Dates earlier than **1st day of the month of original date** must be disabled for selection in date-picker (even for open payment periods).
>
> **Note:** Fix postponed because case looks rare
>
> **Env:** `qa-1` → `all` (Sprint15 release)

### Attached Screenshots (downloaded to `tasks/3414/artifacts/`)

| File | What it shows |
|---|---|
| `3414-desc-screen1.png` | Germany production calendar for 2026, with `07.04.2026 → Test1` highlighted as the holiday used for the demo. Confirms `originalDate = 07.04.2026`. |
| `3414-desc-screen2.png` | Reschedule-event modal with title "Day off date: 07.04.2026" and the datepicker opened on **March 2026**. All Mon-Fri March cells are selectable (not greyed). This is the bug. |
| `3414-desc-screen3.png` | Left: "My vacations and days off" — a created transfer `07.04.2026 (tu) → 02.03.2026 (mo)`, status **New**, approver Pavel Weinmeister. Proves the backend accepts the out-of-month personalDate. Right: "Changing periods — Salary offices" — Persei row: "Reporting hours starting from **April 2026**" (i.e., March is the earliest still-open period → `approvePeriod.start = 2026-03-01`). |

---

## A.2 Requirements

| Req | Description | Pre-fix behaviour (stage) | Post-fix behaviour (qa-1) |
|-----|-------------|--------------------------|---------------------------|
| **R.1** Normal-path `minDate` | For a day-off whose `originalDate ≥ approvePeriod.start` | `minDate = approvePeriod.start` (or `originalDate.startOf('month')`, conditional on `isBeforeCurrentDay`) — inconsistent; can fall below `originalDate.startOf('month')` | `minDate = moment(originalDate).startOf('month')` — always |
| **R.2** Fallback-path `minDate` | For a day-off whose `originalDate < approvePeriod.start` (edge: rare; edit icon usually hidden by #3404 guard) | `minDate = approvePeriod.start` (raw) | `minDate = moment(approvePeriod.start).startOf('month')` |
| **R.3** Datepicker UX | — | Earlier months (e.g., March) clickable when they shouldn't be | All days strictly before `minDate` are visibly greyed/disabled |
| **R.4** #3404 feature preserved | User can move day-off to **earlier dates within the SAME month as originalDate** when that month is open | Works (core #3404 feature) | Still works (no regression) |
| **R.5** `maxDate` unchanged | `maxDate = moment(originalDate.format('YYYY')).add(1,'y').subtract(1,'d')` — Dec 31 of originalDate's year | Unchanged | Unchanged |

**Out of scope (explicitly):**

- Backend-side validation of `personalDate` — the screenshot evidence (screen3) confirms the backend accepted `02.03.2026` despite being earlier than `originalDate`'s month. This is a carry-over gap from #3404 (see `tasks/3404/D-test-results.md` — noted as "backend bypasses frontend constraint"). This ticket is **frontend-only** per the dev's scope decision.
- `isOriginalDateAfterPeriod` variable naming (is a misnomer). Doc-only finding in Stage B.
- Pre-existing `>` vs `>=` boundary in `useWeekendTableHeaders.tsx` (GAP-1 from #3404) — not touched here; will stay flagged in Stage B.
- DST / leap-year / year-boundary analytical assessment only in Stage B (per user decision — no live timemachine runs).

---

## A.3 Field Semantics

### Backend → Frontend mapping

`approvePeriod` is fetched via React Query:

```ts
// frontend/frontend-js/src/modules/admin/services/api/offices.ts:47
export const useGetOfficePeriodApprove = (officeId: number) => {
  const queryKey = ['employee', 'office', officeId, 'approvePeriod'];
  return useQuery({
    queryKey,
    queryFn: async () => rest.get<PeriodDTO>(`/v1/offices/${officeId}/periods/approve`),
  });
};
```

`PeriodDTO` shape (vacationPayment/.../types.ts):

```ts
export interface PeriodDTO {
  start: DateFormatAPI;       // ISO date string, e.g. "2026-03-01"
  type: PeriodType;           // REPORT | APPROVE
}
```

**Important:** `approvePeriod` is `undefined` while the React Query call is in-flight (first render after the modal opens). `moment(undefined)` returns the current time. In the post-fix code path, this means `isOriginalDateAfterPeriod = now.isAfter(originalDate)` — behaves like the old `isBeforeCurrentDay`. For a past `originalDate`, the formula then evaluates:

```
minDate = moment(approvePeriod?.start).startOf('month')
        = moment(undefined).startOf('month')
        = startOf(today.month)
```

which is the 1st of the current month — safe degradation. For a future `originalDate`, the formula evaluates to:

```
minDate = moment(originalDate).startOf('month')
```

which is also correct. So **null-safety is preserved in practice**, but the dependency on `moment(undefined) === now` is implicit — flagged in Stage B as ST-2.

### Constants / boundaries

| Construct | Definition | Notes |
|---|---|---|
| `originalDate: Moment` | Prop. The holiday date the employee worked. | Not null by TypeScript. |
| `approvePeriod?.start: string` | React Query result — earliest open approve period for the office. | `undefined` until fetch resolves. |
| `isOriginalDateAfterPeriod` | `moment(approvePeriod?.start).isAfter(moment(originalDate))` | **Misnomer:** actually "is original date BEFORE period start" (ST-3). |
| `maxDate` | `moment(originalDate.format('YYYY')).add(1,'y').subtract(1,'d')` | Dec 31 of originalDate's year — unchanged by #3414. |

---

## A.4 Code Change Analysis

### MRs merged into `release/2.1`

| MR | Merged | Merge commit | Source branch | Commits |
|----|--------|--------------|---------------|---------|
| [!5416](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5416) | 2026-04-22 08:09 | `97d6326414` | `ishumchenko/#3414-...` | `05080a9d71` (initial) |
| [!5417](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5417) | 2026-04-22 08:39 | `9b55988748` | `ishumchenko/#3414-...-1` | `c046d88475` (cleanup) |

Latest `release/2.1` HEAD on origin: `7556b3525f` (master→release/2.1 merge 2026-04-24). qa-1 pipeline 293668 green.

### Combined diff (pre-fix → post-fix)

```diff
- const isBeforeCurrentDay = moment().isAfter(moment(originalDate));
  const isOriginalDateAfterPeriod = moment(approvePeriod?.start).isAfter(
    moment(originalDate),
  );
  …
  <Field
    …
    component={DatepickerFormik}
-   minDate={
-     isBeforeCurrentDay
-       ? moment(approvePeriod?.start)
-       : moment(
-           isOriginalDateAfterPeriod
-             ? approvePeriod?.start
-             : originalDate,
-         ).startOf('month')
-   }
+   minDate={moment(
+     isOriginalDateAfterPeriod ? approvePeriod?.start : originalDate,
+   ).startOf('month')}
    maxDate={maxDate}
    …
  />
```

### Scope envelope

| Aspect | Scope |
|---|---|
| Changed files | 1 (`TransferDaysoffModal.tsx`) |
| Lines changed | +3 / −12 (across two commits) |
| Backend changes | None |
| DB migrations | None |
| Translation keys | None added / modified |
| PropTypes / TS types | Unchanged (TS interface `TransferDaysoffModalProps` unchanged) |
| Tests | None added in the MRs |
| Other consumers of `isBeforeCurrentDay` | None (grep on `origin/release/2.1` confirms zero references after the removal) |

### Truth table for the post-fix formula

| Case | originalDate | approvePeriod.start | `isOriginalDateAfterPeriod` | `minDate` |
|---|---|---|---|---|
| A | 07.04.2026 | 01.03.2026 | false (period.start < originalDate) | `moment(originalDate).startOf('month')` = **01.04.2026** |
| B | 07.04.2026 | 01.04.2026 | false | **01.04.2026** |
| C | 01.04.2026 | 01.04.2026 | false (equal, not strict after) | **01.04.2026** |
| D | 15.03.2026 | 01.04.2026 | true (period.start > originalDate) | `moment(approvePeriod.start).startOf('month')` = **01.04.2026** |
| E | 15.04.2026 | undefined (loading) | `now.isAfter(originalDate)` ≈ depends; see ST-2 | fallback to `moment(undefined).startOf('month')` = 1st of current month |
| F | 31.12.2026 | 01.12.2026 | false | **01.12.2026** |
| G | 05.01.2026 | 01.12.2025 | false | **01.01.2026** |

Case A is the exact ticket reproduction. Case D is the rare fallback branch (originalDate predates the current approve period — edit icon normally hidden by the `>=` guard in `useWeekendTableHeaders.tsx`, so the modal would not open in practice).

---

## A.5 Open Questions / Risks

- **Q1** (ST-2 in Stage B): `approvePeriod` is `undefined` on first render. `moment(undefined)` = now. Does this cause a visible flash / race where the picker briefly shows an incorrect minDate? Needs observation in Stage D.
- **Q2** (ST-3 in Stage B): Variable name `isOriginalDateAfterPeriod` is misleading — documentation-only finding, no functional impact.
- **Q3** (carry-over from #3404 GAP-1): Edit-icon visibility still uses `>` not `>=` in `useWeekendTableHeaders.tsx`. Not fixed by #3414. Should we re-open #3404 or file a separate ticket? Out of scope for #3414 testing; flag only.
- **Q4** (carry-over from #3404): Backend accepts arbitrary `personalDate` (screen3 shows the transfer was created with `02.03.2026`). Frontend is the only gate. Out of scope per user decision — logged as analytical finding.
- **Q5** (stage env): Is stage currently running a commit prior to `05080a9d71` (i.e., pre-#3414) so we can reproduce the bug for anchor screenshots? Will verify in Stage D.1.
- **Q6** (cohort): We need an employee with `originalDate` in the current month (or yesterday) AND office whose approve period starts in a prior month. SQL cohort query is planned in Stage D.2. In the worst case, we create a test holiday via `POST /api/calendar/v1/calendar` on a test office — same technique used in #3404 TC-07.
- **Q7** (autotest coverage): The 21-spec t3404 suite at `autotests/e2e/tests/t3404/` must still be green after #3414 (Stage E.1). No new specs are in scope for #3414 unless a blocking bug is found.
