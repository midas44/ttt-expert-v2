---
type: analysis
tags:
  - coverage
  - phase-b
updated: '2026-03-25'
status: active
---
# Knowledge Coverage

## Day-Off Module — ~95%

### Phase A (Knowledge Acquisition) — Complete
- **Vault notes**: 14 (deep-dive, frontend, API testing, UI flows, data patterns, ticket findings, validation rules, business rules, conflict analysis)
- **GitLab tickets**: 25+ mined (descriptions + comments), 35 bugs documented (BUG-DO-1 through BUG-DO-35)
- **Investigation methods**: 6 (code reading, API testing, UI exploration, DB analysis, ticket mining, code analysis)
- **Sessions**: 9 (S4, S9, S13-S15, S32, S46-S47)

### Phase B (Test Documentation) — Complete
- **Test cases**: 121 (across 8 suites)
- **Generator**: `expert-system/generators/day-off/generate.py`
- **Output**: `test-docs/day-off/day-off.xlsx`
- **Sessions**: S48 (initial 99 cases), S49 (quality review +22 cases)

### Remaining Gaps (Minor)
- Race condition between Path A and Path B (separate MQ queues) — hard to test deterministically
- PAGE_SIZE=100 hard limit in Path D — requires employee with >100 day-offs/year
- Entity state bug in `updateAll()` — Java internal, not externally testable
- CANCELED status (dead code path) — no API to trigger

### Coverage by Feature
| Feature | Cases | Coverage |
|---------|-------|----------|
| Lifecycle (CRUD, display) | 17 | High |
| Approval (approve/reject/redirect/optional) | 20 | High |
| Calendar conflicts (4 paths) | 11 | High |
| Search & filter | 12 | High |
| Validation (form + API) | 12 | High |
| Permissions (roles, authorities) | 9 | Medium-High |
| Notifications (email, banner) | 11 | High |
| Regression (bug-specific) | 29 | High |
