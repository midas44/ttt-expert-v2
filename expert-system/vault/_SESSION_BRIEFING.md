---
type: session
updated: 2026-03-27
session: 66
phase: C (Autotest Generation)
---

# Session 66 — Phase C: Autotest Generation (Vacation batch 2)

**Timestamp:** 2026-03-27 ~08:20 UTC
**Phase:** C — Autotest Generation
**Scope:** vacation
**Target env:** qa-1

## Completed This Session

Generated and verified 5 vacation autotests (TC-VAC-003, 004, 006, 009, 010):

| Test ID | Title | Status | Notes |
|---------|-------|--------|-------|
| TC-VAC-003 | Create vacation with comment | **verified** | UI creation + comment verification via Request Details dialog |
| TC-VAC-004 | Create with Also notify recipients | **verified** | UI creation + DB verification of notify_also record |
| TC-VAC-006 | Edit APPROVED vacation resets to NEW | **verified** | API setup (createAndApprove) + UI edit + status verification |
| TC-VAC-009 | Re-open CANCELED vacation | **blocked** | Cancel API sets DELETED not CANCELED — see findings below |
| TC-VAC-010 | View Request Details dialog | **verified** | API setup (createVacation) + dialog field verification |

### Key Findings

1. **Cancel API path correction:** Endpoint is `/v1/vacations/cancel/{id}`, not `/{id}/cancel`. Fixed in `ApiVacationSetupFixture.ts`.

2. **CRITICAL: Cancel API sets DELETED, not CANCELED.** `PUT /v1/vacations/cancel/{id}` transitions vacation to DELETED status, not CANCELED. The CANCELED status exists in the backend state machine but is NOT reachable through the cancel API or UI. DELETED vacations have no edit button and cannot be reopened. This means TC-VAC-009 (re-open CANCELED vacation) cannot be automated as written — the CANCELED→NEW transition is not exposed.

3. **VacationDetailsDialog enhanced** with `getFieldValue(label)` method for reading structured field values from the Request Details dialog.

4. **Warning text in edit dialog is optional** — not all environments/versions show the "Changing dates will reset to New status" warning. TC-VAC-006 makes this check soft.

### Files Created/Modified

**New files:**
- `e2e/data/vacation/VacationTc003Data.ts` — week offset 3, findEmployeeWithManager
- `e2e/data/vacation/VacationTc004Data.ts` — week offset 4, findEmployeeWithColleague
- `e2e/data/vacation/VacationTc006Data.ts` — week offset 7, pvaynmaster
- `e2e/data/vacation/VacationTc009Data.ts` — week offset 9, pvaynmaster
- `e2e/data/vacation/VacationTc010Data.ts` — week offset 10, pvaynmaster
- `e2e/tests/vacation/vacation-tc003.spec.ts`
- `e2e/tests/vacation/vacation-tc004.spec.ts`
- `e2e/tests/vacation/vacation-tc006.spec.ts`
- `e2e/tests/vacation/vacation-tc009.spec.ts`
- `e2e/tests/vacation/vacation-tc010.spec.ts`

**Modified files:**
- `e2e/fixtures/ApiVacationSetupFixture.ts` — fixed cancel path, added createAndCancel method
- `e2e/pages/VacationDetailsDialog.ts` — added getFieldValue method

### Cleanup
- Orphaned vacation 51647 (pvaynmaster, NEW, Aug 3-7) deleted via API.

## Current Autotest Coverage (vacation)

| Status | Count |
|--------|-------|
| verified | 9 |
| blocked | 1 |
| pending | 90 |
| **Total** | **100** |

**Coverage: 10% (10/100 test cases addressed)**

## Week Offset Registry (pvaynmaster)
Tracks which week offsets are used by which tests to prevent date conflicts:
- Offset 2: TC-VAC-002 (delete NEW)
- Offset 5: TC-VAC-005 (edit NEW dates)
- Offset 6: TC-VAC-008 (cancel APPROVED)
- Offset 7: TC-VAC-006 (edit APPROVED → NEW)
- Offset 8: TC-VAC-007 (approve as manager — uses findEmployeeWithManager)
- Offset 9: TC-VAC-009 (re-open CANCELED — blocked)
- Offset 10: TC-VAC-010 (view Request Details)

## Next Session (67) Priorities

1. Continue vacation autotests — next batch from manifest (TC-VAC-011 onward)
2. Consider TC-VAC-009 alternatives: investigate if there's a DB-level way to set CANCELED status, or mark the test case as not-automatable
3. Look at hybrid test types and more complex approval/rejection workflows
4. Keep enriching vault with selector discoveries
