---
type: session
updated: 2026-03-27
session: 70
phase: C (autotest_generation)
scope: vacation
---

# Session 70 Briefing — Phase C Autotest Generation

**Timestamp:** 2026-03-27T12:00 UTC+7
**Phase:** C — Autotest Generation (vacation scope)
**Mode:** full autonomy

## Session Summary

Fixed and verified 3 vacation filter tab autotests (TC-VAC-047, TC-VAC-048, TC-VAC-049). Discovered critical application behavior around tab filters and vacation cleanup. Performed session 70 maintenance.

## Key Accomplishments

1. **TC-VAC-047 (Open tab filter):** Already verified in session 69 (7.3s pass)
2. **TC-VAC-048 (Closed tab filter):** Fixed — changed from CANCELED to REJECTED status. Root cause: Closed tab shows PAID+REJECTED only, NOT CANCELED. Also fixed soft-delete pollution (old DELETED vacations matching regex patterns). Now passes (8.2s).
3. **TC-VAC-049 (All tab filter):** Fixed — changed from NEW+CANCELED to NEW+REJECTED. Root cause: CANCELED vacations are NOT shown on ANY tab. Also added `goToLastPage()` pagination method to MyVacationsPage (not needed in final fix since default sort is descending, but available for future tests). Now passes (8.4s).
4. **TC-VAC-024 (Approval resets on date edit):** Marked as blocked — requires two-user workflow.
5. **ApiVacationSetupFixture.deleteVacation():** Changed from soft-delete to hard-delete via test endpoint. Prevents DELETED vacation accumulation that pollutes future test runs.

## Critical Discoveries

### CANCELED vacations not shown on any tab
- Open: NEW, APPROVED
- Closed: PAID, REJECTED
- All: NEW, APPROVED, PAID, REJECTED, DELETED, FINISHED
- **CANCELED is excluded from ALL views** — this impacts any test expecting to see CANCELED vacations

### Soft-delete vs hard-delete
- `DELETE /v1/vacations/{id}` → soft-delete (status=DELETED, stays in DB, shows on All tab)
- `DELETE /v1/test/vacations/{id}` → hard-delete (removed from DB)
- All test cleanup now uses hard-delete to prevent pollution

### Pagination
- Default sort: DESCENDING (newest first)
- ~20 rows per page
- Added `goToLastPage()` method to MyVacationsPage

## Current Progress

| Metric | Count |
|--------|-------|
| Verified | 26 |
| Blocked | 3 |
| Pending | 71 |
| Total | 100 |
| **Coverage** | **26%** |

## Files Modified This Session
- `e2e/data/vacation/VacationTc048Data.ts` — renamed canceled→rejected fields
- `e2e/data/vacation/VacationTc049Data.ts` — renamed canceled→rejected fields
- `e2e/tests/vacation/vacation-tc048.spec.ts` — createAndReject instead of createAndCancel
- `e2e/tests/vacation/vacation-tc049.spec.ts` — createAndReject, removed pagination/sort hacks
- `e2e/fixtures/ApiVacationSetupFixture.ts` — deleteVacation now uses hard-delete test endpoint
- `e2e/pages/MainPage.ts` — added goToLastPage() pagination method

## Next Session Priorities
1. Continue vacation autotests — next batch from pending TC-VAC-011, TC-VAC-022, TC-VAC-009, etc.
2. Focus on tests that don't require multi-user workflows
3. Skip TC-VAC-024 (blocked) and similar two-user tests
