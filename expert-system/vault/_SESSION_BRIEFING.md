---
session: 105
phase: autotest_generation
updated: '2026-03-21'
---
# Session 105 Briefing (Phase C — Autotest Generation)

**Date:** 2026-03-21
**Phase:** Autotest Generation (vacation scope)
**Tests verified:** 3 new (TC-163, TC-172, TC-102)
**Tests triaged:** 64 marked blocked, 2 fixed (TC-037, TC-076 tracking)
**Vacation scope status:** COMPLETE — 0 pending remaining

## What was done

Generated 3 tests, all verified passing on first attempt. Triaged all 64 remaining pending vacation tests, marking each with specific blocker reason. Fixed TC-037 and TC-076 tracking (were verified in session 104 but tracking not updated). Vacation module scope is now fully resolved — no pending tests remain.

| Test ID | Title | Type | Suite | Result |
|---------|-------|------|-------|--------|
| TC-VAC-163 | AV=true: Future vacations affect available days display | Hybrid UI+API+DB | TS-VAC-AVMultiYear | PASS |
| TC-VAC-172 | Past-date validation error returns specific error key | API | TS-VAC-APIErrors | PASS |
| TC-VAC-102 | Timeline audit gaps for payment events (KNOWN ISSUE) | DB read-only | TS-VAC-Payment | PASS |

## Vacation Scope Final Summary

| Status | Count | % |
|--------|-------|---|
| Verified | 100 | 57.8% |
| Blocked | 67 | 38.7% |
| Skipped | 5 | 2.9% |
| Covered | 1 | 0.6% |
| **Total** | **173** | **100%** |

### Blocker Categories (67 blocked)

| Blocker | Count | Tests |
|---------|-------|-------|
| Per-user auth (CAS login needed) | 16 | TC-053, 060, 061, 104-111, 113-117 |
| Maternity employee state | 12 | TC-081, 139, 143-152 |
| SO transfer / office change | 6 | TC-131-134, 159-160 |
| Timemachine / clock control | 6 | TC-011, 034, 101, 135, 140, 142 |
| Optional approvals (no API) | 4 | TC-059, 066-068 |
| Calendar manipulation | 3 | TC-086, 141, 158 |
| Norm deviation / payroll | 3 | TC-073-074, 138 |
| AV=false office user | 3 | TC-070, 078-079 |
| Concurrent requests | 2 | TC-054, 129 |
| Other env/data constraints | 12 | TC-072, 080, 085, 096, 112, 114, 115, 155-156, 166, 168 |

### What would unblock more tests

1. **CAS per-user login via Playwright** — unlocks 16 permission tests
2. **Timemachine env target** — unlocks 6 clock-dependent tests
3. **CS sync trigger** — unlocks 18 maternity + SO transfer tests
4. **Optional approval API** — unlocks 4 tests (requires backend change)

## Key Discoveries

1. **TC-163 confirms**: Future vacations DO affect availablePaidDays display. The FIFO distribution correctly deducts from earliest balance year. Creating a far-future vacation reduces the current UI display, and deletion restores it.
2. **TC-172 confirms**: API returns `validation.vacation.start.date.in.past` for past dates and `validation.vacation.dates.order` for reversed dates. Both are 400 responses with proper error structure.
3. **TC-102 confirms**: VACATION_PAID timeline events have `days_used=0`, `administrative_days_used=0`, `previous_status=NULL` — the audit gap is real and reproducible.
4. **Timeline column**: The column is `event_time` (not `created_at`) in `ttt_vacation.timeline`.

## Coverage

- **Vacation automated:** 100/173 (57.8%) — all feasible tests with current infrastructure
- **Week offsets used:** 278 (TC-163)
- **Scope recommendation:** Switch `autotest.scope` to `sick-leave` or `all` for next session

## Next Steps

- **Config change needed**: Set `autotest.scope: sick-leave` (or `all`) to proceed with next module
- **Also set `autonomy.stop: false`** to resume autonomous sessions
- **Alternatively**: Implement CAS per-user login fixture to unlock 16 vacation permission tests
