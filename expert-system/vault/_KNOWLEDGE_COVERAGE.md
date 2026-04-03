---
type: coverage
updated: '2026-04-03'
---
# Knowledge Coverage — Phase C (Autotest Generation)

## Phase C: Autotest Generation Progress

### Target Modules (autotest.scope: reports, accounting)

| Module | XLSX Cases | Tracked | Verified | Failed | Blocked | Pending | Coverage |
|--------|-----------|---------|----------|--------|---------|---------|----------|
| reports | 60 | 60 | 8 | 1 | 0 | 51 | 13.3% |
| accounting | 38 | 0 | 0 | 0 | 0 | 0 | 0% |

### Reports Breakdown by Suite

| Suite | Total | Verified | Remaining |
|-------|-------|----------|-----------|
| TS-Reports-CRUD | 15 | 7 | 8 |
| TS-Reports-Confirmation | 12 | 0 | 12 |
| TS-Reports-Periods | 8 | 0 | 8 |
| TS-Reports-AutoReject | 5 | 0 | 5 |
| TS-Reports-Statistics | 8 | 0 | 8 |
| TS-Reports-Notifications | 4 | 0 | 4 |
| TS-Reports-Permissions | 8 | 0 | 8 |

### Session 106 Generated (5 new, all verified)
- TC-RPT-004: Report in closed period — blocked (Critical, UI)
- TC-RPT-008: Week navigation arrows (High, UI)
- TC-RPT-009: Batch create multiple cells (High, UI)
- TC-RPT-010: Decimal hours 1.5 (High, UI)
- TC-RPT-011: TAB stacking bug #3398 (High, UI)

### Prior Phase C Progress (other modules)

| Module | Cases | Verified | Failed | Blocked | Pending | Coverage |
|--------|-------|----------|--------|---------|---------|----------|
| t2724 | 38 | 38 | 0 | 0 | 0 | 100% |
| vacation | 100 | 26 | 0 | 3 | 71 | 26% |
| day-off | 121 | 25 | 0 | 3 | 0 | 21% |
| planner | 82 | 24 | 1 | 0 | 57 | 29% |
| t3404 | 24 | 21 | 0 | 3 | 0 | 88% |

### Phase C Goals
- Generate and verify autotest specs for all 60 reports test cases
- Generate and verify autotest specs for all 38 accounting test cases
- Write-back discovered selectors and patterns to vault
- Target: 80%+ verified rate per module
