---
session: 103
phase: autotest_generation
updated: '2026-03-21'
---
# Session 103 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-21
**Phase:** Autotest Generation (vacation scope)
**Tests verified:** 4 new (TC-169, TC-173, TC-137, TC-161)
**Tests blocked:** 2 (TC-019, TC-017 — @CurrentUser DTO validator)

## What was done

Generated 5 tests, 4 verified passing, 1 blocked by DTO validator. Also ran session 20 maintenance.

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-169 | Update start date to past — validation rejects | API | TS-VAC-PastDateVal | PASS |
| TC-VAC-173 | Year-end balance unbounded sum (#3360 fix) | API+DB | TS-VAC-PastDateVal | PASS (fix: API /years filters zero-balance years) |
| TC-VAC-137 | Multi-year accumulated balance with FIFO | API+DB | TS-Vac-Supplement | PASS |
| TC-VAC-161 | availablePaidDays after cross-year vacation | API+DB | TS-VAC-AVMultiYear | PASS |
| TC-VAC-019 | Regular employee auto-approver assignment | API | TS-Vac-Create | BLOCKED (@CurrentUser validator) |

## Key Discoveries

1. **@CurrentUser DTO validator blocks multi-user tests**: `VacationCreateRequestDTO.login` has `@CurrentUser(groups=CreateGroup.class)` which validates the login matches the authenticated user at DTO level (before service logic). API_SECRET_TOKEN maps to pvaynmaster — cannot create vacations for other employees. This blocks TC-019, TC-017, and any "different user" create tests.
2. **API /vacationdays/{login}/years filters zero-balance years**: DB has years 2023-2027 but API only returns years with days > 0 (2025-2027). This is display behavior, not a bug.
3. **vacation_days_distribution confirms FIFO**: After creating a 5-day vacation, distribution table shows days consumed from earliest year (2025) with positive balance.

## Coverage

- **Vacation automated:** 94/173 (54.3%)
- **Total automated:** 94/1071 (8.8%)
- **Skipped:** 5 (TC-031, TC-058, TC-046, TC-099, TC-126)
- **Blocked:** 2 (TC-019, TC-017 — @CurrentUser DTO validator)
- **Blocked categories (unchanged):**
  - Per-user auth needed: TC-053, TC-104-116 (permissions suite) + TC-019, TC-017
  - Timemachine clock needed: TC-011, TC-034, TC-135
  - Pass endpoint NPE: TC-067, TC-068
  - Complex employee state: TC-085, TC-132, TC-138, TC-139, TC-148, TC-152

## Week Offsets Used

- TC-169: 251, TC-173: 257, TC-137: 260
- TC-161: cross-year 2037-12-22 → 2038-01-09

## Session 20 Maintenance

- Audited SQLite tables: 171 analysis_runs, 26 module_health, 146 design_issues, 223 exploration_findings, 1071 autotest_tracking
- No duplicate test_id entries found
- No orphan verified records without spec_file
- Vault note updated with @CurrentUser discovery

## Next Session Candidates

- **Remaining feasible vacation API tests are nearly exhausted** — most pending tests require per-user auth, timemachine clock, pass endpoint fix, or complex employee state
- **Consider scope expansion**: switch `autotest.scope` to `sick-leave` or `"all"` to start next module
- **CAS login investigation**: implementing Playwright-based CAS login would unblock ~20 vacation tests (permissions suite + different-user tests)
- **Timemachine env**: switching target_env to timemachine would unblock TC-011, TC-034, TC-135
