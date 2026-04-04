# Autotest Progress

## Last Updated: Session 122 — 2026-04-04

## Coverage Summary

| Module | Verified | Blocked | Pending | Total | Coverage |
|--------|----------|---------|---------|-------|----------|
| vacation | 83 | 11 | 6 | 100 | 83% |
| day-off | 25 | 3 | 0 | 28 | 89% |
| **Total** | **108** | **14** | **6** | **128** | **84%** |

## Remaining Pending Tests (6)

### Notification Tests (vacation/notifications)
- **TC-VAC-068**: Also-notify recipients receive notification — email DB check
- **TC-VAC-069**: Wrong payment month in notification (#2925) — OPEN bug regression
- **TC-VAC-070**: Notification on auto-conversion to ADMINISTRATIVE (#3015) — complex setup

### Regression Tests (vacation/regression)
- **TC-VAC-076**: last_date not updated during CS sync (#3374) — API sync trigger
- **TC-VAC-084**: Calendar change converts ALL vacations (#3338) — admin calendar mod

### Concurrency (vacation/api)
- **TC-VAC-100**: Batch deadlock on concurrent operations — parallel API requests

## Blocked Tests (14)

### Vacation (11)
- TC-VAC-024, 039: Self-approval / CPO self-approve — pvaynmaster role conflict
- TC-VAC-097: Sick leave crossing — API_SECRET_TOKEN 403 on sick leave endpoint
- TC-VAC-057..058: Salary office filter — complex filter + dropdown selectors
- Others: Various auth/permission constraints

### Day-off (3)
- TC-DO-024, 025, 026: Complex approval workflow edge cases

## Session History (Recent)
| Session | Tests Verified | Cumulative |
|---------|---------------|------------|
| 122 | 5 (TC-VAC-094,095,096,098,099) + 1 blocked (097) | 108/128 (84%) |
| 121 | 5 (TC-VAC-080,081,082,092,093) | 103/128 (80%) |
| 120 | 5 (TC-VAC-055,078,083,089,091) | 98/128 (77%) |
| 119 | 5 (TC-VAC-011,012,013,014,054) | 93/128 (73%) |
| 118 | 5 (TC-VAC-022,072,075,077,079) | 88/128 (69%) |