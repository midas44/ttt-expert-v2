# Autotest Progress

## Overall Coverage (Session 141)

| Module | Manifest Total | Verified | Generated | Blocked | Failed | Pending | Coverage |
|--------|---------------|----------|-----------|---------|--------|---------|----------|
| vacation | 100 | 85 | 0 | 15 | 0 | 0 | 85% (100% addressed) |
| day-off | 28+4 | 30 | 0 | 4 | 0 | ~6 | 75% |
| sick-leave | 71 | 5 | 0 | 0 | 0 | 66 | 7% |
| t2724 | 38 | 38 | 0 | 0 | 0 | 0 | 100% |
| t3404 | 24 | 21 | 0 | 3 | 0 | 0 | 88% (100% addressed) |
| planner | 82 | 24 | 0 | 0 | 1 | 57 | 29% |
| reports | 60 | 17 | 0 | 0 | 2 | 41 | 28% |
| **digest** (collection) | **14** | **4** | **5** | **0** | **1** | **4** | **29% verified / 71% addressed** |

### Digest Collection (current focus — session 141)

Scope: `collection:digest` (14 TCs in `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation`).

**Verified (4):** TC-DIGEST-003, 004, 007, 008 — passed before structural fix landed (structure untouched or minimally edited).

**Generated, awaiting re-verification (5):** TC-DIGEST-002, 005, 006, 009, 010 — had per-recipient Graylog marker assertions that targeted a non-existent log marker. Blocks removed in s141; TypeScript compiles cleanly; re-run pending.

**Failed (1):** TC-DIGEST-001 — hit the intermittent AIOOBE production bug at `MailDataFormerService:172`. Variant A (scheduler) runs are inherently flaky until the upstream bug is fixed. Documented at [[exploration/tickets/digest-bug-array-index-out-of-bounds]].

**Pending (4):** TC-DIGEST-011 through 014 — plural-form edge cases (011/012) and cross-year boundary (013/014). Templates proven by the A/B pairs already landed.

**Key pattern discovered in s141:** `DigestServiceImpl` and its formatters emit **zero** log statements. Only `DigestScheduler` writes digest-related markers (`started`/`finished`/`failed`). Any per-recipient assertion on a pattern like `"Mail has been sent to … NOTIFY_VACATION_UPCOMING"` is wrong — that marker text belongs to four unrelated notification helpers (`EmployeeDayOffNotificationHelper`, `AvailabilityScheduleNotificationHelper`, `AbstractVacationNotificationHelper`, `SickLeaveNotificationHelper`), never the digest pipeline. Roundcube `assertBodyContains` is the correct per-recipient evidence.

**Critical production invariant violated:** TC-001 run revealed that the scheduler wrapper does NOT always emit `"Digests sending job failed"` when the job throws — the AIOOBE is propagating past the try/catch but not reaching the failure log. This is itself a regression-worthy finding (the wrapper should always mark `failed` on any exception, not just declared ones).

### Absences Collection (session 128)
- **Day-off verified in S128:** TC-DO-035 (fixed: JWT auth + field name), TC-DO-037 (new), TC-DO-038 (new)
- **Day-off blocked:** TC-DO-036 (no API for office change, HR sync only, date-conditional cascade)
- **Remaining:** ~15 cross-service tests (TC-CS-013..027+054)
- **Target:** Complete absences collection

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

## Notable patterns (new in s141)

- **Clock-aware seed dates**: `nextMondayDateIso(serverTime) + 1 day` lands inside `DigestServiceImpl.addSoonVacationEvents`' `[today+1, today+21]` Monday-gated window after the spec patches server clock to `fireSoonIso(serverTime)`. See `DigestTc001Data.seed`.
- **Variant B sync POST**: `TestDigestController.sendDigests()` is synchronous — the HTTP response returns after the job runs. Variant B specs use POST + ~10s Graylog settle rather than `waitForMarker`. No per-recipient marker exists to wait for anyway.
- **Crossing-predicate rule**: `VacationRepositoryCustomImpl.buildCrossVacationPredicate` blocks only `STATUS IN (NEW, APPROVED, PAID) AND date-overlap AND employee`. CANCELED / REJECTED do not block — confirmed by code reading + DB check on pvaynmaster.
