---
type: analysis
tags:
  - autotest
  - progress
  - phase-c
updated: '2026-03-21'
status: active
---
# Autotest Generation Progress

## Overall Status (Session 22 — Post-Reset)

All previous autotests were deleted (commit `3224806`) due to quality issues. Regeneration started from scratch with updated generation guidelines.

| Metric | Value |
|--------|-------|
| **Vacation automated** | 4/173 (2.3%) |
| **Vacation blocked** | 1 (TC-001: AV=false requires non-pvaynmaster user) |
| **Vacation pending** | 168 |
| **Total across all modules** | 4/1071 (0.4%) |

## Verified Tests

| Test ID | Type | Description | Status |
|---------|------|-------------|--------|
| TC-VAC-002 | API | REGULAR vacation happy path (AV=true) | verified |
| TC-VAC-003 | API | ADMINISTRATIVE vacation (unpaid, 1 day) | verified |
| TC-VAC-004 | API | Negative — past start date | verified |
| TC-VAC-005 | API | Negative — reversed dates (start > end) | verified |
| TC-VAC-001 | API | REGULAR vacation (AV=false) | blocked |

## Blockers

1. **TC-VAC-001 (AV=false):** `@CurrentUser` annotation forces API_SECRET_TOKEN to authenticate as `pvaynmaster`, who is in AV=true office (Персей, office_id=20). Cannot test AV=false path via API without a different token or user.
2. **Permission tests:** Blocked by API_SECRET_TOKEN — system user bypasses permission checks. Needs per-user JWT.

## Key Discoveries (Session 22)

- API response wraps data in `{ vacation: {...}, vacationDays: {...} }` — not flat
- Error response: top-level `errorCode` is always `exception.validation`; specific codes in `errors[].code`
- `@CurrentUser` constraint documented in vault: `exploration/api-findings/vacation-api-response-format.md`
- All API tests must use `pvaynmaster` login (or env var override)

## Session History

| Session | Tests | IDs |
|---------|-------|-----|
| 22 | 5 (4 pass, 1 blocked) | TC-001(blocked), 002, 003, 004, 005 |
