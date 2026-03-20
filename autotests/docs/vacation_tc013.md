# TC-VAC-013: Create overlapping vacation (start inside existing)

**Suite:** TS-Vac-Create | **Priority:** High | **Type:** API

## Description
Verifies that the API rejects creating a vacation whose start date falls inside an existing vacation's date range. Creates vacation A (Mon-Fri), then attempts vacation B starting Wednesday within A's range. Expects a 400 with the crossing dates validation error.

**Key discovery:** The `ValidationException` for overlapping dates serializes the `exception.validation.vacation.dates.crossing` code into the `message` field of the error response, not the `errorCode` field. Assertions must check the `message` field.

## Steps
1. POST /api/vacation/v1/vacations — create vacation A (Mon-Fri, full week)
2. Verify response: HTTP 200, status=NEW, capture vacation A ID
3. POST /api/vacation/v1/vacations — create vacation B starting Wednesday of the same week (overlaps with A)
4. Verify response: HTTP 400
5. Verify error body: `message` field contains `exception.validation.vacation.dates.crossing`
6. Cleanup: DELETE /api/vacation/v1/vacations/{vacationA_id}

## Data
- **Data class:** VacationTc013Data (dynamic, uses findAvailableWeek with offset 54)
- **Vacation A:** Mon-Fri of target week
- **Vacation B:** Wed-Fri of same week (start inside A's range)
- **Spec:** vacation-tc013.spec.ts
