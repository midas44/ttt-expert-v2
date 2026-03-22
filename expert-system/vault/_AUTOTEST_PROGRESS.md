# Autotest Generation Progress

**Updated:** 2026-03-22 (Session 45)
**Phase:** C — Autotest Generation
**Scope:** vacation module
**Target env:** qa-1

## Overall Metrics
| Metric | Count | Percentage |
|--------|-------|------------|
| Total test cases | 109 | 100% |
| Tracked (in DB) | 72 | 66.1% |
| Verified | 68 | 62.4% |
| Blocked | 2 | 1.8% |
| Failed | 1 | 0.9% |
| Skipped | 1 | 0.9% |
| Pending | 37 | 33.9% |

## Per-Suite Breakdown
| Suite | Total | Verified | Blocked | Failed | Skipped |
|-------|-------|----------|---------|--------|---------|
| TS-Vac-CRUD | 11 | 11 | 0 | 0 | 0 |
| TS-Vac-Cancel | 2 | 2 | 0 | 0 | 0 |
| TS-Vac-Chart | 5 | 5 | 0 | 0 | 0 |
| TS-Vac-DayCalc | 1 | 1 | 0 | 0 | 0 |
| TS-Vac-DayCorrection | 2 | 2 | 0 | 0 | 0 |
| TS-Vac-Lifecycle | 5 | 4 | 1 | 0 | 0 |
| TS-Vac-Payment | 4 | 4 | 0 | 0 | 0 |
| TS-Vac-Permissions | 4 | 4 | 0 | 0 | 0 |
| TS-Vac-Validation | 6 | 6 | 0 | 0 | 0 |
| TS-Vacation-Approval | 7 | 7 | 0 | 0 | 0 |
| TS-Vacation-AvailableDays | 2 | 2 | 0 | 0 | 0 |
| TS-Vacation-CRUD | 5 | 5 | 0 | 0 | 0 |
| TS-Vacation-DayCalc | 2 | 1 | 0 | 0 | 1 |
| TS-Vacation-DayCorrection | 1 | 1 | 0 | 0 | 0 |
| TS-Vacation-DayCounting | 2 | 2 | 0 | 0 | 0 |
| TS-Vacation-Lifecycle | 3 | 2 | 1 | 0 | 0 |
| TS-Vacation-Payment | 1 | 1 | 0 | 0 | 0 |
| TS-Vacation-Permissions | 5 | 5 | 0 | 0 | 0 |
| TS-Vacation-UI | 3 | 2 | 0 | 1 | 0 |
| TS-Vacation-ViewFilter | 1 | 1 | 0 | 0 | 0 |

## Blocked Tests
- **TC-VAC-023**: Requires accounting period close API (canBeCancelled guard)
- **TC-VAC-027**: Same — office.reportPeriod managed by accounting, not clock

## Session History (recent)
- **S45**: TC-VAC-070/071/072/019/020 (5 verified) — chart months/search/nav + pagination + events feed
- **S44**: TC-VAC-065/066/069/073 (4 verified), TC-VAC-027 blocked
- **S43**: TC-VAC-051/052/058/059/064 (5 verified)
- **S42**: TC-VAC-080/081/082/049/050 (5 verified)
- **S41**: TC-VAC-035/048 fixed, TC-VAC-075/076/078 (5 verified)