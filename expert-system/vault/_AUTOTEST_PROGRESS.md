---
type: analysis
tags:
  - autotest
  - progress
  - phase-c
created: '2026-03-21'
updated: '2026-03-21'
status: active
---
# Autotest Generation Progress

**Last updated:** Session 24, 2026-03-21
**Scope:** vacation (config.yaml autotest.scope)
**Target env:** qa-1

## Vacation Module Coverage

| Status | Count | Percentage |
|--------|-------|------------|
| Verified | 13 | 7.5% |
| Blocked | 5 | 2.9% |
| Pending | 155 | 89.6% |
| **Total** | **173** | |

## Verified Tests

| Test ID | Title | Session | Spec File |
|---------|-------|---------|-----------|
| TC-VAC-002 | Create REGULAR (AV=true) | S22 | vacation-tc002.spec.ts |
| TC-VAC-003 | Create ADMINISTRATIVE | S22 | vacation-tc003.spec.ts |
| TC-VAC-004 | Past date validation | S22 | vacation-tc004.spec.ts |
| TC-VAC-005 | Date order validation | S22 | vacation-tc005.spec.ts |
| TC-VAC-006 | Min duration violation (0 working days) | S23 | vacation-tc006.spec.ts |
| TC-VAC-007 | 5 calendar days boundary | S23 | vacation-tc007.spec.ts |
| TC-VAC-008 | ADMINISTRATIVE 1 day | S23 | vacation-tc008.spec.ts |
| TC-VAC-010 | Insufficient days (AV=true) | S23 | vacation-tc010.spec.ts |
| TC-VAC-013 | Overlapping vacation (dates crossing) | S24 | vacation-tc013.spec.ts |
| TC-VAC-014 | Null paymentMonth NPE bug | S24 | vacation-tc014.spec.ts |
| TC-VAC-015 | Null optionalApprovers NPE (CPO path) | S24 | vacation-tc015.spec.ts |
| TC-VAC-016 | Non-existent employee login | S24 | vacation-tc016.spec.ts |
| TC-VAC-018 | CPO auto-approver self-assignment | S24 | vacation-tc018.spec.ts |

## Blocked Tests

| Test ID | Title | Blocker |
|---------|-------|---------|
| TC-VAC-001 | Create REGULAR (AV=false) | @CurrentUser forces pvaynmaster (AV=true) |
| TC-VAC-009 | Insufficient days (AV=false) | @CurrentUser forces pvaynmaster (AV=true) |
| TC-VAC-017 | Create as readOnly user | @CurrentUser forces pvaynmaster — requires readOnly user |
| TC-VAC-019 | Regular employee auto-approver assignment | @CurrentUser forces pvaynmaster (CPO) — requires ROLE_EMPLOYEE |
| TC-VAC-020 | Employee without manager self-approval | @CurrentUser forces pvaynmaster — requires manager_id=NULL |

## Known Blockers

1. **@CurrentUser constraint**: API_SECRET_TOKEN authenticates as pvaynmaster (AV=true, CPO, has manager). Any test requiring a different user's identity at create time is blocked. Affects: AV=false tests, readOnly tests, regular employee tests, no-manager tests.
2. **Ghost conflicts**: Deleted vacations still count in crossing check. Each test permanently blocks its date range. Mitigated by dynamic conflict-free date discovery in data classes.
3. **Batch deadlocks**: Running multiple vacation tests back-to-back causes PostgreSQL deadlocks on employee_vacation table. Run tests individually or with gaps.

## Key Discoveries (Session 24)

1. **Response wrapper**: Vacation create API returns `{vacation: {...}, vacationDays: {...}}` — ID is at `response.vacation.id`, not `response.id`. Approver at `response.vacation.approver`.
2. **Error code location**: Crossing validation error uses `code: "exception.validation.fail"` with actual error in `message` field (`"exception.validation.vacation.dates.crossing"`). Must check both `code` and `message` when matching errors.
3. **NPE bugs confirmed**: Both paymentMonth (TC-014) and optionalApprovers (TC-015) NPE bugs still present on qa-1 — HTTP 500 returned.
4. **CPO self-approval confirmed**: pvaynmaster (ROLE_DEPARTMENT_MANAGER) correctly gets self as approver, manager (ilnitsky) as optional approver with status ASKED.
5. **pvaynmaster's manager**: ilnitsky (csId: 65) — confirmed from API response.

## Artifacts Created (Session 24)

- `e2e/data/VacationTc013Data.ts` — Setup + overlap dates, dynamic conflict check
- `e2e/data/VacationTc014Data.ts` — Valid dates, paymentMonth deliberately omitted
- `e2e/data/VacationTc015Data.ts` — CPO user, optionalApprovers deliberately omitted
- `e2e/data/VacationTc016Data.ts` — Static fake login, no DB needed
- `e2e/data/VacationTc018Data.ts` — CPO with manager lookup, conflict-free dates
- `e2e/tests/vacation-tc013.spec.ts` through `vacation-tc018.spec.ts` (except tc017)