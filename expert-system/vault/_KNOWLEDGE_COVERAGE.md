# Knowledge Coverage — Phase C (Autotest Generation)

## Overall Autotest Coverage: 49.6% (137/276 verified)

| Module | Verified | Failed | Blocked | Pending | Total | Coverage |
|--------|----------|--------|---------|---------|-------|----------|
| day-off | 25 | 0 | 3 | 0 | 28 | 89.3% |
| vacation | 26 | 0 | 3 | 71 | 100 | 26.0% |
| t2724 | 38 | 0 | 0 | 0 | 38 | 100% |
| t3404 | 21 | 0 | 3 | 0 | 24 | 87.5% |
| planner | 24 | 1 | 0 | 57 | 82 | 29.3% |
| reports | 3 | 1 | 0 | 0 | 4 | 75.0%* |
| accounting | 0 | 0 | 0 | 0 | 0 | 0%** |

*Reports: 4 tracked out of ~60 total test cases — only CRUD suite started
**Accounting: not yet started — 38 test cases in manifest

## Current Scope: reports, accounting
- Reports CRUD suite: 3 verified, 1 failed, ~12 remaining in suite
- Reports total: ~60 test cases across 7 suites
- Accounting total: ~38 test cases across 6 suites

## Completed Modules
- t2724: 100% (38/38)
- day-off: 89.3% (25/28, 3 blocked)
- t3404: 87.5% (21/24, 3 blocked)

## In Progress
- reports: Phase C active (session 95+)
- planner: 29.3% (24/82 verified, 57 pending — paused for reports scope)
- vacation: 26.0% (26/100 verified, 71 pending — paused)

Updated: 2026-03-28 (Session 95)
