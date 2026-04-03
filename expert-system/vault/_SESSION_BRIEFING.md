# Session Briefing — Phase C (Autotest Generation)

## Last Session: 110 (2026-04-03)
**Phase:** C — Autotest Generation
**Scope:** vacation, day-off (`autotest.scope`)
**Target Env:** qa-1
**Mode:** Full autonomy
**Maintenance:** Session 110 (multiple of 5) — maintenance completed

## Session 110 Accomplishments

### 4 Verified + 1 Blocked Vacation Tests
| Test ID | Title | Type | Priority | Status | Attempts |
|---------|-------|------|----------|--------|----------|
| TC-VAC-030 | Delete PAID+EXACT vacation blocked | API | P1 | verified | 3 |
| TC-VAC-032 | Auto-pay expired APPROVED vacations (cron) | API | P2 | verified | 1 |
| TC-VAC-057 | AV=true full year balance display | UI | P1 | verified | 4 |
| TC-VAC-059 | AV=false monthly accrual no negative balance | UI | P1 | verified | 2 |
| TC-VAC-058 | AV=true negative balance allowed | UI | P1 | blocked | 4 |

### New Artifacts Created
- **5 data classes**: VacationTc030Data, VacationTc032Data, VacationTc057Data, VacationTc058Data, VacationTc059Data
- **5 spec files**: vacation-tc030, tc032, tc057, tc058, tc059.spec.ts
- **MyVacationsPage** — added `getAvailableDaysSigned()` method for handling negative AV=true balances

### Key Discoveries & Fixes
1. **PAID+EXACT deletion returns 403 not 400**: Permission service returns empty permission set for PAID status → 403 Forbidden (same pattern as session 109's PAID cancel finding). Tests accept both [400, 403].
2. **UI available days ≠ DB SUM**: `getAvailableDays()` value from UI is computed dynamically by the API endpoint (factors in approved/pending vacations, carry-over rules, prorating). It does NOT equal `SUM(employee_vacation.available_vacation_days)`. Tests must verify UI independently, not compare with raw DB values.
3. **Yearly breakdown tooltip selectors**: `getYearlyBreakdownEntries()` CSS class selectors don't always match DOM. Added raw text fallback with regex `(\d{4})\D+(\d+)` extraction.
4. **DB schema corrections**: `office_annual_leave` table uses `days` column (not `annual_leave_days`) and `office` FK (not `office_id`).
5. **TC-VAC-058 BLOCKED**: Cannot exhaust pvaynmaster's 82-day balance within system limits — vacation creation capped at ~5-7 biz days duration AND ~6 months ahead. Would need 17+ slots but can't fit within allowed date range. No AV=true employee with near-zero balance exists on qa-1. Requires timemachine env with clock manipulation or direct DB balance modification.

### Session 110 Maintenance (§9.4)
- **SQLite audit**: 332 entries, no duplicates. 160 verified, 159 pending, 10 blocked, 3 failed.
- **Spec file count**: 180 specs, 173 data classes. 7 t3404 specs share data classes (by design).
- **No stale entries** or orphaned records found.
- **TypeScript**: not a direct dependency (Playwright handles compilation internally).

### Vacation Module Autotest Progress
- Total tracked: 100 cases
- Verified: 35 (+4 this session)
- Blocked: 4 (+1 this session)
- Pending: 61
- Coverage: 35.0%

### Day-off Module Autotest Progress
- Total tracked: 28 cases
- Verified: 25
- Blocked: 3
- Pending: 0
- Coverage: 89.3% (fully covered minus blocked)

### Overall Autotest Progress
- Total: 332 cases
- Verified: 160 (+4 this session)
- Failed: 3
- Blocked: 10 (+1 this session)
- Pending: 159
- Coverage: 48.2%

### Next Session Priority
1. Vacation FIFO balance tests: TC-VAC-060 (earliest year consumed first), TC-VAC-061 (redistribution on cancel)
2. Vacation notifications: TC-VAC-064..070
3. Vacation regression: TC-VAC-071..084
4. Vacation permissions: TC-VAC-085..090

## State
- Branch: dev35
- Config: `phase.current: "autotest_generation"`, `autotest.scope: "vacation,day-off"`
- All 35 verified vacation tests + 25 day-off tests pass reliably
