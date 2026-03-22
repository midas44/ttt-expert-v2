# Autotest Generation Progress

## Overall Status (as of Session 40)
| Metric | Value |
|--------|-------|
| Total manifest test cases | 109 |
| Tracked in SQLite | 48 |
| Verified (passing) | 44 |
| Generated (unverified) | 2 |
| Failed | 1 |
| Blocked | 1 |
| Pending | 61 |
| **Coverage** | **44.0%** |

## Per-Session Generation History
| Session | Tests Generated | Tests Verified | Tests Failed | Notes |
|---------|----------------|---------------|-------------|-------|
| 28-29 | 5 | 5 | 0 | TC-001, TC-002, TC-003, TC-004, TC-005 |
| 30 | 4 | 4 | 0 | TC-013, TC-017, TC-021, TC-022 |
| 31 | 3 | 3 | 0 | TC-028, TC-031, TC-032 |
| 32 | 2 | 2 | 0 | TC-029, TC-030 |
| 33 | 3 | 3 | 0 | TC-018, TC-033, TC-034 |
| 34 | 5 | 5 | 0 | TC-024, TC-025, TC-026, TC-031, TC-032 |
| 35 | 4 | 4 | 0 | TC-029, TC-030, TC-033, TC-034 |
| 36 | 5 | 4 | 1 | TC-012, TC-016, TC-017, TC-018, TC-023 |
| 37 | 4+1fix | 5 | 0 | TC-011(fix), TC-083, TC-084, TC-087, TC-014 |
| 38 | 5 | 5 | 0 | TC-085, TC-086, TC-094, TC-079, TC-028(verify) |
| 39 | 5 | 0 | 0 | TC-048, TC-045, TC-056, TC-057, TC-035 (CAS timeout) |
| 40 | 5+3fix | 8 | 0 | TC-046, TC-060, TC-061, TC-074, TC-077 (new); TC-045, TC-056, TC-057 (re-verified); fixed getAvailableDays() |

## Key Fix: getAvailableDays() (Session 40)
- Root cause: "Available vacation days:" label and count ("30 in 2026") are in separate sibling DOM containers
- `text=/Available vacation days/` locator matched label element with no digits → returned 0
- Fix: `page.evaluate()` scans `<span>` elements for `/^\d+[\s\u00a0]+in[\s\u00a0]+\d{4}$/`
- Unblocked: TC-046, TC-061; confirmed TC-060 is genuine pass (not false positive)

## Still Pending from Previous Sessions
| Test ID | Status | Blocker |
|---------|--------|---------|
| TC-VAC-035 | generated | Redirect dialog selectors need live discovery |
| TC-VAC-048 | generated | Payment page name/date format mismatch |
| TC-VAC-011 | failed | Needs investigation |
| TC-VAC-023 | blocked | Needs investigation |
