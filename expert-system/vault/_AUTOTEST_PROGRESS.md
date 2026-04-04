# Autotest Progress

## Coverage Summary (Session 124 — FINAL)

| Module | Verified | Blocked | Pending | Total | Rate |
|--------|----------|---------|---------|-------|------|
| vacation | 85 | 15 | 0 | 100 | 85% |
| day-off | 25 | 3 | 0 | 28 | 89% |
| **Total** | **110** | **18** | **0** | **128** | **86%** |

## Status: COMPLETE
All test cases in scope are covered (zero pending). 86% verified, 14% blocked by environment.

## Blocked Tests (Environment Issues)
These tests cannot pass due to QA-1 infrastructure problems, not code issues:

### Vacation Email Pipeline (4 tests)
- **TC-VAC-039,068,069,070**: RabbitMQ consumer for vacation notification topic is down/lagging on QA-1. Day-off emails work — issue is vacation-specific.

### Calendar Service (1 test)
- **TC-VAC-084**: Calendar API returns 502 Bad Gateway on QA-1.

### Auth/Environment Constraints (13 tests)
- Tests requiring clock manipulation (timemachine env), multi-user JWT, or TTT test endpoint auth that differs from vacation test endpoint auth.

## Re-verification Checklist
When QA-1 infrastructure is restored:
1. Re-run email notification tests (TC-VAC-039,068,069,070)
2. Re-run calendar test (TC-VAC-084)
3. Re-run TTT test endpoint tests when auth is fixed