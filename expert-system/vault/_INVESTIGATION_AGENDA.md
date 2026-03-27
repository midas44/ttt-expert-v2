---
type: agenda
updated: 2026-03-27
phase: C (autotest_generation)
---

# Investigation Agenda — Phase C (Autotest Generation)

## P0 — Immediate (Next Session)
- [ ] Generate vacation tests batch 2: TC-VAC-003, 004, 006, 009, 010
- [ ] TC-VAC-003: Create vacation with custom payment month
- [ ] TC-VAC-004: Create vacation — validation errors (overlap, insufficient days)
- [ ] TC-VAC-006: Reject vacation (needs approver login flow or API reject)
- [ ] TC-VAC-009: View vacation details dialog
- [ ] TC-VAC-010: Vacation table sorting/filtering

## P1 — Framework & Infrastructure
- [ ] Extract `toPeriodPattern` into shared utility (currently duplicated in 5 data classes)
- [ ] Add `cancelVacation` path fix to ApiVacationSetupFixture (probably `/cancel/{id}` like approve)
- [ ] Consider adding a `cleanupPvaynmasterVacations()` pre-test hook for resilience
- [ ] Investigate JWT-based auth for creating vacations as arbitrary employees

## P2 — Coverage Expansion (Sessions 67+)
- [ ] Continue through vacation manifest: approval flow, payment, multi-year balance
- [ ] Tackle hybrid test cases (API setup + UI verification)
- [ ] Target: 20-25 verified vacation tests by session 70

## Completed (Session 65)
- [x] Phase B→C transition with control file reset
- [x] First 5 vacation tests generated, debugged, verified: TC-VAC-001, 002, 005, 007, 008
- [x] Key infrastructure fixes: EN date patterns, language switching, approve API path, UI cleanup pattern
- [x] Session 65 maintenance (§9.4)

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
