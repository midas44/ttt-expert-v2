# Autotest Progress

## Overall Coverage (Session 125)

| Module | Manifest Total | Verified | Blocked | Failed | Pending | Coverage |
|--------|---------------|----------|---------|--------|---------|----------|
| vacation | 100 | 85 | 15 | 0 | 0 | 85% (100% addressed) |
| day-off | 28 | 25 | 3 | 0 | 0 | 89% (100% addressed) |
| sick-leave | 71 | 5 | 0 | 0 | 66 | 7% |
| t2724 | 38 | 38 | 0 | 0 | 0 | 100% |
| t3404 | 24 | 21 | 3 | 0 | 0 | 88% (100% addressed) |
| planner | 82 | 24 | 0 | 1 | 57 | 29% |
| reports | 60 | 17 | 0 | 2 | 41 | 28% |

### Absences Scope (current focus)
- **Total:** 199 test cases (vacation 100 + day-off 28 + sick-leave 71)
- **Verified:** 115 (58%)
- **Blocked:** 18 (9%)
- **Pending:** 66 (33%)
- **Target:** All sick-leave tests

### Sick-Leave Progress (started session 125)
**Verified (5):** TC-SL-001, TC-SL-006, TC-SL-008, TC-SL-010, TC-SL-011
**Key patterns established:**
- Page objects: MySickLeavePage, SickLeaveCreateDialog
- Data classes: SickLeaveTc001Data, SickLeaveSetupData
- DB queries: sickLeaveQueries.ts
- All tests use UI-based setup/cleanup (API auth returns 401/403)
- Details dialog: rc-dialog (`.rc-dialog-wrap`), not `role="dialog"`
- Action buttons: `data-testid="sickleave-action-*"` (edit, close, detail, attachments)
- No "more" menu — detail button opens rc-dialog panel
- Table date format: "dd – dd Mon yyyy"

### Blocked Tests (18 total)
**Vacation (15):** Email pipeline (4), calendar service (1), environment/auth (10)
**Day-off (3):** Environment-specific constraints
