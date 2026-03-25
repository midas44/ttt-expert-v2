---
session: 46
phase: knowledge_acquisition
updated: '2026-03-25'
scope: day-off
---
# Session 46 — Day-Off GitLab Ticket Mining

## Session Info
- **Date**: 2026-03-25
- **Phase**: A (knowledge_acquisition)
- **Scope**: day-off
- **Autonomy**: full
- **Duration**: ~session completed

## What Was Done

### GitLab Ticket Mining (P0 — COMPLETED)
Mined 25+ GitLab tickets related to day-off, calendar, and weekend transfer functionality using multiple search strategies (keywords: "day-off", "dayoff", "weekend", "production calendar"). Read BOTH descriptions AND comments for all critical tickets.

**Search approach**: 4 keyword searches + targeted individual ticket reads via 4 parallel agents. Coverage: Sprint 7 through Sprint 15, all states (open + closed).

### Key Findings

**6 categories of bugs identified:**

1. **Calendar Cascade Bugs (HIGHEST RISK)** — 6 tickets: #3339 (balance zeroed), #3338 (wrong vacations converted), #3282 (double-transfer cleanup regression), #2971 (OPEN: confirmed transfer survives SO change), #3300 (calendar applied to wrong years), #3221 (cross-calendar deletion)

2. **Transfer Bugs** — 5 tickets: #2962 (silent Access Denied), #2801 (500 on reused date), #2833 (vacation not recalculated), #2901 (norm not recalculated with sick leave), #2874 (backward transfer feature with 3 bugs)

3. **UI Display Bugs** — 3 tickets: #3094, #2815, #2818 (pending transfer shown with wrong colors/highlights)

4. **Availability Chart Bugs** — 3 tickets: #3312, #3292, #3212 (calendar events missing, pre-2024 data, reinstatement)

5. **Cross-Feature Interactions** — 3 tickets: #3223 (balance not updated on auto-deletion), #2736 (event feed with 3 bugs), #3179 (digest merging)

6. **Feature/Design Tasks** — 3 tickets: #2621 (original analytical task), #2733, #2952

**2 tickets still OPEN**: #2971 (confirmed transfer survives SO change), #2621 (analytical task)

### Vault Updates
- **Created**: `exploration/tickets/day-off-ticket-findings.md` — comprehensive ticket findings (25+ tickets, structured by category)
- **Enriched**: `analysis/sick-leave-dayoff-business-rules-reference.md` — added sections B12 (edge cases), B13 (20 new bugs BUG-DO-16 through BUG-DO-35), B14 (cross-references)
- **SQLite**: 1 analysis_run + 10 external_refs logged
- **Index**: Updated with new ticket findings note

## Knowledge State

### Day-Off Module — Existing Notes (Pre-Session 46)
- `dayoff-service-deep-dive.md` — ~3000 words, detailed code analysis ✓
- `frontend-day-off-module.md` — ~800 words, component tree, UI flows ✓
- `dayoff-form-validation-rules.md` — ~600 words, frontend+backend validation ✓
- `dayoff-api-testing.md` — ~800 words, 7 bugs from API testing ✓
- `day-off-pages.md` — ~1200 words, UI exploration with screenshots ✓
- `sick-leave-dayoff-business-rules-reference.md` — ~3000 words Part B section ✓
- 5 additional notes: conflict code analysis, conflict data analysis, conflict live test, rescheduling data patterns, rescheduling warning bug

### Session 46 Additions
- `day-off-ticket-findings.md` — ~3000 words, 25+ tickets, 20+ bugs documented
- Business rules reference enriched with ~2500 words (B12-B14 sections)
- Total new known bugs: BUG-DO-16 through BUG-DO-35 (20 additional bugs from tickets)
- **Total known day-off bugs**: 35 (BUG-DO-1 through BUG-DO-35)

## Next Steps (Session 47)
1. **Assess Phase A→B transition readiness** — GitLab tickets now mined, vault notes are deep. Check remaining gaps.
2. **UI exploration of manager approval flow** — WeekendDetailsModal, approve/reject/redirect in detail
3. **Check Qase for existing day-off test cases** — avoid duplication in Phase B
4. **Consider Phase A→B transition** — vault has 13+ notes, 35 bugs, deep code analysis, API testing, UI exploration, DB analysis, and now ticket mining. Coverage may be sufficient.
