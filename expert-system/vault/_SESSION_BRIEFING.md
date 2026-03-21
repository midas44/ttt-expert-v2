---
session: 24
phase: autotest_generation
updated: '2026-03-21'
---
# Session 24 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-21
**Phase:** Autotest Generation (vacation scope)
**Tests generated:** 5 new (TC-013, TC-014, TC-015, TC-016, TC-018)
**Tests blocked:** 3 new (TC-017, TC-019, TC-020)
**Vacation scope status:** 155 pending, 13 verified, 5 blocked

## What was done

Generated 5 vacation API tests + marked 3 as blocked:

| Test ID | Title | Type | Result | Notes |
|---------|-------|------|--------|-------|
| TC-VAC-013 | Overlapping vacation (dates crossing) | API/Negative | PASS | Creates setup vacation, overlaps it. Error in `message` field not `code`. |
| TC-VAC-014 | Null paymentMonth — NPE bug | API/Known-bug | PASS | HTTP 500 confirmed. NPE at VacationAvailablePaidDaysCalculatorImpl:73. |
| TC-VAC-015 | Null optionalApprovers — NPE (CPO) | API/Known-bug | PASS | HTTP 500 confirmed. NPE at VacationServiceImpl:155 on CPO path. |
| TC-VAC-016 | Non-existent employee login | API/Negative | PASS | @EmployeeLoginExists validator fires. Simple static data class. |
| TC-VAC-018 | CPO auto-approver self-assignment | API/Functional | PASS | Self-approval verified. Manager ilnitsky added as optional (ASKED). |
| TC-VAC-017 | Create as readOnly user | API/Negative | BLOCKED | @CurrentUser forces pvaynmaster (not readOnly). |
| TC-VAC-019 | Regular employee auto-approver | API/Functional | BLOCKED | @CurrentUser forces pvaynmaster (CPO, not ROLE_EMPLOYEE). |
| TC-VAC-020 | No-manager self-approval | API/Functional | BLOCKED | @CurrentUser forces pvaynmaster (has manager). |

## Key Discoveries

1. **Response wrapper structure**: Create endpoint returns `{vacation: {...}, vacationDays: {...}}`. Previous tests (TC-002..010) must have used the correct path already. TC-013/018 needed fix after first run.
2. **Error field inconsistency**: Crossing validation uses `code: "exception.validation.fail"` with actual error in `message` field. Other validators (login, duration) put the error directly in `code`. Must check both fields.
3. **Both NPE bugs active**: paymentMonth and optionalApprovers NPEs still present on qa-1. No fix deployed.
4. **pvaynmaster identity confirmed**: CPO (ROLE_DEPARTMENT_MANAGER), AV=true (Персей office), manager = ilnitsky (csId 65).

## Fix History

- TC-013 run 1: `setupJson.id` → `setupJson.vacation?.id` (response wrapper)
- TC-013 run 2: Error matching `e.code ===` → `e.code === || e.message ===` (error field location)
- TC-018 run 1: Same response wrapper fix applied preemptively

## Coverage

- **Vacation automated:** 13/173 (7.5%)
- **Vacation blocked:** 5/173 (2.9%)
- **Vacation pending:** 155/173 (89.6%)

## Next Steps

1. Continue TS-Vac-Create suite: TC-011, TC-012 (next-year cutoff — needs clock manipulation)
2. Skip to TC-021..TC-025 for remaining create-path tests feasible with pvaynmaster
3. Move to TS-Vac-StatusFlow (TC-039..TC-055) for approve/reject/cancel workflow tests
4. @CurrentUser blocker analysis: 5 blocked tests so far. If more accumulate, investigate CAS per-user auth or env config changes.