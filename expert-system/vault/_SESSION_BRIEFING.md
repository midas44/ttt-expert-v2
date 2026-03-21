---
session: 26
phase: autotest_generation
updated: 2026-03-21
---

# Session 26 — Phase C: Autotest Generation

## Completed
Five new vacation StatusFlow API tests generated and verified (all passing on sequential run):

| Test ID | Title | Result |
|---------|-------|--------|
| TC-VAC-043 | REJECTED → APPROVED (re-approval without edit) | ✅ Passed |
| TC-VAC-044 | APPROVED → NEW (employee edits dates) | ✅ Passed |
| TC-VAC-045 | APPROVED → CANCELED (employee cancels) | ✅ Passed |
| TC-VAC-047 | APPROVED → REJECTED (approver rejects after approval) | ✅ Passed |
| TC-VAC-048 | APPROVED → PAID (accountant pays) | ✅ Passed |

## Vacation Scope Status
- **Verified**: 23 / 173 (13.3%)
- **Blocked**: 5 / 173 (2.9%)
- **Pending**: 145 / 173 (83.8%)

## Key Discoveries (Session 26)
1. **PUT update body requires `id` field** — PUT /v1/vacations/{id} expects `id` in request body in addition to URL path. Omitting it causes `IllegalArgumentException: The given id must not be null!`
2. **Pay endpoint body format confirmed** — `{"regularDaysPayed": N, "administrativeDaysPayed": N}` where sum must equal total vacation days. For REGULAR 5-day vacation: `{"regularDaysPayed": 5, "administrativeDaysPayed": 0}`
3. **Concurrent test deadlocks** — Running multiple tests for the same user (pvaynmaster) in parallel causes deadlocks on `vacation_days_distribution` table. Tests must run with `--workers=1` or use different users.
4. **Crossing check blocks concurrent approve** — When multiple vacations for the same user are created in parallel, the crossing validation on approve sees the other tests' vacations and fails. Same-user tests must run sequentially.
5. **PAID cleanup limitation** — PAID+EXACT vacations cannot be canceled or deleted via normal API. Best-effort cleanup attempted but PAID records may persist.

## Artifacts Created
- Data classes: VacationTc043Data, VacationTc044Data, VacationTc045Data, VacationTc047Data, VacationTc048Data
- Test specs: vacation-tc043.spec.ts through vacation-tc048.spec.ts (skipping tc046)

## Next Steps
- **TS-Vac-StatusFlow**: TC-046 (canBeCancelled guard), TC-049 (CANCELED→NEW re-open), TC-052-056 (invalid transitions + concurrent)
- **TS-Vac-Create**: TC-022, TC-023, TC-024, TC-025 (notifyAlso, comments)
- **TS-Vac-Update**: TC-026 through TC-038
- **TS-Vac-Approval**: TC-057 through TC-068 (optional approvers, approver changes)