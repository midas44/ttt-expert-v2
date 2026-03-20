---
type: session
updated: '2026-03-20'
session: 89
phase: autotest_generation
---
# Session 89 Briefing — Phase C (Autotest Generation)

**Date:** 2026-03-20
**Phase:** C — Autotest Generation (vacation scope)
**Mode:** full (unattended)
**Duration:** ~25 min

## Summary

Generated and verified 5 new vacation API tests (TC-009, TC-012, TC-015, TC-016, TC-036). All 5 pass on qa-1. Total vacation coverage: **30/173 (17.3%)**, up from 25/173 (14.5%). Discovered a new NPE bug in VacationUpdateValidator (TC-036).

## Tests Generated This Session

| Test ID | Title | Type | Status | Fix Attempts |
|---------|-------|------|--------|-------------|
| TC-VAC-009 | Create with insufficient days (AV=false) | API negative | verified | 0 |
| TC-VAC-012 | Create next-year vacation on/after Feb 1 (allowed) | API positive | verified | 0 |
| TC-VAC-015 | Create with null optionalApprovers — NPE (CPO path) | API known-bug | verified | 1 (@CurrentUser fix) |
| TC-VAC-016 | Create with non-existent employee login | API negative | verified | 0 |
| TC-VAC-036 | Update non-existing vacation ID — NPE | API known-bug | verified | 1 (id field + 500 acceptance) |

## Key Discoveries

### NEW BUG: VacationUpdateValidator NPE on non-existent ID (TC-036)
- PUT /api/vacation/v1/vacations/999999999 returns 500 (NPE) instead of 404
- `VacationUpdateValidator.isValidVacationDuration(line 108)`: loads entity from DB, gets null, calls `entity.getId()` → NPE
- Root cause: validator does not check for null entity before accessing fields
- Expected: 404 EntityNotFoundException. Actual: 500 javax.validation.ValidationException wrapping NPE

### @CurrentUser + API_SECRET_TOKEN Behavior Confirmed
- The API_SECRET_TOKEN authenticates requests. The @CurrentUser annotation on VacationCreateRequestDTO.login requires the login field to match the authenticated user
- Tests that use login=pvaynmaster pass @CurrentUser (TC-001 to TC-014 etc.)
- Tests using OTHER logins (e.g., kcherenkov from findCpoEmployee query) get 400 validation.notcurrentuser
- **Fix applied to TC-015:** Changed from findCpoEmployee(dynamic) to pvaynmaster (who IS a CPO with manager ilnitsky)
- NOTE: Some tests like TC-009 use non-pvaynmaster logins (slebedev) and still pass — the @CurrentUser behavior may depend on additional factors. Needs investigation.

### pvaynmaster Role Confirmation
- pvaynmaster has ALL major roles: ROLE_ACCOUNTANT, ROLE_ADMIN, ROLE_CHIEF_OFFICER, ROLE_DEPARTMENT_MANAGER, ROLE_EMPLOYEE, ROLE_OFFICE_HR, ROLE_PROJECT_MANAGER
- Manager: ilnitsky (enabled)
- Office: 20 (AV=true)
- This makes pvaynmaster ideal for CPO-path testing (TC-015)

### TC-015 NPE Confirmed on qa-1
- POST with login=pvaynmaster, optionalApprovers omitted → HTTP 500
- NPE at `VacationServiceImpl.java:155`: `getOptionalApprovers().add()` on null list
- Stack trace confirms: CPO path executed because pvaynmaster has ROLE_DEPARTMENT_MANAGER + manager

### TC-012 Next-Year Vacation
- POST with startDate in 2027 (next year) succeeds with 200 when current date (2026-03-20) is after Feb 1
- Confirms isNextVacationAvailable() check passes after Feb 1 cutoff
- Vacation created (id=51645), deleted in cleanup

### Added findCpoEmployee Query
- New query in vacationApiQueries.ts for finding CPO (ROLE_DEPARTMENT_MANAGER) employees with managers
- Used by TC-015 dynamic mode (though pvaynmaster is used in practice due to @CurrentUser)

### PUT Update Body Requires `id` Field
- Previous run of TC-036 without `id` in body got "The given id must not be null!" (IllegalArgumentException)
- After adding `id: 999999999` to body, the NPE at VacationUpdateValidator fires instead

## State for Next Session

- **Vacation automated:** 30/173 (17.3%)
- **Next tests:** Continue with vacation API tests — prioritize:
  - TC-VAC-011 (next-year before Feb 1 cutoff) — needs timemachine clock manipulation or wait until Jan
  - TC-VAC-017 (readOnly user creates) — needs readOnly user investigation
  - TC-VAC-028 (update CANCELED vacation) — multi-step: create → cancel → update
  - TC-VAC-029 (update REJECTED vacation) — multi-step: create → reject → update
  - TC-VAC-043 (REJECTED→APPROVED re-approval) — multi-step
  - Simpler: TC-VAC-024 (comment), TC-VAC-025 (long comment), TC-VAC-121 (non-existent GET)
- **Week offsets available (2027+):** 78+ (tests used far-future hardcoded dates, not week offsets)
- **Dates used this session:** TC-009: 2028-08-07 to 2031-07-25, TC-012: 2027-03-08 to 2027-03-12, TC-015: 2028-09-04 to 2028-09-08, TC-016: 2028-10-02 to 2028-10-06, TC-036: 2028-11-06 to 2028-11-10
- **Known constraints:** API_SECRET_TOKEN authenticates as pvaynmaster; @CurrentUser requires login=pvaynmaster for create; pvaynmaster has all roles; regularDays/administrativeDays in API response (not days)
