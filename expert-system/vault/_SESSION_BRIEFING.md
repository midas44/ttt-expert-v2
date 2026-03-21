---
session: 22
phase: autotest_generation
updated: '2026-03-21'
---
# Session 22 Briefing (Phase C — Autotest Generation, Fresh Start)

**Date:** 2026-03-21
**Phase:** Autotest Generation (vacation scope — regeneration after guidelines update)
**Tests verified:** 4 new (TC-002, TC-003, TC-004, TC-005)
**Tests blocked:** 1 (TC-001: @CurrentUser + AV=false)
**Vacation scope status:** 168 pending, 4 verified, 1 blocked

## Context

User deleted all previous vacation autotests (`bad autotests removed` commit) and updated generation guidelines with stricter data generation requirements (compound queries, realistic data ranges, anti-patterns). Session 22 starts fresh: reparsed XLSX manifest, reset SQLite tracking, and began regenerating vacation tests following the improved guidelines.

## What was done

1. **Reparsed manifest** — all 10 modules (1071 test cases) now have parsed test case data with `classified_type` and `automation_status` fields
2. **Reset SQLite tracking** — deleted stale vacation tracking rows, re-inserted all 1071 cases as pending
3. **Generated 5 vacation API tests** from TS-Vac-Create suite (Critical + High priority)

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-001 | Create REGULAR vacation (AV=false) | API | TS-Vac-Create | BLOCKED |
| TC-VAC-002 | Create REGULAR vacation (AV=true) | API | TS-Vac-Create | PASS |
| TC-VAC-003 | Create ADMINISTRATIVE vacation | API | TS-Vac-Create | PASS |
| TC-VAC-004 | Past date validation error | API | TS-Vac-Create | PASS |
| TC-VAC-005 | Date order validation error | API | TS-Vac-Create | PASS |

## Key Discoveries

1. **API response structure**: POST /api/vacation/v1/vacations returns `{ vacation: {...}, vacationDays: {...} }` — data wrapped in `vacation` key, not flat
2. **Error response structure**: Top-level `errorCode` is always `exception.validation`; specific error codes live in `errors[].code`
3. **@CurrentUser enforced**: API_SECRET_TOKEN authenticates as `pvaynmaster` (AV=true office). The `@CurrentUser` DTO validator rejects any other login with `validation.notcurrentuser`. This blocks all API tests requiring AV=false employees.
4. **pvaynmaster is CPO** in Персей office (AV=true) — self-approves vacations, manager ilnitsky added as optional approver
5. **Manifest structure**: `modules.{name}.suites.{suite}.test_cases[]` with `classified_type` field (UI/API/hybrid) separate from `type` (Functional/Negative/Boundary)

## Blocker Categories

| Blocker | Impact | Tests |
|---------|--------|-------|
| @CurrentUser (AV=false needs different user) | Cannot test AV=false via API_SECRET_TOKEN | TC-VAC-001 |

## Coverage

- **Vacation automated:** 4/173 (2.3%) — fresh restart
- **Vacation blocked:** 1/173 (0.6%)
- **Vacation pending:** 168/173 (97.1%)

## Next Steps

1. Continue generating vacation API tests from TS-Vac-Create (TC-006 through TC-018)
2. Focus on tests that work with pvaynmaster (AV=true, CPO): ADMINISTRATIVE tests, boundary tests, more negative tests
3. Move to TS-Vac-StatusFlow and TS-Vac-Approval suites after Create is done
4. Write vault note documenting discovered API response format and @CurrentUser constraint