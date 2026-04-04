# Autotest Progress

## Last Updated: Session 123 — 2026-04-04

## Coverage Summary

| Module | Verified | Blocked | Pending | Total | Coverage |
|--------|----------|---------|---------|-------|----------|
| vacation | 84 | 15 | 1 | 100 | 84% |
| day-off | 25 | 3 | 0 | 28 | 89% |
| **Total** | **109** | **18** | **1** | **128** | **85%** |

## Remaining Pending Tests (1)

### Concurrency (vacation/api)
- **TC-VAC-100**: Batch deadlock on concurrent operations — parallel API requests

## Blocked Tests (18)

### Vacation (15)
- TC-VAC-024, 039: Self-approval / CPO self-approve — pvaynmaster role conflict
- TC-VAC-057, 058: Salary office filter — complex filter + dropdown selectors
- TC-VAC-068, 069, 070: Notification tests — QA-1 vacation email pipeline not generating emails (RabbitMQ consumer issue)
- TC-VAC-076: CS sync regression — test works but confirms OPEN bug #3374 (expected failure)
- TC-VAC-084: Calendar change regression — calendar service 502 on QA-1
- TC-VAC-097: Sick leave crossing — API_SECRET_TOKEN 403 on sick leave endpoint
- Others: Various auth/permission constraints

### Day-off (3)
- TC-DO-024, 025, 026: Complex approval workflow edge cases

## Environment Issues (Session 123)
1. **Vacation email notifications not generating** — RabbitMQ consumer for vacation topic may be down
2. **Calendar service 502** — cannot modify production calendar
3. **TTT test endpoints reject API_SECRET_TOKEN** — different auth than vacation

## Session History (Recent)
| Session | Tests Generated | Verified | Blocked | Cumulative |
|---------|----------------|----------|---------|------------|
| 123 | 5 (TC-VAC-068,069,070,076,084) | 1 (076) | 4 (068,069,070,084) | 109/128 (85%) |
| 122 | 5 (TC-VAC-094,095,096,098,099) + 1 blocked (097) | 5 | 1 | 108/128 (84%) |
| 121 | 5 (TC-VAC-080,081,082,092,093) | 5 | 0 | 103/128 (80%) |
| 120 | 5 (TC-VAC-055,078,083,089,091) | 5 | 0 | 98/128 (77%) |
| 119 | 5 (TC-VAC-011,012,013,014,054) | 5 | 0 | 93/128 (73%) |
| 118 | 5 (TC-VAC-022,072,075,077,079) | 5 | 0 | 88/128 (69%) |