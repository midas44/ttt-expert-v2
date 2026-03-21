## TC-VAC-172: Past-date validation error — raw key display (API verification)

**Type:** API
**Suite:** TS-VAC-APIErrors
**Priority:** Medium

### Description

Verifies API error responses for vacation creation with invalid dates (past start date, reversed date order). Documents the known UX defect where the frontend displays raw validation key strings instead of human-readable translations.

### Steps

1. POST /vacations with startDate = yesterday — expect 400 with validation error key
2. POST /vacations with startDate > endDate — expect 400 with dates.order error key
3. Document untranslated vs translated error keys

### Data

- **User:** pvaynmaster
- **Past date:** Dynamically computed (yesterday from current date)
- **Reversed dates:** Future dates with start after end

### Known Defect

Frontend i18n files lack translations for:
- `validation.vacation.start.date.in.past`
- `validation.vacation.dates.order`
- `validation.vacation.next.year.not.available`

Only these keys have proper translations:
- `exception.validation.vacation.duration` -> "You don't have enough available vacation days"
- `exception.validation.vacation.too.early` -> "Vacation request can be created after 6 months..."
