# TC-VAC-083: Available days — negative newDays accepted (bug)

**Type:** API | **Priority:** Low | **Suite:** TS-Vac-DayCalc

## Description

Tests that the GET /vacationdays/available endpoint accepts negative `newDays` parameter values
without validation. This is a known bug (BUG-5 from payment testing) — the `newDays` parameter
lacks a `@Min` annotation, so negative values pass through and inflate the available days calculation
(subtracting a negative number effectively adds days).

## Steps

1. Call endpoint with positive newDays=5 (baseline)
2. Call endpoint with newDays=0 (binary search mode)
3. Call endpoint with newDays=-5 (bug: should reject but returns 200)
4. Compare results — negative newDays inflates available days above positive result

## Data

- Read-only test, no vacation creation needed
- Uses pvaynmaster login with a future paymentDate
- No cleanup required
