---
session: 100
phase: autotest_generation
updated: '2026-03-20'
---
# Session 100 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-20
**Phase:** Autotest Generation (vacation scope)
**Tests generated:** 5 verified (TC-056, TC-164, TC-069, TC-165, TC-136)

## What was done

Generated and verified 5 vacation API tests on qa-1:

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-056 | Approve with crossing vacation — blocked | API | TS-Vac-StatusFlow | PASS |
| TC-VAC-164 | FIFO redistribution across year boundary (Dec→Jan) | API | TS-Vac-Balance-Redistribution | PASS |
| TC-VAC-069 | AV=false basic accrual formula — mid-year calculation | API | TS-Vac-DayCalc | PASS |
| TC-VAC-165 | Edit multi-year vacation — redistribution recalculates | API | TS-Vac-Balance-Redistribution | PASS |
| TC-VAC-136 | AV=true negative balance carry-over | API | TS-Vac-DayCalc | PASS |

JWT endpoint investigated — it's a token exchange (requires existing CAS JWT), not a generator. Cannot create tokens for arbitrary users via API.

## Key Discoveries

1. **Crossing check fires at CREATION time, not just approval** — `findCrossingVacations` includes ALL statuses (NEW, APPROVED, PAID, DELETED). Cannot create two overlapping vacations even as NEW. TC-056 confirms crossing is enforced at creation, contradicting the test case assumption that it only fires at approval.

2. **PUT /v1/vacations requires /{id} in URL path** — `PUT /v1/vacations` without the ID returns 405 Method Not Allowed. Must use `PUT /v1/vacations/{id}`.

3. **String(Date_object).slice(0,4) gives day-of-week, not year** — PostgreSQL pg driver returns JavaScript Date objects. `String(date).slice(0,4)` gives "Mon " or "Fri ", not "2036". Must use `new Date(val).getFullYear()` or `.toISOString().slice(0,4)`. Existing TC-084 has same latent bug but passes coincidentally (checks `!=` on two different weekdays).

4. **JWT endpoint is token exchange only** — `POST /v1/security/jwt` takes `{token: "<existing-CAS-JWT>"}` and returns a TTT-signed JWT. Cannot generate tokens from scratch. Permission-based tests (TS-Vac-Permissions, 15 cases) remain blocked at API layer.

5. **AV=false accrual verified linear** — availablePaidDays for AV=false increases linearly with paymentDate month. Delta(month3→month6) ≈ 3×(norm/12), delta(month6→month12) ≈ 6×(norm/12). Non-negative clamping confirmed.

6. **Edit vacation updates distribution** — shortening a cross-year vacation from Dec→Jan to Dec-only correctly recalculates vacation_days_distribution (fewer rows, lower total matching new regularDays).

## Coverage

- **Vacation automated:** 84/173 (48.6%)
- **Total automated:** 84/1071 (7.8%)
- **Skipped:** 5 (TC-VAC-031, TC-VAC-058, TC-VAC-046, TC-VAC-099, TC-VAC-126)

## Week Offsets Used

- TC-056: offset 230 (two overlapping vacations — crossing at creation confirmed)
- TC-164: years 2032-2034 (Dec 15 → Jan 9 cross-year range)
- TC-165: years 2035-2037 (Dec 18 → Jan 5, shortened to Dec 24)
- TC-136: offset 239 (5-day vacation for balance decrease verification)
- TC-069: no offsets (read-only accrual formula test)

## Next Session Candidates

- **Begin UI test generation** — at 48.6%, well past API-first threshold
- **TS-Vac-DayCalc remaining**: TC-070 (AV=false negative shows 0), TC-072 (AV=true negative allowed), TC-075-077 (FIFO consumption/cancel/auto-convert)
- **TS-Vac-Balance-Redistribution**: TC-164/165 done, remaining cases need multi-vacation setups
- **TS-Vac-Permissions**: 15 cases, all blocked by JWT (need UI tests via Playwright login)
- **Fix TC-084 latent bug**: String(Date).slice(0,4) gives weekday, not year — passes coincidentally
- **TC-096 still deferred**: approve/report period gap doesn't exist on qa-1
