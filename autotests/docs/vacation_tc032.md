# TC-VAC-032: Update with overlapping dates

## Description
Validation test: creates two non-overlapping vacations (A and B), then attempts to update B's dates to overlap with A. The `findCrossingVacations()` check excludes the vacation being updated (self) but catches overlaps with other vacations.

## Steps
1. POST create vacation A (Mon-Fri at week offset 128)
2. POST create vacation B (Mon-Fri at week offset 132, non-overlapping)
3. PUT update B with dates matching A (guaranteed overlap)
4. Verify: HTTP 400 with `exception.validation.vacation.dates.crossing`
5. GET B to confirm dates unchanged

## Data
- **User:** pvaynmaster
- **Vacation A:** conflict-free week at offset 128
- **Vacation B:** conflict-free week at offset 132
- **Overlap update:** sets B's dates to exactly match A

## Cleanup
Delete both vacations via DELETE endpoint.
