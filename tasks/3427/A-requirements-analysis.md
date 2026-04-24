# Stage A: Requirements Analysis — #3427

**Ticket:** [#3427](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3427) — `[Bug] [Vacations] Incorrect value of remaining amount till year-end in Events feed`
**Reporter:** Irina Malakhovskaia · 2026-04-22
**Assignee:** Vladimir Ulyanov
**Branch under test:** `hotfix/sprint-15` (HEAD `a68a067`)
**Reference branch:** `release/2.1` (deployed to `stage`, pre-fix)
**Labels:** `HotFix Sprint 15`, `Ready to Test`
**Related:** #3373 (parent — vacation-days discrepancy investigation)
**Date:** 2026-04-23

---

## A.0 Ping-Pong History — Critical Risk Banner

This single line of `VacationEventsModal.js` has been flipped four times in five months. Each prior fix regressed a different cohort. **Regression coverage is mandatory** for Stage D sign-off.

| # | Date | Direction | Rationale |
|---|------|-----------|-----------|
| #3355 | 2025-12-12 | `currentYear` → `availablePaidDays` | "[Bug][Vacation] System incorrectly adds vacation balance days to user on maternity leave" |
| #3357 | 2025-12-16 | `availablePaidDays` → `currentYear` | "[Bug][Vacation] EV=False. Incorrect value of current balance days in case of next year vacation using days from current year" |
| #3361 | 2026-01-28 | `currentYear` → `availablePaidDays` | "[Bug][Vacations] AV=True. Incorrect multi-year balance days distribution in cases of transition from the current year to the next" — also touched `UserVacationsPage.js:102` |
| **#3427** | 2026-04-22 | **`availablePaidDays` → `currentYear`** | **This fix.** Only the modal — `UserVacationsPage.js:102` is unchanged (still `availablePaidDays`). |

---

## A.1 Bug Summary (verbatim from ticket, translated)

> **Env:** Prod, Stage
>
> In the **Vacation Events feed** `Remaining days till year-end` is not equal to the sum of remainders for current and past periods, and also not equal to the corresponding value on the vacations page:
>
> [screenshot 1]
>
> Probably observed only for users with `AV=false`, since for user `pvaynmaster` with `AV=true` there is no discrepancy. But worth checking.
>
> [screenshot 2]

### Screenshot Evidence (saved under `artifacts/`)

| File | User | AV | What it shows |
|---|---|---|---|
| `artifacts/3427-description-screenshot1-discrepancy.png` | Irina Malakhovskaia | false | Page "Available" = **12**, Page "Expected remaining by year-end" = **28**; Modal "Remaining days till year-end" = **12** ❌; Tooltip 2025=4, 2026=24 (sum 28) |
| `artifacts/3427-description-screenshot2-comparison.png` | Pavel Weinmeister (`pvaynmaster`) | true | Page "Vacation days balance" = **33**; Modal "Annual vacation days left" = **33** ✓; Tooltip 2025=9, 2026=24 (sum 33) |

For Irina the modal value (12) matched the *currently usable* number, not the *projected year-end* number the label promises. For Pavel the two values converge by formula (see A.3) so no discrepancy was visible.

---

## A.2 Requirements Summary

| Req ID | Description | AS IS | TO BE |
|--------|-------------|-------|-------|
| **R.1** | Value rendered at `VacationEventsModal.js:120` | `userVacationDays.availablePaidDays` (post-FIFO max-usable-now) | `userVacationDays.currentYear` (year-end projection — backend `availableDays`) |
| **R.2** | Modal "Remaining days till year-end" matches the per-year tooltip sum | Diverges for AV=false (label = 12, sum = 28) | Equal for both AV branches |
| **R.3** | Modal value matches "Expected remaining by year-end" on the parent UserVacationsPage (AV=false only — block hidden for AV=true) | Diverges for AV=false (modal = 12, page = 28) | Equal |
| **R.4** | AV=true users — no regression vs the #3361 fix | Modal = page = tooltip sum (33 = 33 = 33) | Preserved |
| **R.5** | UX side-effects — tooltip per-year breakdown, footer table totals, console warnings | All correct | Unchanged |

---

## A.3 Field Semantics Reference

### Backend → Frontend Mapping

Source: `frontend/frontend-js/src/modules/vacation/ducks/myVacation/reducer.ts:169–180` (`handleSetUserVacationDays`).

```js
[USER_VACATION_DAYS]: daysObject && {
  currentYear:                safeToFixed(daysObject.availableDays),          // ← key mapping
  nextYear:                   safeToFixed(daysObject.nextYearAvailableDays),
  reserved:                   safeToFixed(daysObject.reservedDays),
  daysLimitation:             daysObject.daysLimitation,
  pastPeriodsAvailableDays:   safeToFixed(daysObject.pastPeriodsAvailableDays),
  normForYear:                safeToFixed(daysObject.normForYear),
  availableDays:              safeToFixed(daysObject.availableDays),
  availablePaidDays:          safeToFixed(daysObject.availablePaidDays),
}
```

The **frontend `currentYear` is misleadingly named** — it actually carries the backend `availableDays` (the dynamic year-end projection), not "days for the current calendar year only". This naming is the root cause of the ping-pong: developers expected `currentYear` to mean "just 2026" and reverted to `availablePaidDays` when the value didn't match their expectation.

### Backend `availableDays` formula (vault: `patterns/vacation-day-calculation.md`)

| Office mode | Formula |
|---|---|
| **AV=false** (regular accrual, `office.advanceVacation = false`) | `availableDays = accruedDays + currentYearDays + pastYearDays − normDays + futureDays + editedVacationDays` (monthly accrual; `−normDays` cancels the up-front year credit) |
| **AV=true** (advance vacation, e.g. Cyprus / Germany) | `availableDays = currentYearDays + pastYearDays + futureDays + editedVacationDays` (full year balance available immediately; can go negative) |

`availablePaidDays` is computed separately by `VacationAvailablePaidDaysCalculatorImpl.calculateForMainPage` via binary-search over the FIFO redistribution — it represents the **maximum vacation duration the user can create right now**. For AV=true users `availableDays ≈ availablePaidDays` (both formulas converge on the same dynamic balance), which is why screenshot 2 shows no discrepancy.

### Where each field is rendered

| Component | Label key | Field used (post-fix) |
|---|---|---|
| `VacationEventsModal.js:120` | `vacation.vacation_days_left` (EN: "Annual vacation days left", RU: "Остаток дней до конца года") | `userVacationDays.currentYear` ← **changed by #3427** |
| `UserVacationsPage.js:102` (AV=true block) | `vacation.vacation_days_balance` ("X in YYYY") | `vacationDays.availablePaidDays` (unchanged) |
| `UserVacationsPage.js:135` (AV=false block, top) | `vacation.vacation_days_balance` ("Vacation days balance") | `vacationDays.availablePaidDays` (unchanged) |
| `UserVacationsPage.js:168` (AV=false block, bottom) | `vacation.vacation_days_balance_to_end_of_year` ("Expected balance of days by year-end including future accumulations and write-offs:") | `vacationDays.currentYear` (unchanged) |
| `VacationDaysTooltip/index.tsx` | per-year list `{year}: {days}` | from `selectVacationDaysForYears` — independent endpoint `GET /v1/vacationdays/{login}/years` |
| `VacationEventsModal.js` Footer | `common.total` row | from `selectVacationDaysSummary` — independent endpoint `GET /v1/timelines/days-summary/{login}` (`totalAccruedDays`, `totalUsedDays`, `totalAdministrativeDays`) |

---

## A.4 Code Change Analysis

**MRs:** [!5415](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5415) (draft, Ilya Shumchenko, 2026-04-22, source `hotfix/3427-bug-vacations-…`, target `master`) and [!5424](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5424) (Sergey Navrockiy, 2026-04-23, source `hotfix/sprint-15`, target `master`). **Identical** one-line diff; both still open. The branch under test (`hotfix/sprint-15`, HEAD `a68a067`) carries the fix at the same code position.

### Diff (commit `a68a067`)

```diff
diff --git a/frontend/frontend-js/src/modules/vacation/components/userVacationEvents/VacationEventsModal/VacationEventsModal.js
@@ -117,7 +117,7 @@ const VacationEventsModal = memo(

           <dt>{t('vacation.vacation_days_left')}</dt>
           <dd className={styles.userVacationInfo}>
-            <div>{userVacationDays.availablePaidDays}</div>
+            <div>{userVacationDays.currentYear}</div>
             <VacationDaysTooltip />
           </dd>
```

### Scope envelope

| Aspect | Scope |
|---|---|
| Changed files | 1 (`VacationEventsModal.js`) |
| Lines changed | +1 / −1 |
| Backend changes | None |
| DB migrations | None |
| Translation keys | None added or modified |
| PropTypes | Unchanged — pre- and post-fix PropTypes block declares `currentYear`, `nextYear`, `reserved` as required; `availablePaidDays` was **never** declared, so the previous code accessed an undeclared field (no runtime issue, but a latent PropTypes-warning suppression) |
| Tests | None added in this MR |

---

## A.5 Open Questions / Risks for Stage B/D

- [ ] **Q1 (R.4):** For an AV=true user with the #3361 multi-year Dec→Jan vacation pattern, does the post-fix modal still show the correct value? (`availableDays` and `availablePaidDays` should converge by formula, but verify on a real user.)
- [ ] **Q2 (#3355):** For a maternity-leave user (`maternity=true` special case — see vault `investigations/maternity-leave-lifecycle.md`), does the modal show the same value as the page "Expected remaining"? Was the original #3355 bug a backend miscalculation or a frontend display issue? If frontend, this fix may resurface it.
- [ ] **Q3 (#3357):** For an AV=false user with an APPROVED next-year vacation that consumes current-year days, is the modal value still consistent with the tooltip sum and the page?
- [ ] **Q4 (UX):** Does the existing tooltip implementation cope when `pastPeriodsAvailableDays > 0` but `currentYearDays = 0` (early-January edge case)?
- [ ] **Q5 (caching):** Is there any client-side cache or memoization of `userVacationDays` that could mask the change after deploy? Inspect saga/reducer flow on first modal open after navigation.
- [ ] **Q6 (collateral):** Grep for other consumers of `userVacationDays.currentYear` and `userVacationDays.availablePaidDays` in the frontend tree — are there other displays that should follow the same fix? (Stage B side-effect scan.)
- [ ] **Q7 (docs/Confluence):** Any user-facing documentation that referenced the old behavior (e.g. "Vacation Regulation" link `pageId=13206849`)? Out of scope for this hotfix but flag if found.
