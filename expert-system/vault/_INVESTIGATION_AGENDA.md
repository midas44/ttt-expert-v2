---
type: agenda
updated: 2026-03-27
phase: C (autotest_generation)
---

# Investigation Agenda — Phase C (Autotest Generation)

## P0 — Immediate (Next Session)
- [ ] Continue vacation autotests — pick 5 from pending (avoid multi-user tests)
- [ ] TC-VAC-011: Yearly breakdown tooltip
- [ ] TC-VAC-022: Approval resets on date edit — may be blocked (two-user)
- [ ] TC-VAC-009: View vacation details dialog
- [ ] TC-VAC-040-046: Table sorting/filtering tests (pagination-aware)
- [ ] TC-VAC-050+: Remaining filter and view tests

## P1 — Framework & Infrastructure
- [ ] Extract `toPeriodPattern` into shared utility (duplicated in 7+ data classes now)
- [ ] Add `cleanupPvaynmasterVacations()` pre-test hook for resilience
- [ ] Investigate JWT-based auth for creating vacations as arbitrary employees
- [x] Fix `deleteVacation` to use hard-delete test endpoint (done session 70)
- [x] Add `goToLastPage()` pagination method to MyVacationsPage (done session 70)

## P2 — Knowledge Gaps Found
- [ ] Document which vacation statuses appear on which tabs comprehensively
- [ ] Investigate CANCELED status — why it's excluded from all tabs
- [ ] Map pagination behavior across different tab types

## Completed (Sessions 65-70)
- [x] TC-VAC-001-008, 010, 015-021, 023, 025 verified (sessions 65-69)
- [x] TC-VAC-034-038 verified (session 69)
- [x] TC-VAC-047 (Open tab filter) verified (session 69)
- [x] TC-VAC-048 (Closed tab filter) verified — changed CANCELED→REJECTED (session 70)
- [x] TC-VAC-049 (All tab filter) verified — changed CANCELED→REJECTED (session 70)
- [x] TC-VAC-024 marked blocked (two-user workflow) (session 70)
- [x] ApiVacationSetupFixture: hard-delete cleanup (session 70)
- [x] Discovered: CANCELED vacations not shown on any tab (session 70)
- [x] Session 70 maintenance (§9.4)

<details>
<summary>Completed from Previous Phases</summary>

### Phase B (Sessions 59-64)
- [x] Vacation XLSX: 100 test cases across 7 suites
- [x] Deep-dive vault enrichment for vacation module (3000+ words)
- [x] GitLab ticket mining (all history, descriptions + comments)
- [x] UI exploration via Playwright for all vacation pages

### Phase A (Sessions 1-58)
- [x] Full knowledge acquisition across all modules
- [x] Day-off and t3404 autotest generation (previous Phase C scopes)
</details>
