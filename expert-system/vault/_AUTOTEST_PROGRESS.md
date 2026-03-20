---
type: analysis
tags:
  - autotest
  - progress
  - phase-c
updated: '2026-03-20'
status: active
---
# Autotest Progress — Phase C

**Updated:** 2026-03-20 (Session 89)

## Overall Coverage

| Module | Total TCs | Automated | Coverage | Status |
|--------|-----------|-----------|----------|--------|
| vacation | 173 | 30 | 17.3% | In progress |
| sick-leave | — | 0 | 0% | Pending |
| day-off | — | 0 | 0% | Pending |
| reports | — | 0 | 0% | Pending |
| statistics | — | 0 | 0% | Pending |
| accounting | 92 | 0 | 0% | Pending |
| admin | — | 0 | 0% | Pending |
| planner | — | 0 | 0% | Pending |

## Vacation Module Breakdown

### Automated (30 tests)

**Create (TS-Vac-Create):** TC-001 through TC-008 (except TC-009→now done), TC-010, TC-012, TC-013, TC-014, TC-015, TC-016
**Update (TS-Vac-Update):** TC-026, TC-027, TC-030, TC-036
**Approval (TS-Vac-Approval):** TC-039, TC-040, TC-041, TC-042, TC-044, TC-045, TC-047
**Days/Balance:** TC-071
**Edge Cases:** TC-118, TC-130, TC-171

### Known Bugs Verified by Autotests
- **TC-014:** paymentMonth null → NPE at VacationAvailablePaidDaysCalculatorImpl (HTTP 500)
- **TC-015:** optionalApprovers null on CPO path → NPE at VacationServiceImpl:155 (HTTP 500)
- **TC-036:** Update non-existent vacation ID → NPE at VacationUpdateValidator:108 (HTTP 500 instead of 404) — **NEW BUG discovered in Session 89**

### Session History
| Session | Tests | IDs |
|---------|-------|-----|
| 84 | 5 | TC-001, TC-002, TC-003, TC-004, TC-005 |
| 85 | 5 | TC-006, TC-039, TC-040, TC-041, TC-042 |
| 86 | 5 | TC-044, TC-045, TC-071, TC-118, TC-171 |
| 87 | 5 | TC-010, TC-013, TC-027, TC-047, TC-130 |
| 88 | 5 | TC-007, TC-008, TC-014, TC-026, TC-030 |
| 89 | 5 | TC-009, TC-012, TC-015, TC-016, TC-036 |
