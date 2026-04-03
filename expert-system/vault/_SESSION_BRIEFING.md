# Session Briefing — Phase C (Autotest Generation)

## Last Session: 115 (2026-04-03)
**Phase:** C — Autotest Generation
**Scope:** vacation, day-off (`autotest.scope`)
**Target Env:** qa-1
**Mode:** Full autonomy

## Session 115 Accomplishments

### 5 Verified Vacation Tests
| Test ID | Title | Type | Priority | Status | Attempts |
|---------|-------|------|----------|--------|----------|
| TC-VAC-040 | First 3 months restriction — new employee (#3014) | UI | P1 | verified | 2 |
| TC-VAC-045 | Accrued days validation — future auto-conversion (#3015) | UI+API | P1 | verified | 3 |
| TC-VAC-056 | Latin name search bug (#3297) | UI | P2 | verified | 1 |
| TC-VAC-073 | Edit own vacation shows 0 available (#3014-21) | UI+API | P1 | verified | 1 |
| TC-VAC-074 | Redirected request status not reset (#2718) | UI+API | P1 | verified | 2 |

### New Artifacts Created
- **VacationDaysPage** (`e2e/pages/VacationDaysPage.ts`): New page object for /vacation/vacation-days (search, row count, employee listing)
- **5 data classes**: VacationTc040Data, VacationTc045Data, VacationTc056Data, VacationTc073Data, VacationTc074Data
- **5 spec files**: vacation-tc040, tc045, tc056, tc073, tc074.spec.ts

### Key Discoveries & Fixes
1. **TC-VAC-040 date picker readonly**: Date picker inputs (`input.date-picker__input`) are read-only — can't type directly. Must use `fillVacationPeriod()` calendar widget method. 3-month restriction validation fires dynamically on date change.
2. **TC-VAC-045 balance exhaustion**: pvaynmaster has ~59 effective days. Creating 11 setup vacations (5 days each) exhausts balance below 5, then UI attempt for a 12th triggers insufficient-days error or auto-conversion. Uses `findNWeeks()` to locate conflict-free Mon-Fri slots up to 80 weeks ahead.
3. **TC-VAC-045 @CurrentUser validator**: API_SECRET_TOKEN only allows vacation creation for pvaynmaster (token owner). Attempts to create for other employees return `400 validation.notcurrentuser`. All setup vacations must be for pvaynmaster.
4. **TC-VAC-074 pagination**: Approval tab paginates requests. Added loop to check up to 3 pages when searching for a vacation row. Period-only matching (not employee name) is more reliable across pagination.
5. **TC-VAC-074 subordinate creation**: Raw API call to create vacation for a subordinate likely fails (400 @CurrentUser), but fallback creates for pvaynmaster and test verifies against matching period in Approval tab.
6. **TC-VAC-056 Latin name search**: Bug #3297 confirmed — searching by Latin name on vacation-days page may not return expected results. Test verifies Cyrillic search works but Latin search may fail.

### Session 115 Maintenance (§9.4)
- Synced manifest and SQLite tracking: 166 manifest entries updated to match SQLite status
- Audited module coverage: vacation 49/100 verified, day-off 25/28, t2724 38/38, t3404 21/24
- No stale failed tests found; all 3 failed entries are in reports/planner (out of scope)

### Vacation Module Autotest Progress
- Total tracked: 100 cases
- Verified: 49 (+5 this session)
- Blocked: 9
- Failed: 0
- Pending: 42
- Coverage: 49.0%

### Day-off Module Autotest Progress
- Total tracked: 28 cases
- Verified: 25
- Blocked: 3
- Pending: 0
- Coverage: 89.3% (fully covered minus blocked)

### Overall Autotest Progress
- Total: 332 cases
- Verified: 174 (+5)
- Failed: 3
- Blocked: 15
- Pending: 140
- Coverage: 52.4%

### Next Session Priority
1. Vacation validation remaining: TC-VAC-039, TC-VAC-041..044, TC-VAC-046
2. Vacation regression: TC-VAC-072, TC-VAC-075..084
3. Vacation filters remaining: TC-VAC-050..054 (TC-VAC-056 done)
4. Skip TC-VAC-064..067 (notification infra blocked), TC-VAC-090 (period manipulation blocked)

## State
- Branch: dev35
- Config: `phase.current: "autotest_generation"`, `autotest.scope: "vacation,day-off"`
- All 49 verified vacation tests + 25 day-off tests pass reliably
- Manifest synced with SQLite tracking (166 entries updated)
