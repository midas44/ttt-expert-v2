# Investigation Agenda

## Phase C — Autotest Generation (absences: vacation, day-off, sick-leave)

### P0 — Immediate (Next Session: sick-leave continued)
- [ ] Generate sick-leave CRUD tests: TC-SL-002 (create with number), TC-SL-003 (create with attachments), TC-SL-004 (validation: end before start), TC-SL-005 (validation: overlapping dates)
- [ ] Generate sick-leave edit tests: TC-SL-007 (edit number field)
- [ ] Address API auth issue — sick leave CRUD needs AUTHENTICATED_USER, not API_SECRET_TOKEN. All tests must use UI-based setup/cleanup.

### P1 — High Priority (sick-leave lifecycle + manager)
- [ ] Generate sick-leave lifecycle tests: TC-SL-009 (close without number — error), TC-SL-012 (reopen ended sick leave)
- [ ] Generate sick-leave manager tests: TC-SL-013+ (manager view, approval flows)
- [ ] Generate sick-leave accounting tests: TC-SL-020+ (accounting status transitions)
- [ ] Generate sick-leave permissions tests

### P2 — Lower Priority
- [ ] Review 18 blocked vacation/day-off tests — check if any can be unblocked
- [ ] Run full regression suite across all verified tests (vacation + day-off + sick-leave)
- [ ] Investigate JWT-based auth for sick leave API as alternative to UI-only approach

### Completed (Session 125)
- [x] TC-SL-001: Create sick leave — happy path (P0, UI) — verified
- [x] TC-SL-006: Edit sick leave dates (P0, UI) — verified
- [x] TC-SL-008: Close sick leave — happy path with number (P0, UI) — verified
- [x] TC-SL-010: Delete sick leave (P1, UI) — verified
- [x] TC-SL-011: View sick leave details (P1, UI) — verified
- [x] Built MySickLeavePage, SickLeaveCreateDialog page objects
- [x] Built SickLeaveSetupData, SickLeaveTc001Data data classes
- [x] Built sickLeaveQueries.ts DB queries
- [x] Discovered: details dialog uses rc-dialog (not role="dialog"), delete is inside details dialog

<details><summary>Completed (Sessions 85-124) — 85 vacation + 25 day-off tests</summary>
See autotest_tracking table for full history.
</details>
