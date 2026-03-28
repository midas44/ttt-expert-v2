# Autotest Generation Progress

## Overall Coverage (Phase C)

| Module | Total Cases | Automated | Pending | Coverage |
|--------|------------|-----------|---------|----------|
| t2724 | 38 | 30 | 8 | 78.9% |
| planner | 82 | 0 | 82 | 0.0% |
| **Total** | **120** | **30** | **90** | **25.0%** |

## t2724 Coverage by Suite

| Suite | Total | Automated | Coverage |
|-------|-------|-----------|----------|
| TS-T2724-CRUD | 7 | 7 | 100% |
| TS-T2724-Permission | 4 | 4 | 100% |
| TS-T2724-Edge | 4 | 4 | 100% |
| TS-T2724-CloseByTag | 10 | 10 | 100% |
| TS-T2724-Apply | 10 | 5 | 50% |
| TS-T2724-Regress | 3 | 0 | 0% |

**Note:** TS-T2724-Apply and TS-T2724-Regress overlap — TC-T2724-026..029 are apply tests, TC-T2724-030 is regression. All 5 verified in session 84.

## Session History

| Session | Tests Generated | Tests Verified | Cumulative |
|---------|----------------|---------------|------------|
| 79 | TC-T2724-001..005 | 5/5 | 5/38 |
| 80 | TC-T2724-006..010 | 5/5 | 10/38 |
| 81 | TC-T2724-011..015 | 5/5 | 15/38 |
| 82 | TC-T2724-016..020 | 5/5 | 20/38 |
| 83 | TC-T2724-021..025 | 5/5 | 25/38 |
| 84 | TC-T2724-026..030 | 5/5 | 30/38 |

## Remaining t2724 Tests (8 pending)

| Test ID | Title | Priority |
|---------|-------|----------|
| TC-T2724-031 | Bug 3 regression — correct column header in Tasks Closing tab | High |
| TC-T2724-032 | Bug 4 regression — OK button present in Tasks Closing tab | High |
| TC-T2724-033 | Bug 6 — cannot reopen popup on heavy data project | Medium |
| TC-T2724-034 | Bug 8 regression — auto-refresh after closing | Medium |
| TC-T2724-035 | Task order not disrupted after close-by-tag apply | Medium |
| TC-T2724-036 | Informational text on Tasks Closing tab | Medium |
| TC-T2724-037 | Confluence discrepancy — 200 char limit not enforced | Low |
| TC-T2724-038 | Apply error handling — silent failure on backend error | Medium |

Last updated: 2026-03-28 session 84