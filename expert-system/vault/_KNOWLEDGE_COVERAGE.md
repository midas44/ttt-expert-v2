---
type: coverage
updated: 2026-03-27
phase: C (autotest_generation)
---

# Knowledge Coverage — Phase C Autotest Progress

## Current Scope: vacation

| Metric | Value |
|--------|-------|
| Total test cases in manifest | 100 |
| Verified (passing) | 5 |
| Failed | 0 |
| Blocked | 0 |
| Pending | 95 |
| **Coverage** | **5%** |

### Verified Tests
| Test ID | Title | Spec File |
|---------|-------|-----------|
| TC-VAC-001 | Create REGULAR vacation — happy path | vacation-tc001.spec.ts |
| TC-VAC-002 | Create ADMINISTRATIVE (unpaid) vacation | vacation-tc002.spec.ts |
| TC-VAC-005 | Edit vacation dates (NEW status) | vacation-tc005.spec.ts |
| TC-VAC-007 | Cancel NEW vacation | vacation-tc007.spec.ts |
| TC-VAC-008 | Cancel APPROVED vacation | vacation-tc008.spec.ts |

## All Modules Summary

| Module | Verified | Blocked | Pending | Total | Coverage |
|--------|----------|---------|---------|-------|----------|
| vacation | 5 | 0 | 95 | 100 | 5% |
| day-off | 25 | 3 | 0 | 28 | 89% |
| t3404 | 21 | 3 | 0 | 24 | 88% |
| **Total** | **51** | **6** | **95** | **152** | **34%** |
