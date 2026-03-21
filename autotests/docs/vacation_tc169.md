## TC-VAC-169: Update vacation start date to past — validation rejects

**Type:** API (Negative/Validation)
**Suite:** TS-VAC-PastDateVal
**Priority:** High

### Description

Verifies that updating a vacation's start date to a past date is rejected by the VacationUpdateValidator. The update validator delegates to `VacationCreateValidator.isStartEndDatesCorrect()`, which checks `startDate.isBefore(today)` — the same past-date check applies to both create and update paths (MR !5116, #3369 fix).

### Steps

1. **Create** a valid vacation with future dates via POST /api/vacation/v1/vacations
2. **Update** the vacation with a past start date via PUT /api/vacation/v1/vacations/{id}
3. **Verify** HTTP 400 with `errorCode: "exception.validation"` and `errors[].code: "validation.vacation.start.date.in.past"`
4. **Verify** the error targets the `startDate` field
5. **Verify** the vacation entity is unchanged via GET (original start date preserved)
6. **Cleanup** — DELETE the created vacation

### Data

- **Login:** pvaynmaster (API_SECRET_TOKEN auth)
- **Valid dates:** Future Mon-Fri week (offset 251, ~2031)
- **Past start date:** 5 days before today
- **Expected error:** `validation.vacation.start.date.in.past` on startDate field
