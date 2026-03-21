# TC-VAC-170: Past start date + end before start — both validation errors returned

## Description
Verifies that VacationCreateValidator.isStartEndDatesCorrect() returns **both** validation errors simultaneously when creating a vacation with a past start date AND an end date before the start date.

## Steps
1. POST /api/vacation/v1/vacations with startDate = 5 days ago, endDate = 10 days ago
2. Verify HTTP 400 response
3. Verify errorCode is "exception.validation"
4. Verify errors[] contains BOTH:
   - "validation.vacation.start.date.in.past" (on startDate field)
   - "validation.vacation.dates.order" (on startDate and/or endDate fields)
5. Verify NO additional validation errors (duration, next-year are short-circuited)
6. Verify no vacation entity was created

## Data
- **Login**: pvaynmaster (API_SECRET_TOKEN auth)
- **Start date**: 5 days in the past (dynamically computed)
- **End date**: 10 days in the past (before start date)
- **Payment type**: REGULAR
