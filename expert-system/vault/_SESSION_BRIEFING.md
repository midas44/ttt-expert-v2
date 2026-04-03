# Session Briefing — Phase C (Autotest Generation)

## Last Session: 109 (2026-04-03)
**Phase:** C — Autotest Generation
**Scope:** vacation, day-off (`autotest.scope`)
**Target Env:** qa-1
**Mode:** Full autonomy

## Session 109 Accomplishments

### 5 Vacation Payment Suite Tests — All Verified
| Test ID | Title | Type | Priority | Status | Attempts |
|---------|-------|------|----------|--------|----------|
| TC-VAC-029 | PAID vacation — terminal state, no further transitions | API | Critical | verified | 3 |
| TC-VAC-027 | Payment validation — wrong day sum rejected | API | High | verified | 1 |
| TC-VAC-028 | Cannot pay NEW vacation | API | High | verified | 1 |
| TC-VAC-031 | Payment month validation — closed period blocked | UI | High | verified | 1 |
| TC-VAC-033 | Error 500 on AV=true negative balance payment (#3363) | API | High | verified | 2 |

### New Artifacts Created
- **ApiVacationSetupFixture** — extended with `payVacation()`, `createApproveAndPay()`, `rawPut()`, `rawDelete()` methods; `VacationApiResult` now includes optional `days` field
- **5 data classes**: VacationTc027Data through VacationTc033Data
- **5 spec files**: vacation-tc027..tc033.spec.ts

### Key Discoveries & Fixes
1. **PAID vacation permission model**: cancel/reject return 403 (not 400) — permission service returns empty set for PAID status
2. **Update endpoint returns 405**: PUT to `/api/vacation/v1/vacations` with existing vacation body returns Method Not Allowed
3. **Ghost conflict bug**: server's crossing validation counts DELETED/CANCELED vacations, but `hasVacationConflict()` query excludes them — must use high week offsets (45+) to avoid dense areas of test detritus
4. **Same-user parallel execution**: tests sharing pvaynmaster cannot run in parallel due to employee_vacation row contention — must use `--workers=1` when testing payment suite together

### Vacation Module Autotest Progress
- Total tracked: 100 cases
- Verified: 31 (TC-VAC-001..011, 015..023, 025..029, 031, 033..038, 047..053)
- Blocked: 3
- Pending: 66
- Coverage: 31.0%

### Day-off Module Autotest Progress
- Total tracked: 28 cases
- Verified: 25
- Blocked: 3
- Pending: 0
- Coverage: 89.3% (fully covered minus blocked)

### Overall Autotest Progress
- Total: 332 cases
- Verified: 156
- Failed: 3
- Blocked: 9
- Pending: 164
- Coverage: 47.0%

### Next Session Priority
1. Continue vacation payment/transition tests: TC-VAC-030 (delete PAID+EXACT), TC-VAC-032 (auto-pay cron)
2. Vacation day balance tests: TC-VAC-057..063 (AV=true/false balance, FIFO, corrections)
3. Vacation notification tests: TC-VAC-064..070
4. Vacation regression tests: TC-VAC-071..084

## State
- Branch: dev35
- Config: `phase.current: "autotest_generation"`, `autotest.scope: "vacation,day-off"`
- All 31 verified vacation tests + 25 day-off tests pass reliably
