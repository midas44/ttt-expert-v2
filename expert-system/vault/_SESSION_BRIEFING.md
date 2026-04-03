# Session Briefing — Phase C (Autotest Generation)

## Last Session: 114 (2026-04-03)
**Phase:** C — Autotest Generation
**Scope:** vacation, day-off (`autotest.scope`)
**Target Env:** qa-1
**Mode:** Full autonomy

## Session 114 Accomplishments

### 5 Verified + 1 Blocked Vacation Tests
| Test ID | Title | Type | Priority | Status | Attempts |
|---------|-------|------|----------|--------|----------|
| TC-VAC-085 | Owner can edit own vacation (not PAID) | UI | High | verified | 1 |
| TC-VAC-086 | Owner cannot edit PAID vacation | UI | High | verified | 1 |
| TC-VAC-087 | Non-approver cannot approve vacation | Hybrid | High | verified | 2 |
| TC-VAC-088 | ReadOnly user cannot create vacation | UI | Medium | verified | 3 |
| TC-VAC-071 | Regression: Overlapping vacations not blocked (#3240) | UI | High | verified | 1 |
| TC-VAC-090 | canBeCancelled guard after period close | Hybrid | High | blocked | 0 |

### New Artifacts Created
- **MyVacationsPage**: Added `getActionButtonCount()` method for verifying edit/cancel button presence
- **5 data classes**: VacationTc085Data, VacationTc086Data, VacationTc087Data, VacationTc088Data, VacationTc071Data
- **5 spec files**: vacation-tc085..tc088.spec.ts + vacation-tc071.spec.ts

### Key Discoveries & Fixes
1. **TC-VAC-087 SQL fix**: `SELECT DISTINCT ... ORDER BY random()` is invalid in PostgreSQL — `random()` must be in select list. Fixed by using `EXISTS` subquery instead of `DISTINCT JOIN`.
2. **TC-VAC-088 readOnly column location**: `read_only` column is in `ttt_backend.employee`, NOT `ttt_vacation.employee`. The vacation schema has no read_only concept — it's a backend-level permission.
3. **TC-VAC-088 frontend design issue**: ReadOnly users CAN see and click the "Create a request" button — the protection is server-side only (403 VacationSecurityException on submission). Test verifies server rejection rather than button hiding.
4. **TC-VAC-087 non-approver verification**: Uses Manager B (different manager) login to verify pvaynmaster's vacation doesn't appear in their approval queue. Also uses a foreign NEW vacation (approver != pvaynmaster) to verify API approve returns >= 400.
5. **TC-VAC-090 blocked**: Requires accounting period manipulation (advance report period past payment date). Only feasible on timemachine env with clock control — not safe on qa-1 as it affects other tests.
6. **TC-VAC-071 overlap detection**: Frontend shows validation error (crossing message) in the creation dialog when overlapping dates are selected, before Save is clicked. Bug #3240 fix confirmed working.

### Vacation Module Autotest Progress
- Total tracked: 100 cases
- Verified: 44 (+5 this session)
- Blocked: 9 (+1 this session)
- Pending: 47
- Coverage: 44.0%

### Day-off Module Autotest Progress
- Total tracked: 28 cases
- Verified: 25
- Blocked: 3
- Pending: 0
- Coverage: 89.3% (fully covered minus blocked)

### Overall Autotest Progress
- Total: 332 cases
- Verified: 169 (+5)
- Failed: 3
- Blocked: 15 (+1)
- Pending: 145
- Coverage: 50.9%

### Next Session Priority
1. Vacation regression tests: TC-VAC-072..084 (minus TC-VAC-071 done, TC-VAC-090 blocked)
2. Vacation validation: TC-VAC-039..046
3. Vacation filters: TC-VAC-050..056
4. Skip TC-VAC-068..070 (notification tests — QA-1 infra blocker)

## State
- Branch: dev35
- Config: `phase.current: "autotest_generation"`, `autotest.scope: "vacation,day-off"`
- All 44 verified vacation tests + 25 day-off tests pass reliably
- TC-VAC-090 blocked (needs timemachine env for period manipulation)
- TC-VAC-064..067 blocked (QA-1 notification infra not running)