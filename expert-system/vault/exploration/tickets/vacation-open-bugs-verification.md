---
type: exploration
tags:
  - vacation
  - bugs
  - live-verification
  - qa-1
created: '2026-03-26'
updated: '2026-03-26'
status: active
related:
  - '[[exploration/tickets/vacation-ticket-findings]]'
  - '[[analysis/vacation-business-rules-reference]]'
---
# Vacation Open Bugs — Live Verification Results (Session 63)

Verified 11 open vacation bugs on qa-1 environment (2026-03-26). Results categorized by verification status.

## Verified / Confirmed Bugs

### #3374 — `last_date` not synced during CS sync ✅ CONFIRMED
**DB Evidence:** 7 employees with mismatched `last_date` between `ttt_vacation.employee` and `ttt_backend.employee`:
- 3 cases: backend has `last_date` set but vacation schema is NULL → employee leaving but vacation service doesn't know (allows vacation creation past termination)
- 4 cases: vacation has `last_date` but backend is NULL → stale vacation data from pre-2024

**Key affected employees:**
- `abpopov`: vac=NULL, backend=2026-03-31 (CRITICAL — leaving March 31, vacation service unaware)
- `ebryndina`: vac=NULL, backend=2026-03-24 (already past last_date!)
- `azhukov`: vac=NULL, backend=2026-02-27

**Impact:** Employee can create vacations extending beyond their termination date. The `last_date` field in `ttt_vacation.employee` was last updated in 2023 — the CS sync does not propagate this field.

**Test cases:**
- TC: Verify CS sync updates `last_date` in vacation schema when employee termination date changes
- TC: Verify vacation creation blocked when startDate > employee.last_date
- TC: Verify vacation editing blocked when dates extend past last_date

### #3297 — Latin name search broken ✅ CONFIRMED (partial)
**API Evidence:** The `GET /api/vacation/v1/employees?search=Bur` endpoint returns ALL 381 employees regardless of search parameter. Both Latin ("Bur") and Russian ("Буре") queries return identical 381-employee result sets with alphabetical ordering — the `search` parameter is **completely ignored**.

**UI Evidence:** The Availability Chart search works correctly for Latin names (typing "Burets" filters to "Evgeniya Burets"). This indicates the Availability Chart uses **client-side filtering**, while the "Employees vacation days" and "Correction of vacation days" pages use the broken backend search endpoint.

**Additional finding from ticket comments (omaksimova):** On "Correction of vacation days" page, search fails with 2+ Latin characters specifically. With 1 Latin character it works. This suggests there may be a length-based trigger in the search query.

**Affected pages:** "Employees vacation days" (manager view), "Correction of vacation days" (accounting view). Could not access these pages as current test user (eburets = ROLE_EMPLOYEE only).

**DB schema relevant:** Employee table has separate `latin_first_name`, `latin_last_name`, `russian_first_name`, `russian_last_name` columns. The search endpoint may only query Russian name columns.

### #3369 — Past vacation creation without balance deduction ❌ NOT REPRODUCED
**API Evidence:** `POST /api/vacation/v1/vacations` with `startDate: "2026-03-20"` (past) correctly returns HTTP 400 with `validation.vacation.start.date.in.past`. The validation works on qa-1 with normal clock.

**Context:** The original bug required **clock manipulation** (advance server clock to future, then create vacation with dates in the "past" relative to advanced clock). On normal qa-1 environment, the validator correctly compares startDate against today's date and rejects.

**Status:** May be fixed or may only reproduce with clock manipulation on timemachine. The BDD scenarios from snavrockiy (2026-01-13) describe the expected behavior which now appears to work correctly. Needs verification on timemachine with manipulated clock to fully close.

## Not Tested — Insufficient Data/Access

### #3361 — AV=True multi-year balance distribution
**Reason:** Requires specific AV=true employee with multi-year vacations consuming cross-year balance days. Complex data setup not attempted. Bug involves redistribution algorithm when balance spans 2+ years and 2+ vacations.
**Key finding from comments:** Bug 1 (wrong "Available days" display) still open. Fix direction: use `GET /v1/vacationdays/available?newDays=0`. Bugs 3, 4, 4.1 are verified/fixed.

### #3363 — Error 500 on negative balance payment
**Reason:** No APPROVED vacations exist for employees with negative combined balance on qa-1. Multiple employees have individual year balances of -60.000 (Нептун office, AV=true), but none have APPROVED vacations pending payment.
**Requirements:** Need to create a vacation for a negative-balance employee, approve it, then attempt payment.

### #3347 — AV=true next-year corner cases
**Reason:** Requirements/implementation ticket (not a bug per se). Defines BDD scenarios for `daysNotEnough` validation and ADMIN↔REGULAR conversion redistribution. Testing requires specific multi-vacation setup with AV=true employees.

### #3352 — Maternity leave doesn't return vacation days to balance
**Reason:** Needs employee on maternity leave with cross-year vacation balance. Specific data setup not attempted.

### #2789 — Double annual accrual on SO change
**Reason:** Analytical task. Root cause: employee changes salary office mid-year, receiving double accrual. Comments indicate mass impact on production. Needs specific employee who changed SO to verify.

### #2718 — Redirected request status reset
**Reason:** Approver must redirect an APPROVED/REJECTED vacation to another approver. Status should reset to NEW while preserving optional approver votes. Needs multi-user scenario (no CAS per-user auth available).

### #2925 — Wrong payment month in email notification
**Reason:** Requires triggering a vacation status change email and inspecting the content. Email shows incorrect payment month. Screenshot-only evidence in ticket — needs email API or template inspection.

### #3370 — Maternity leave "0 available days" on edit
**Reason:** Needs maternity leave employee (`afanaseva`) who has a created vacation. Frontend bug — available days counter shows 0 when editing.

## Verification Summary

| Ticket | Bug | Status | Method |
|--------|-----|--------|--------|
| #3374 | last_date not synced | ✅ CONFIRMED | DB query |
| #3297 | Latin name search | ✅ CONFIRMED (API level) | API + UI |
| #3369 | Past vacation no deduction | ❌ Not reproduced (normal clock) | API |
| #3361 | AV=true multi-year balance | ⏸️ Not tested | — |
| #3363 | Error 500 negative payment | ⏸️ Not tested | — |
| #3347 | AV=true corner cases | ⏸️ Requirements ticket | — |
| #3352 | Maternity recalculation | ⏸️ Not tested | — |
| #2789 | Double accrual SO change | ⏸️ Analytical task | — |
| #2718 | Redirect status reset | ⏸️ Not tested | — |
| #2925 | Wrong payment month email | ⏸️ Not tested | — |
| #3370 | Maternity 0 days edit | ⏸️ Not tested | — |

## Related
- [[exploration/tickets/vacation-ticket-findings]] — master ticket findings
- [[analysis/vacation-business-rules-reference]] — business rules catalog
- [[modules/vacation-service-deep-dive]] — code-level reference


## Detailed Ticket Findings (Remaining 6 Bugs)

### #3352 — Maternity leave doesn't return vacation days (cross-year)
**Labels:** Backend, Production Ready, Sprint 15
**Affected users:** nkoshkina, azenzerova (stage + qa-2)

**Scenario:** Employee with 24 days in 2025 creates two cross-year vacations (Dec 2025–Jan 2026), using 24 days from 2025 + 2 from 2026. Accountant adds maternity leave starting Dec 5. Expected: vacations rejected, all days returned, following-year days removed, notification sent. Actual: vacations rejected but used days NOT returned, next-year days NOT removed.

**BDD scenario from snavrockiy:** Office "TTT HQ" (AV=true/false, 24 days), vacation 2025-12-15 → 2026-01-17 (17 working days: 12 in 2025 + 5 in 2026, payment month 2025-12-01). Documents expected recalculation logic.

**Test cases:** Cross-year vacation + maternity leave interaction, balance recalculation after maternity, notification ID_70 trigger.

### #2789 — Double annual accrual on SO change
**Labels:** Analytical Task, Sprint 15, To Do
**Created:** 2023-11-09 (old bug, still open)

**Root cause:** CS sync detects office change → accrues new office's vacation days as if year-start. If source and target offices have same norm (both 24), net effect -24+24 is correct. If norms differ, balance is wrong. No logging exists for accrual events.

**Production impact:** Mass transfer of employees to new cost-centers (Venus RF, Uranus RF) potentially added extra 24 vacation days to ALL transferred employees. Confirmed by pvaynmaster.

**Comments propose:** Logging changes to available vacation days for events: office change, office rule changes, special correction scripts.

### #2718 — Redirect approved/rejected vacation should reset to "New"
**Labels:** To Do
**Created:** 2023-08-22 (old feature request)

**Requirements:**
1. Redirect APPROVED/REJECTED vacation to new approver → status changes to NEW
2. Existing optional approver votes must be preserved
3. APPROVED→NEW: no extra days deducted from balance
4. REJECTED→NEW: days correctly deducted from balance
5. No extra notifications in Vacation Notification Digest

### #2925 — Wrong payment month in email notification
**No labels, no comments.** Screenshot-only evidence: status change email shows "июн" (June) incorrectly. Likely template variable formatting bug in Mustache template for `NOTIFY_VACATION_STATUS_CHANGE_TO_EMPLOYEE` or `VACATION_STATUS_CHANGED_EMPLOYEE`.

### #3370 — Maternity employee "0 available days" on edit (Frontend)
**Labels:** Frontend, Sprint 15, To Do
**Affected user:** afanaseva (stage, qa-2)
Frontend bug: available days counter shows "0" when maternity employee edits existing vacation. System should recalculate available days considering maternity status.

### #3374 — last_date not synced (CONFIRMED by DB query)
**Labels:** Backend, Production Ready, Sprint 15
Additional detail from ticket: `ttt_vacation.employee.last_date` was last updated in 2023. `ttt_vacation.employee_period` has more recent data (up to 2025). Three different schemas have different `last_date` values for the same employee.
