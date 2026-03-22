---
type: analysis
tags:
  - autotest
  - progress
  - phase-c
created: 2026-03-21T00:00:00.000Z
updated: 2026-03-21T00:00:00.000Z
status: active
---

# Autotest Generation Progress

## Vacation Module Coverage
- **Total**: 173 test cases
- **Verified**: 23 (13.3%)
- **Blocked**: 5 (2.9%)
- **Pending**: 145 (83.8%)

## Verified Tests by Session

### Session 22 (TC-002–TC-005)
| Test ID | Spec File | Suite |
|---------|-----------|-------|
| TC-VAC-002 | vacation-tc002.spec.ts | TS-Vac-Create |
| TC-VAC-003 | vacation-tc003.spec.ts | TS-Vac-Create |
| TC-VAC-004 | vacation-tc004.spec.ts | TS-Vac-Create |
| TC-VAC-005 | vacation-tc005.spec.ts | TS-Vac-Create |

### Session 23 (TC-006–TC-010)
| Test ID | Spec File | Suite |
|---------|-----------|-------|
| TC-VAC-006 | vacation-tc006.spec.ts | TS-Vac-Create |
| TC-VAC-007 | vacation-tc007.spec.ts | TS-Vac-Create |
| TC-VAC-008 | vacation-tc008.spec.ts | TS-Vac-Create |
| TC-VAC-010 | vacation-tc010.spec.ts | TS-Vac-Create |

### Session 24 (TC-013–TC-018)
| Test ID | Spec File | Suite |
|---------|-----------|-------|
| TC-VAC-013 | vacation-tc013.spec.ts | TS-Vac-Create |
| TC-VAC-014 | vacation-tc014.spec.ts | TS-Vac-Create |
| TC-VAC-015 | vacation-tc015.spec.ts | TS-Vac-Create |
| TC-VAC-016 | vacation-tc016.spec.ts | TS-Vac-Create |
| TC-VAC-018 | vacation-tc018.spec.ts | TS-Vac-Create |

### Session 25 (TC-021, TC-039–TC-042)
| Test ID | Spec File | Suite |
|---------|-----------|-------|
| TC-VAC-021 | vacation-tc021.spec.ts | TS-Vac-Create |
| TC-VAC-039 | vacation-tc039.spec.ts | TS-Vac-StatusFlow |
| TC-VAC-040 | vacation-tc040.spec.ts | TS-Vac-StatusFlow |
| TC-VAC-041 | vacation-tc041.spec.ts | TS-Vac-StatusFlow |
| TC-VAC-042 | vacation-tc042.spec.ts | TS-Vac-StatusFlow |

### Session 26 (TC-043–TC-048)
| Test ID | Spec File | Suite |
|---------|-----------|-------|
| TC-VAC-043 | vacation-tc043.spec.ts | TS-Vac-StatusFlow |
| TC-VAC-044 | vacation-tc044.spec.ts | TS-Vac-StatusFlow |
| TC-VAC-045 | vacation-tc045.spec.ts | TS-Vac-StatusFlow |
| TC-VAC-047 | vacation-tc047.spec.ts | TS-Vac-StatusFlow |
| TC-VAC-048 | vacation-tc048.spec.ts | TS-Vac-StatusFlow |

## Blocked Tests (5)
| Test ID | Blocker |
|---------|---------|
| TC-VAC-001 | Ghost vacation conflicts for random employees; needs reliable AV=false employee |
| TC-VAC-009 | @CurrentUser forces pvaynmaster identity; insufficient days check needs different user |
| TC-VAC-017 | @CurrentUser forces pvaynmaster identity; readOnly check needs per-user login |
| TC-VAC-019 | @CurrentUser forces pvaynmaster identity; auto-approver assignment needs non-CPO user |
| TC-VAC-020 | @CurrentUser forces pvaynmaster identity; no-manager check needs specific user |

## Known Blockers
1. **@CurrentUser constraint** — API_SECRET_TOKEN resolves to pvaynmaster regardless of login param. Tests requiring different user identities need CAS per-user auth (16 tests blocked).
2. **Concurrent execution deadlocks** — Same-user tests cause deadlocks on vacation_days_distribution. Must use --workers=1.
3. **PAID vacation cleanup** — PAID+EXACT vacations cannot be deleted via normal API. Accumulate in DB over test runs.

## Session 26 Discoveries
- PUT update body requires `id` field in request body (not just URL path)
- Pay body: `{"regularDaysPayed": N, "administrativeDaysPayed": N}`, sum must equal total days
- REJECTED→APPROVED transition works without requiring an edit first (confirmed via VacationStatusManager)
- APPROVED→REJECTED transition allowed — days returned to pool on rejection

### Session 27 (API: TC-022, TC-023, TC-049, TC-052, TC-055)
| Test ID | Spec File | Suite |
|---------|-----------|-------|
| TC-VAC-022 | vacation-tc022.spec.ts | TS-Vac-API |
| TC-VAC-023 | vacation-tc023.spec.ts | TS-Vac-API |
| TC-VAC-049 | vacation-tc049.spec.ts | TS-Vac-API |
| TC-VAC-052 | vacation-tc052.spec.ts | TS-Vac-API |
| TC-VAC-055 | vacation-tc055.spec.ts | TS-Vac-API |

### Session 28 (API: TC-024, TC-025, TC-026, TC-027, TC-028)
| Test ID | Spec File | Suite |
|---------|-----------|-------|
| TC-VAC-024 | vacation-tc024-api.spec.ts | TS-Vac-API |
| TC-VAC-025 | vacation-tc025-api.spec.ts | TS-Vac-API |
| TC-VAC-026 | vacation-tc026-api.spec.ts | TS-Vac-API |
| TC-VAC-027 | vacation-tc027.spec.ts | TS-Vac-API |
| TC-VAC-028 | vacation-tc028.spec.ts | TS-Vac-API |

### Session 34 (UI: TC-024, TC-025, TC-026, TC-031, TC-032)
| Test ID | Spec File | Suite | Fix Attempts |
|---------|-----------|-------|-------------|
| TC-VAC-024 | vacation-tc024.spec.ts | TS-Vac-CRUD | 0 (13.0s) |
| TC-VAC-025 | vacation-tc025.spec.ts | TS-Vac-CRUD | 0 (7.8s) |
| TC-VAC-026 | vacation-tc026.spec.ts | TS-Vac-CRUD | 0 (7.0s) |
| TC-VAC-031 | vacation-tc031.spec.ts | TS-Vac-Approval | 3 (18.8s) |
| TC-VAC-032 | vacation-tc032.spec.ts | TS-Vac-Approval | 3 (18.7s) |

**Session 34 new artifacts:** `EmployeeRequestsPage.ts` (manager approval/rejection page object), `findEmployeeWithManager()` query (accounts for pending vacation day deductions).

**Session 34 key fixes:**
- CAS SSO isolation via `browser.newContext()` for multi-user tests
- "Employees' requests" apostrophe in page title regex
- `findEmployeeWithManager` query now subtracts pending (NEW/APPROVED) vacation `regular_days` from available balance
- Rejected vacation cleanup: skip `waitForRowToDisappear` on Closed tab (row stays with Deleted status)
