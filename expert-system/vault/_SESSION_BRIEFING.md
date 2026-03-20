---
type: session
updated: '2026-03-20'
session: 91
phase: autotest_generation
---
# Session 91 Briefing — Phase C (Autotest Generation)

**Date:** 2026-03-20
**Phase:** C — Autotest Generation (vacation scope)
**Mode:** full (unattended)
**Duration:** ~25 min

## Summary

Generated and verified 5 new vacation API tests (TC-022, TC-023, TC-032, TC-043, TC-052). All 5 pass on qa-1. TC-031 was attempted but skipped — API_SECRET_TOKEN bypasses ownership checks, making per-user permission tests infeasible without CAS auth. Replaced with TC-043. Total vacation coverage: **40/173 (23.1%)**, up from 35/173 (20.2%).

## Tests Generated This Session

| Test ID | Title | Type | Status | Fix Attempts |
|---------|-------|------|--------|-------------|
| TC-VAC-022 | Create vacation with notifyAlso list | API functional | verified | 0 |
| TC-VAC-023 | Create vacation with invalid notifyAlso login | API negative | verified | 0 |
| TC-VAC-032 | Update with overlapping dates | API validation | verified | 1 (assertion fix: check message field) |
| TC-VAC-043 | REJECTED→APPROVED re-approval without edit | API status flow | verified | 1 (approve endpoint: PUT /approve/{id} not POST /{id}/approve) |
| TC-VAC-052 | Invalid transition NEW→PAID | API negative | verified | 0 |

## Key Discoveries

### API_SECRET_TOKEN bypasses ownership checks
- TC-031 attempted to update a vacation as a non-owner user by sending `login=otherUser` in the PUT body.
- Result: 200 OK — the update succeeded. The API_SECRET_TOKEN authenticates as a privileged system user that passes `hasAccess()` regardless of the login field.
- The `login` field in update requests is data, not auth context. `employeeService.getCurrent()` returns the system user from the token.
- **Impact:** All permission-based tests (TC-031, TC-053, TC-037) requiring per-user auth cannot be automated with API_SECRET_TOKEN alone. Need CAS authentication for these.
- Marked TC-031 as `skipped` with reason.

### Crossing validation error format
- `exception.validation.vacation.dates.crossing` appears in the `message` field, not `errorCode`.
- The `errorCode` is `exception.validation.fail` (generic).
- Error detail: `errors[0].code` = `exception.validation.fail`, `errors[0].message` = `exception.validation.vacation.dates.crossing`.
- Assertion pattern: check both `errorCode` and `message`/`errors[].message` for specific error strings.

### Approve endpoint is PUT, not POST
- VacationController: `@PutMapping(value = "/approve/{vacationId}")`
- URL pattern: `PUT /api/vacation/v1/vacations/approve/{id}`
- All status transition endpoints use PUT and `/action/{id}` pattern (not `/{id}/action`).

### notifyAlso validation works correctly
- Valid logins: accepted, vacation created with 200.
- Invalid login ("nonexistent_user_xyz_999"): rejected with 400, `@EmployeeLoginCollectionExists` validator fires.
- The GET response for a vacation does NOT include `notifyAlso` in the response body — it's stored in `vacation_notify_also` table only.

### REJECTED→APPROVED re-approval confirmed
- Direct re-approval from REJECTED→APPROVED works without editing the vacation first.
- The transition `add(REJECTED, APPROVED, PM/DM/ADMIN)` is confirmed in live testing.
- This is Known Bug #5 in the business rules reference.

## State for Next Session

- **Vacation automated:** 40/173 (23.1%)
- **Skipped (need CAS auth):** TC-031 (update by non-owner)
- **Next tests — good candidates:**
  - TC-VAC-046 (APPROVED→CANCELED blocked by canBeCancelled guard) — status flow
  - TC-VAC-048 (APPROVED→PAID accountant pays) — key payment flow
  - TC-VAC-055 (status transition verify event published) — if observable
  - TC-VAC-056 (approve with crossing vacation blocked) — validation
  - TC-VAC-057 (add optional approvers on creation) — feature test
  - TC-VAC-011 (create next-year before Feb 1 cutoff) — boundary
  - TC-VAC-017 (create as readOnly user) — permission (may need CAS)
- **Week offsets used this session:** 120 (TC-022), 128/132 (TC-032), 136 (TC-052), 140 (TC-043)
- **Known constraints:** Use offsets 144+ for future tests; permission tests need CAS auth, not API_SECRET_TOKEN
