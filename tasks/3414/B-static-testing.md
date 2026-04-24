# Stage B: Static Testing — #3414

**Ticket:** [#3414](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3414)
**MRs:** [!5416](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5416) (initial + debug) + [!5417](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5417) (cleanup) — both merged
**Commits under test:** `05080a9d71` + `c046d88475` on `release/2.1` (HEAD `7556b3525f`)
**Scope:** Frontend-only · 1 file · +3 / −12 lines net
**Date:** 2026-04-24

---

## B.1 Diff Review

### ST-1 — Semantic correctness (PASS)

**File:** `frontend/frontend-js/src/modules/vacation/components/transferDaysoff/TransferDaysoffModal.tsx:128-131`

```tsx
minDate={moment(
  isOriginalDateAfterPeriod ? approvePeriod?.start : originalDate,
).startOf('month')}
```

The post-fix formula is **monotonically bounded below** by `startOf('month')` in both branches. Truth table (Stage A §A.4 Case A–G):

| Input `originalDate` | Input `approvePeriod.start` | `isOriginalDateAfterPeriod` | Output `minDate` | Bounded by originalDate.month? |
|---|---|---|---|---|
| 07.04.2026 | 01.03.2026 (earlier) | false | `originalDate.startOf('month')` = 01.04.2026 | ✅ |
| 07.04.2026 | 01.04.2026 (same month) | false | 01.04.2026 | ✅ |
| 15.03.2026 | 01.04.2026 (later — rare) | true | `approvePeriod.start.startOf('month')` = 01.04.2026 | ≥ originalDate.month ✅ |
| 31.12.2026 | 01.12.2026 | false | 01.12.2026 | ✅ |
| 05.01.2026 | 01.12.2025 | false | 01.01.2026 | ✅ |

The guarantee **"minDate ≥ startOf(max(originalDate.month, approvePeriod.start.month))"** holds for all cases. This is exactly the R.1 + R.2 requirement.

**Verdict:** PASS. Verified by TC-3414-01/02/03 (dual-env) and TC-3414-04..10 (boundary matrix).

---

### ST-2 — Null/undefined safety of `approvePeriod` (PASS-with-note)

`useGetOfficePeriodApprove` is a React Query hook (`offices.ts:47`). Its `data` is `undefined` on first render until the HTTP GET resolves. Therefore `approvePeriod?.start` can be `undefined`, and `moment(undefined)` returns the current instant.

Two positions consume `approvePeriod?.start`:

1. **`isOriginalDateAfterPeriod` definition** (line 52):
   ```ts
   const isOriginalDateAfterPeriod = moment(approvePeriod?.start).isAfter(moment(originalDate));
   ```
   When `approvePeriod` is undefined, this becomes `now.isAfter(originalDate)` — effectively the old `isBeforeCurrentDay`.

2. **Inside `minDate`** (line 128):
   ```ts
   minDate={moment(isOriginalDateAfterPeriod ? approvePeriod?.start : originalDate).startOf('month')}
   ```
   If `isOriginalDateAfterPeriod = true` (past originalDate) AND `approvePeriod = undefined`, then `minDate = moment(undefined).startOf('month')` = **1st of current month**.

**Runtime scenarios:**

| Render phase | originalDate | `approvePeriod` | `isOriginalDateAfterPeriod` | `minDate` | Safe? |
|---|---|---|---|---|---|
| Loading (1st frame) | 07.04.2026 (past from today 24.04) | `undefined` | `now.isAfter(07.04)` = true | `moment(undefined).startOf('month')` = 1st of April | ✅ |
| Loading (1st frame) | 30.05.2026 (future) | `undefined` | `now.isAfter(30.05)` = false | `moment(originalDate).startOf('month')` = 01.05.2026 | ✅ |
| Loaded | 07.04.2026 | `{start: '2026-03-01'}` | false | 01.04.2026 | ✅ |

The behaviour is **safe in practice** — the "loading" branch produces the same or a later minDate than the "loaded" branch. No harmful earlier-date selection is possible.

However the code has an **implicit silent dependency** on `moment(undefined) === now`. A future dev who refactors `moment(undefined)` semantics (e.g., moving to Luxon / date-fns, or adding a `|| null` guard) could silently regress the loading-phase behaviour.

**Outstanding risk:** If the React Query cache pre-populates for the SAME office from a prior component mount (likely — `queryKey = ['employee', 'office', officeId, 'approvePeriod']`), there is no "loading" frame at all, so this is mostly theoretical. Still worth documenting.

**Verdict:** PASS-with-note. Recommend a follow-up issue: "add explicit guard `if (!approvePeriod) return null` before rendering the datepicker, or render a Loading state". Not blocking.

---

### ST-3 — `isOriginalDateAfterPeriod` is a misnomer (WARN, doc-only)

```ts
const isOriginalDateAfterPeriod = moment(approvePeriod?.start).isAfter(moment(originalDate));
```

The variable reads "originalDate after period" but the comparison `approvePeriod.start.isAfter(originalDate)` means `approvePeriod.start > originalDate` — i.e., "originalDate is **before** the period start". Correct name would be `isOriginalDateBeforePeriod`.

No functional impact; pure naming / readability defect. Recommend a rename in a follow-up commit (low priority).

**Verdict:** WARN (doc-only). Not blocking.

---

### ST-4 — Removed `isBeforeCurrentDay` variable, grep clean (PASS)

```bash
git grep -n "isBeforeCurrentDay" origin/release/2.1
# → no results (fully removed)
```

No dangling references remain. The variable was local to `TransferDaysoffModal.tsx`; no other file consumed it. `renderDay`, `maxDate`, Formik `defaultValue`, the Dialog structure, and all other fields in the file are **unchanged**.

**Verdict:** PASS.

---

### ST-5 — DST / leap-year / year-boundary (analytical PASS)

`moment(…).startOf('month')` is a calendar operation — it sets `date = 1`, `hour = 0`, `minute = 0`, `second = 0`, `millisecond = 0` in the **local timezone** of the moment object. It does **not** interact with DST transitions (which happen on specific days, not on day-1 of any month in most jurisdictions).

**Edge cases considered:**

| Case | Behaviour | Safe? |
|---|---|---|
| `originalDate = 29.02.2028` (leap day, not in range of current QA) | `startOf('month')` = 01.02.2028 | ✅ |
| `originalDate = 05.01.2026` (year boundary), `approvePeriod.start = 01.12.2025` | `isOriginalDateAfterPeriod = false` → `minDate = 01.01.2026` | ✅ (previous year December correctly excluded) |
| `originalDate = 31.12.2026`, `approvePeriod.start = 01.12.2026` | `minDate = 01.12.2026` | ✅ |
| `originalDate = 30.03.2026` (DST day in most of Europe 2026) | `startOf('month')` uses calendar rules, not clock rules → `01.03.2026 00:00` local | ✅ |
| Moment deprecation of `moment()` string parsing without format | Not triggered here — inputs are already Moment objects via TypeScript type | ✅ |

Per the user decision, no live timemachine runs for DST / leap. Analytical-only assessment; risk is low.

**Verdict:** PASS (analytical).

---

### ST-6 — Pre-existing issues from #3404 carried forward (INFO / not blocking)

The following **pre-existing defects** from `tasks/3404/D-test-results.md` remain in the codebase and are **not addressed** by #3414:

| ID | File / line | Issue | Severity | Status after #3414 |
|----|-------------|-------|----------|--------------------|
| #3404 GAP-1 | `useWeekendTableHeaders.tsx` | Edit-icon visibility uses `lastApprovedDate > approvePeriod` (strict `>`) — off-by-one when `lastApprovedDate === approvePeriod.start` | MEDIUM | Still present. Not touched. |
| #3404 BUG-DO-4 | backend (service layer) | API accepts arbitrary `personalDate`; no server-side validation that it falls ≥ 1st-of-originalDate's-month | MEDIUM | Still present. screen3 in the ticket proves the backend created the transfer `07.04 → 02.03` (backward across month boundary) — i.e., frontend is the only gate. |
| #3404 ST-3 / GAP-2 | `TransferDaysoffModal.tsx` (this file) | "minDate uses approvePeriod not 1st-of-original-month" — flagged but marked "not observable" | MEDIUM | **Resolved by #3414.** |

**Verdict:** Carry-forward only. No action required for #3414 sign-off; recommend separate tickets (or re-open #3404) to address GAP-1 and BUG-DO-4.

---

### ST-7 — Backend validation audit (analytical, not dynamic per user decision)

Per ticket screen 3 and #3404 BUG-DO-4: the backend (`employee-dayOff` service) accepts any `personalDate` the frontend submits. The endpoint is `PATCH /api/vacation/v1/employee-dayoff/{id}` (or POST for new transfer).

There is **no known server-side range check** that `personalDate` must fall within `[startOf(originalDate.month), maxDate]`. The Swagger MCP for `vacation` on qa-1 (`mcp__swagger-qa1-vacation-default__ptch-using-ptch-1`) can be used to probe this — but per user decision, **UI-only verification for #3414**.

**Implication:** A power user with dev tools or a direct API client can still bypass the frontend constraint. This is a **known gap**; the fix scope of #3414 does not address it.

**Verdict:** Not blocking for #3414 (scope limited). Recommend filing a separate backend ticket.

---

### ST-8 — Regression surface / collateral scan (PASS)

Files that reference `approvePeriod` (the variable bound by `useGetOfficePeriodApprove`) OR `isOriginalDateAfterPeriod`:

```bash
git grep -n "approvePeriod\|isOriginalDateAfterPeriod" origin/release/2.1 -- frontend-js
```

Relevant hits (display only; non-trivial):

| File | Usage | Impacted by #3414? |
|---|---|---|
| `vacation/components/transferDaysoff/TransferDaysoffModal.tsx` | THIS FILE — minDate formula | **Yes** (the fix) |
| `vacation/components/userVacations/WeekendTab.tsx` | `const { data: approvePeriod } = useGetOfficePeriodApprove(office.id)` — passes down as prop | No — doesn't consume `minDate` logic; just passes the value through to the modal |
| `vacation/components/userVacations/useWeekendTableHeaders.tsx` | Uses `approvePeriod` to decide edit-icon visibility (`>` operator — GAP-1) | No — unchanged by #3414 |

`isBeforeCurrentDay`: zero hits post-fix (confirmed in ST-4).

**Verdict:** PASS. Fix is fully contained to the `minDate` prop of the `Field` in `TransferDaysoffModal`. No other component or saga consumes the removed variable.

---

## B.2 Component-Stack Impact Assessment

| Component | File | Change in #3414? | Verifying TC |
|---|---|---|---|
| `TransferDaysoffModal` | `…/transferDaysoff/TransferDaysoffModal.tsx` | **Yes** (1 prop, 1 line-removal) | TC-3414-01..10, 14 |
| `useGetOfficePeriodApprove` | `…/admin/services/api/offices.ts` | No | Indirect — all TCs depend on this hook resolving |
| `useWeekendTableHeaders` | `…/userVacations/useWeekendTableHeaders.tsx` | No (GAP-1 carry-over) | TC-3414-12, 13 (edit-icon visibility) |
| `WeekendTab` | `…/userVacations/WeekendTab.tsx` | No (just propagates) | TC-3414-14 (closed-month disable) |
| Formik `DatepickerFormik` (shared) | `@common/services/formHelpers/formikDatepicker` | No (consumes `minDate` unchanged) | Integration-level via all picker TCs |
| Vacation module sagas | `…/ducks/myVacation/sagas.js` | No | TC-3414-15..18 (flow-level regression) |

No other component is touched. The collateral scan is clean.

---

## B.3 Static Testing Verdict

| Severity | Findings | Status |
|---|---|---|
| BLOCKER | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 1 (ST-2 — null-safety implicit dependency on `moment(undefined) === now`) | PASS-with-note; follow-up recommended |
| LOW | 2 (ST-3 `isOriginalDateAfterPeriod` misnomer, ST-6 pre-existing carry-over from #3404) | Doc-only / carry-over; not blocking |
| INFO | 4 (ST-1, ST-4, ST-5, ST-7, ST-8) | PASS |

**Static verdict:** ✅ **PASS — proceed to dynamic testing.**

The fix is surgically scoped (1 file, 1 prop), semantically correct (always floors to `startOf('month')`), and has zero collateral impact on adjacent components. The only risks are pre-existing (not 3414-introduced) and explicitly out of scope per user decision.

Two prior-ticket regression concerns require dynamic confirmation:
- **#3404 core feature preserved** — user can still move day-off to earlier dates within same month (TC-3414-11, TC-3414-14).
- **Null-safety ST-2** — Observe no visible flash of incorrect minDate during the React Query loading frame (TC-3414-04 / observation).

Proceed to Stage C.
