# TC-VAC-055: Status transition — verify timeline events

**Type:** API | **Priority:** Medium | **Suite:** TS-Vac-StatusFlow

## Description

Verifies that status transitions (create → approve) publish events to the timeline table.
Each status change should create a timeline record with the correct event_type and metadata.

## Steps

1. Create vacation (NEW status)
2. Verify VACATION_CREATED event in timeline table (previous_status = null)
3. Approve the vacation (NEW → APPROVED)
4. Verify VACATION_APPROVED event in timeline table
5. Verify full event sequence: CREATED appears before APPROVED in chronological order

## Data

- REGULAR 5-day vacation for pvaynmaster
- Week offset 212+ for conflict avoidance
- Cleanup: cancel → delete after test
