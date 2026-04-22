# Autotest Progress

## Overall Coverage (Session 143)

| Module | Manifest Total | Verified | Generated | Blocked | Failed | Pending | Coverage |
|--------|---------------|----------|-----------|---------|--------|---------|----------|
| vacation | 100 | 85 | 0 | 15 | 0 | 0 | 85% (100% addressed) |
| day-off | 28+4 | 30 | 0 | 4 | 0 | ~6 | 75% |
| sick-leave | 71 | 5 | 0 | 0 | 0 | 66 | 7% |
| t2724 | 38 | 38 | 0 | 0 | 0 | 0 | 100% |
| t3404 | 24 | 21 | 0 | 3 | 0 | 0 | 88% (100% addressed) |
| planner | 82 | 24 | 0 | 0 | 1 | 57 | 29% |
| reports | 60 | 17 | 0 | 0 | 2 | 41 | 28% |
| **digest** (collection) | **14** | **4** | **5** | **0** | **5** | **0** | **29% verified / 100% addressed** |

### Digest Collection (session 143 close — scope complete, most TCs failing)

Scope: `collection:digest` (14 TCs in `test-docs/collections/digest/digest.xlsx` → `TS-Digest-Vacation`).

**Verified (4):** TC-DIGEST-003, 004, 007, 008 — passed pre-session-143. Sessions 143 analysis flags 007/008 as **suspect**: the fixture bug (`parsed.messages ?? []` against a CLI that returns `items`) would have made every `waitForEmail` call time out with zero matches, so their subject-regex assertion could not have run. Re-verification after session 143's fixture fix is required before trusting the "verified" label on 007/008.

**Generated, awaiting re-verification (5):** TC-DIGEST-002, 005, 006, 009, 010 — per-recipient Graylog marker assertions removed in s141. The fixture fixes from s143 should unblock the email-matching path; body assertions still need the receiver-model and greeting-template fixes described below.

**Failed (5):** 
- TC-DIGEST-001 — hit AIOOBE production bug at `MailDataFormerService:172` ([[exploration/tickets/digest-bug-array-index-out-of-bounds]]) AND (after s143 fixture fix) now fails on subject regex `QA-1` vs actual `QA1`.
- TC-DIGEST-011 / 012 — **XLSX premise invalid**: digest template has no Russian plural-form code path, every row uses fixed `дней: {{daysCount}}`. Spec must be rewritten or deleted — human review required.
- TC-DIGEST-013 / 014 — **Spec fail-shape invalid**: digest recipient is `employee.manager`, never the employee themselves. `waitForEmail({to: pvaynmaster.email})` cannot match the seeded-vacation digest. Cross-year assertion premise valid; spec needs recipient-model fix before it can pass.

**Pending:** 0 — scope fully addressed.

### Structural findings from session 143 (see `exploration/tickets/digest-template-reality-session-142.md`)

Four compounding defects were exposed while trying to run TC-011 for the first time:

1. **Fixture bug (FIXED)**: `RoundcubeVerificationFixture.search()` read non-existent JSON key. Fix: read `parsed.items`.
2. **Fixture bug (FIXED)**: `read()` returned `{text, html}`; specs read `text_body` / `html_body`. Fix: normalize keys, always include HTML, strip tags to text when plain-text part is empty (digest template is HTML-only).
3. **Config bug (FIXED)**: Subject env-tag `[QA1]` ≠ `tttConfig.env.toUpperCase()` `[QA-1]`. Fix: added `TttConfig.envTag` getter stripping dashes.
4. **XLSX premise errors (NOT fixed — human review needed)**:
   - Plural forms (`1 день` etc.) don't exist in the digest template.
   - Greeting `Здравствуйте, X Y` isn't in the digest template (it opens with `"Добрый день!"`).
   - Digest recipient model: manager, not employee — affects every content-complete digest TC (001 / 002 / 005 / 006 / 011 / 012 / 013 / 014).

### Critical production invariant violated (from s141, still unresolved)

TC-001 run in session 141 revealed that `DigestScheduler`'s wrapper does NOT always emit `"Digests sending job failed"` when the job throws — AIOOBE propagates past the try/catch without reaching the failure log. This is itself a regression-worthy finding: the wrapper should mark `failed` on any exception, not only declared ones.
