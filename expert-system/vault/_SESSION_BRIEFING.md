---
session: 27
phase: autotest_generation
updated: '2026-03-21'
---
# Session 27 — Phase C: Autotest Generation

## Completed
Five new vacation API tests generated and verified (all passing on first or second run):

| Test ID | Suite | Title | Result |
|---------|-------|-------|--------|
| TC-VAC-049 | StatusFlow | CANCELED → NEW (employee re-opens) | Passed |
| TC-VAC-052 | StatusFlow | Invalid transition NEW → PAID (skipping approval) | Passed |
| TC-VAC-055 | StatusFlow | Status transition — verify timeline event published | Passed |
| TC-VAC-022 | Create | Create vacation with notifyAlso list | Passed |
| TC-VAC-023 | Create | Create vacation with invalid notifyAlso login | Passed |

## Vacation Scope Status
- **Verified**: 28 / 173 (16.2%)
- **Blocked**: 4 / 173 (2.3%)
- **Pending**: 141 / 173 (81.5%)

## Key Discoveries (Session 27)
1. **Timeline table schema** — `ttt_vacation.timeline` stores event_type (VACATION_CREATED, VACATION_APPROVED, etc.), vacation FK, event_time, previous_status. Events are reliably created on every status transition. previous_status is only populated for some transitions (reject, cancel, delete), not for create/approve/pay.
2. **vacation_notify_also FK column** — The column referencing the notified employee is named `approver` (misleading), not `employee` or `notify_employee`. FK points to ttt_vacation.employee.id.
3. **DB bigint → JS string** — PostgreSQL bigint columns return as strings in Node.js pg driver. Must use `Number()` when comparing with API-returned numeric IDs.
4. **Manifest/SQLite sync** — Fixed 4 tests (TC-VAC-002 through TC-VAC-005) that were verified in SQLite but not marked in manifest. Now fully synced at 28 verified.
5. **TC-VAC-046 (canBeCancelled guard) deferred** — Requires vacation with paymentDate before office report period, which can't be set up without clock manipulation (timemachine) or period advancement. Needs P1 timemachine support.
6. **TC-VAC-056 (crossing on approve) deferred** — Can't create two overlapping vacations for same user (crossing check runs on both create and update). Would need multi-user support or DB manipulation.

## Artifacts Created
- Data classes: VacationTc049Data, VacationTc052Data, VacationTc055Data, VacationTc022Data, VacationTc023Data
- Test specs: vacation-tc049.spec.ts, vacation-tc052.spec.ts, vacation-tc055.spec.ts, vacation-tc022.spec.ts, vacation-tc023.spec.ts

## Next Steps
- **TS-Vac-Create**: TC-024 (comment), TC-025 (long comment)
- **TS-Vac-Update**: TC-026 through TC-038 (13 pending tests)
- **TS-Vac-Approval**: TC-057 through TC-068 (12 pending tests)
- **TS-Vac-StatusFlow remaining**: TC-050 (PAID terminal, UI), TC-051 (DELETED terminal, UI), TC-054 (concurrent, UI)
