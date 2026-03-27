---
type: tracking
updated: 2026-03-27
phase: C
---

# Autotest Generation Progress

**Last updated:** Session 66 (2026-03-27)
**Target env:** qa-1
**Scope:** vacation (current)

## Overall Progress

| Status | Count | % |
|--------|-------|---|
| verified | 55 | 36.2% |
| blocked | 7 | 4.6% |
| pending | 90 | 59.2% |
| **Total tracked** | **152** | |

**Manifest total:** 245 test cases (vacation: 100, day-off: 121, sick-leave: 24)

## Vacation Module Progress

| Status | Count | % |
|--------|-------|---|
| verified | 9 | 9% |
| blocked | 1 | 1% |
| pending | 90 | 90% |
| **Total** | **100** | |

### Verified Tests (Session 65-66)
- TC-VAC-001: Create basic vacation (UI)
- TC-VAC-002: Delete NEW vacation (API setup + UI)
- TC-VAC-003: Create vacation with comment (UI)
- TC-VAC-004: Create with Also notify recipients (UI + DB verify)
- TC-VAC-005: Edit NEW vacation dates (API setup + UI)
- TC-VAC-006: Edit APPROVED → status resets to NEW (API setup + UI)
- TC-VAC-007: Approve vacation as manager (API setup + UI)
- TC-VAC-008: Cancel APPROVED vacation (API setup + UI)
- TC-VAC-010: View Request Details dialog (API setup + UI)

### Blocked Tests
- TC-VAC-009: Re-open CANCELED vacation — Cancel API sets DELETED not CANCELED; CANCELED→NEW not testable via UI

## Week Offset Registry (pvaynmaster — qa-1)

Prevents calendar date conflicts between tests using the same API token owner:

| Offset | Test ID | Description |
|--------|---------|-------------|
| 2 | TC-VAC-002 | Delete NEW vacation |
| 5 | TC-VAC-005 | Edit NEW dates |
| 6 | TC-VAC-008 | Cancel APPROVED |
| 7 | TC-VAC-006 | Edit APPROVED → NEW |
| 8 | TC-VAC-007 | Approve as manager (findEmployeeWithManager) |
| 9 | TC-VAC-009 | Re-open CANCELED (blocked) |
| 10 | TC-VAC-010 | View Request Details |

**Next available offset:** 11

## Key Discoveries (Phase C)

1. Cancel API (`PUT /v1/vacations/cancel/{id}`) sets DELETED, not CANCELED
2. Warning text in edit dialog is version-dependent — tests should check softly
3. `getFieldValue` pattern for VacationDetailsDialog reads dt/dd or strong/label pairs
4. Non-pvaynmaster vacations require UI cleanup (API returns 403 for non-owner delete)
5. `findEmployeeWithColleague` query supports Also notify recipient selection
