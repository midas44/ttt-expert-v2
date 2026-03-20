---
type: analysis
tags:
  - autotest
  - progress
  - phase-c
updated: '2026-03-20'
status: active
---
# Autotest Generation Progress

## Overall Status (Session 95)

| Metric | Value |
|--------|-------|
| **Vacation automated** | 59/173 (34.1%) |
| **Vacation skipped** | 3 (TC-031, TC-058, TC-046) |
| **Vacation pending** | 111 |
| **Total across all modules** | 59/1071 (5.5%) |

## By Suite (vacation)

| Suite | Automated | Total | % |
|-------|-----------|-------|---|
| TS-Vac-Create | 13 | 20 | 65% |
| TS-Vac-Update | 8 | 15 | 53% |
| TS-Vac-StatusFlow | 10 | 15 | 67% |
| TS-Vac-DayCalc | 4 | 15 | 27% |
| TS-Vac-Payment | 8 | 15 | 53% |
| TS-Vac-Approval | 3 | 15 | 20% |
| TS-Vac-Schedule | 1 | 15 | 7% |
| TS-Vac-Permissions | 0 | 15 | 0% |
| TS-Vac-APIErrors | 1 | 13 | 8% |
| TS-Vac-UI-* | 0 | 35 | 0% |

## Blockers

1. **Permission tests (TS-Vac-Permissions):** Blocked by API_SECRET_TOKEN — system user bypasses permission checks. Needs per-user JWT via CAS or `get-full-jwt-token-using-pst`.
2. **canBeCancelled guard (TC-046):** paymentMonth validation prevents setup. Needs clock manipulation (timemachine env) or accountant role to advance report period.
3. **Optional approval API (TC-058):** No vacation optional approval endpoint exists. Only day-off has PATCH for optional approvals.
4. **UI tests:** Ready to begin (>30% API coverage threshold met). Need page object creation for vacation pages.

## Session History

| Session | Tests | IDs |
|---------|-------|-----|
| 84 | 5 | TC-001, 005, 039, 040, 118 |
| 85 | 5 | TC-041, 042, 044, 004, 006 |
| 86 | 5 | TC-002, 003, 045, 071, 171 |
| 87 | 5 | TC-010, 013, 027, 047, 130 |
| 88 | 5 | TC-007, 008, 014, 026, 030 |
| 89 | 5 | TC-009, 012, 015, 016, 036 |
| 90 | 5 | TC-024, 025, 028, 029, 049 |
| 91 | 5 | TC-022, 023, 032, 043, 052 |
| 92 | 5 | TC-048, 088, 089, 090, 092 |
| 93 | 4+1skip | TC-050, 051, 035, 057; skip:058 |
| 94 | 5+1skip | TC-121, 082, 091, 033, 087; skip:046 |
| 95 | 5 | TC-097, 100, 062, 084, 021 |
