# TC-VAC-043: REJECTED → APPROVED (re-approval without edit)

## Description
Multi-step status transition test: creates a vacation, rejects it, then approves it directly without editing dates first. This confirms the explicit `REJECTED→APPROVED` transition in `VacationStatusManager`: `add(REJECTED, APPROVED, ROLE_PROJECT_MANAGER, ROLE_DEPARTMENT_MANAGER, ROLE_ADMIN)`.

## Steps
1. POST create vacation (status = NEW)
2. PUT `/reject/{id}` (NEW → REJECTED)
3. POST `/{id}/approve` (REJECTED → APPROVED, no edit in between)
4. GET to confirm APPROVED status persisted

## Data
- **User:** pvaynmaster (CPO, self-approver)
- **Dates:** Mon-Fri week at offset 140 (conflict-free)

## Key Behavior
- Re-approval without editing is allowed by the state machine
- Dates remain unchanged (no edit between reject and re-approve)
- Known behavior (Bug #5 in vacation business rules) — may be intentional

## Cleanup
Cancel (APPROVED→CANCELED), then delete.
