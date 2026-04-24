# Stage C: Test Plan & Test Cases — #3427

**Ticket:** [#3427](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3427)
**Environment under test:** **qa-1** (`hotfix/sprint-15`, post-fix)
**Reference environment:** **stage** (`release/2.1`, pre-fix — for anchor screenshots)
**Date:** 2026-04-23

---

## C.1 Test Strategy

### Scope
- All 5 requirements (R.1 — R.5)
- 3 prior-ticket regression cohorts (#3355 maternity, #3357 EV=False next-year vacation, #3361 AV=true multi-year)
- 4 edge cases (zero-balance new hire, only-past-period, approved current-year vacation, manual admin correction)
- 3 UX checks (tooltip sum, footer totals, console cleanliness)

### Approach
1. **Anchor** — reproduce the bug on stage to prove the discrepancy existed (TC-01/02 dual-env)
2. **Smoke** — primary positive paths on qa-1 for both AV branches
3. **Regression** — explicit cohort tests for each prior ping-pong fix
4. **Edge** — value-boundary scenarios (zero, only past, with active vacation, with manual correction)
5. **UX** — adjacent components untouched (tooltip / footer) + clean DevTools console

### Test Data Requirements

For each cohort below I need at least one user reachable on qa-1 (and for TC-01/02, also reachable on stage). DB discovery query example:

```sql
-- AV=false candidates with non-trivial balance
SELECT e.login, e.name, o.name AS office, o.advance_vacation,
       vd.available_days, vd.available_paid_days, vd.past_periods_available_days
FROM ttt_vacation.employee e
JOIN ttt_vacation.office o ON o.id = e.office_id
JOIN ttt_vacation.vacation_days vd ON vd.employee_id = e.id
WHERE o.advance_vacation = false
  AND vd.available_days <> vd.available_paid_days
  AND vd.available_paid_days > 0
ORDER BY vd.available_days - vd.available_paid_days DESC
LIMIT 20;
```

(Schema names may differ — discovery happens at the start of Stage D; the Stage D doc records actual user logins selected.)

| Cohort | Profile | Discovery query target | TCs |
|---|---|---|---|
| AV=false primary | `office.advance_vacation = false`, `available_days ≠ available_paid_days`, balance > 0 | qa-1 + stage | TC-01 |
| AV=true primary | `office.advance_vacation = true`, balance > 0 | qa-1 + stage (Pavel `pvaynmaster` if reachable) | TC-02 |
| AV=true multi-year | AV=true with vacation spanning Dec→Jan, NEW or APPROVED | qa-1 (`tdemetriou` if reachable) | TC-03 |
| AV=false next-year vac | AV=false with APPROVED vacation in 2027 consuming 2026 days | qa-1 | TC-04 |
| Maternity | `maternity = true` flag, active maternity leave | qa-1 | TC-05 |
| New hire | tenure < 3 months, daysLimitation set, balance = 0 | qa-1 | TC-06 |
| Only past period | January/February of year, `past_periods_available_days > 0`, `accrued_days = 0` (early-year) | qa-1 (or simulate via DB read) | TC-07 |
| With APPROVED vacation | AV=false with APPROVED current-year vacation reducing balance | qa-1 | TC-08 |
| With NEW/PENDING reservation | `reserved_days > 0` | qa-1 | TC-09 |
| With manual correction | Has `VACATION_DAYS_UPDATE` event in vacation_event_entity | qa-1 | TC-10 |

---

## C.2 Test Cases

Format conventions:
- **Steps** are UI-first; API/DB checks are sub-steps marked `(API)` / `(DB)`.
- **Modal value** = the number rendered in `<dd>` next to label "Annual vacation days left" (EN) / "Остаток дней до конца года" (RU).
- **Page "Expected remaining"** = the AV=false-only block on UserVacationsPage labelled "Expected balance of days by year-end including future accumulations and write-offs".
- **Tooltip sum** = sum of all per-year `days` values returned by `GET /v1/vacationdays/{login}/years`.

---

### Group 1: Primary Positive (anchor on stage, verify on qa-1)

#### TC-3427-01 — AV=false: Modal == Page "Expected remaining" == Tooltip sum
| Field | Value |
|-------|-------|
| **Precondition** | AV=false user with non-zero balance and `available_days ≠ available_paid_days`. Same user reachable on stage and qa-1 (or two functionally-equivalent users). |
| **Steps (stage, anchor)** | 1. Login to stage as the user. 2. Open `/vacation/my`. 3. Note "Available" and "Expected remaining by year-end" page values. 4. Click the events feed icon to open the modal. 5. Capture screenshot of modal + tooltip + page values. |
| **Expected (stage)** | Modal value **==** page "Available" (=`availablePaidDays`); modal value **≠** page "Expected remaining" — **bug visible**. |
| **Steps (qa-1, fix verification)** | 6. Repeat steps 1–5 on qa-1. |
| **Expected (qa-1)** | Modal value **==** page "Expected remaining by year-end" (=`currentYear` = backend `availableDays`); modal value **==** sum of tooltip per-year entries. |
| **API check (both env)** | `GET /v1/vacationdays/{login}` — log full JSON; verify `availableDays`, `availablePaidDays`, `pastPeriodsAvailableDays` shape. `GET /v1/vacationdays/{login}/years` — sum of `days` field. |
| **Traces** | R.1, R.2, R.3 |

---

#### TC-3427-02 — AV=true: No regression, modal still equals page balance
| Field | Value |
|-------|-------|
| **Precondition** | AV=true user with non-zero balance (default candidate `pvaynmaster`). |
| **Steps (stage)** | 1. Login as the user. 2. Open `/vacation/my`. 3. Note "Vacation days balance" page value. 4. Open events feed modal. 5. Capture. |
| **Expected (stage)** | Modal value **==** page balance (no discrepancy — original screenshot 2 reference). |
| **Steps (qa-1)** | 6. Repeat on qa-1. |
| **Expected (qa-1)** | Same — modal value **==** page balance. No change vs stage (because for AV=true, `availableDays ≈ availablePaidDays` by formula). |
| **API check** | Confirm `availableDays == availablePaidDays` in `/v1/vacationdays/{login}` JSON. |
| **Traces** | R.4 |

---

### Group 2: Regression cohorts (qa-1 only)

#### TC-3427-03 — Regression #3361: AV=true multi-year Dec→Jan vacation
| Field | Value |
|-------|-------|
| **Precondition** | AV=true user (Cyprus / Germany office), with an APPROVED or NEW vacation spanning year-boundary (e.g. 2026-12-22 → 2027-01-11). Or: create a fresh one via UI as the test step. |
| **Steps** | 1. Login as the user (or proxy via admin "Other employees" view). 2. Open `/vacation/my`, locate the multi-year vacation in the table. 3. Open the events feed modal. 4. Compare modal value to page "Vacation days balance". 5. (API) `GET /v1/vacationdays/{login}` — record both `availableDays` and `availablePaidDays`. 6. Repeat after creating/editing a second multi-year vacation that triggers FIFO redistribution. |
| **Expected** | Modal value **==** page balance. No 0-display, no negative, no transient divergence. The #3361 scenario is preserved. |
| **Failure indicator** | Modal shows 0 or a value different from page balance after redistribution — file regression bug. |
| **Traces** | R.4, ST-7 |

---

#### TC-3427-04 — Regression #3357: AV=false next-year vacation using current-year days
| Field | Value |
|-------|-------|
| **Precondition** | AV=false user with at least one APPROVED vacation scheduled for 2027 that consumes 2026 days. |
| **Steps** | 1. Login as the user. 2. Open `/vacation/my`. 3. Open events feed modal. 4. Compare modal vs page "Expected remaining" vs tooltip sum. 5. (API) record `/v1/vacationdays/{login}` and `/years` JSON. |
| **Expected** | Modal value **==** page "Expected remaining" **==** tooltip sum. The number reflects current-year days minus the next-year-vacation consumption. (This is the scenario the original #3357 fixed by switching to `currentYear` — re-applied here.) |
| **Traces** | R.2, R.3, ST-6 |

---

#### TC-3427-05 — Regression #3355: Maternity-leave user
| Field | Value |
|-------|-------|
| **Precondition** | User with active maternity-leave status (`maternity = true` per `maternity-leave-lifecycle.md`). |
| **Steps** | 1. Login as the user (or admin proxy). 2. Open `/vacation/my`. 3. Open events feed modal. 4. Compare modal vs page values vs tooltip sum. 5. (DB) verify `vacation_days` row reflects sum-of-all-years rule for maternity. |
| **Expected** | Modal value matches page "Expected remaining" (or, for AV=true maternity, matches single-block page balance). No spurious "added balance days" — the original #3355 phenomenon must NOT reappear on screen. |
| **Failure indicator** | Modal shows a balance higher than DB-derived ground truth → file regression bug citing #3355. |
| **Traces** | R.1, ST-5 |

---

### Group 3: Edge cases (qa-1 only)

#### TC-3427-06 — Zero balance: new hire inside 3-month waiting period
| Field | Value |
|-------|-------|
| **Precondition** | Employee with tenure < 3 months, `daysLimitation` set, all balance fields = 0. |
| **Steps** | 1. Login as the user. 2. Open events feed modal. 3. Inspect modal value and tooltip. |
| **Expected** | Modal value = `0` (rendered as "0", not blank). Tooltip shows current year with 0 days. No JS error. The waiting-period tooltip (sub-bug #4 of #3361) may or may not be visible — record observation. |
| **Traces** | R.1, ST-2 |

---

#### TC-3427-07 — Only past-period balance, no current-year accrual
| Field | Value |
|-------|-------|
| **Precondition** | AV=false user where `pastPeriodsAvailableDays > 0` but the year is so early that current-year accrual hasn't begun (or balance was depleted). Test ideally Jan or via a user matching the profile via DB query. |
| **Steps** | 1. Login. 2. Open modal. 3. Check tooltip ordering (tooltip pads "current year with 0 days" when missing). 4. Compare modal value to tooltip sum. |
| **Expected** | Modal value reflects only past-period days. Tooltip sum equals modal value. |
| **Traces** | R.2 |

---

#### TC-3427-08 — APPROVED current-year vacation reducing balance
| Field | Value |
|-------|-------|
| **Precondition** | AV=false user with at least one APPROVED current-year vacation that consumes balance. |
| **Steps** | 1. Login. 2. Open `/vacation/my`. 3. Open events modal. 4. Verify the vacation is listed in the events table. 5. Compare modal value to page "Expected remaining" and tooltip sum. |
| **Expected** | Modal value **==** page "Expected remaining" (both reflect the post-consumption balance via `availableDays` formula). |
| **Traces** | R.2, R.3 |

---

#### TC-3427-09 — NEW/PENDING vacation with reservation (`reservedDays > 0`)
| Field | Value |
|-------|-------|
| **Precondition** | User with `reservedDays > 0` (NEW vacation awaiting approval). |
| **Steps** | 1. Login. 2. Open modal. 3. Note modal value, tooltip sum. 4. (API) `GET /v1/vacationdays/{login}` — verify `availableDays` does NOT subtract `reservedDays`, while `availablePaidDays` does. 5. Verify Create-Vacation form max-usable still validates against `availablePaidDays` (form unchanged). |
| **Expected** | Modal shows `availableDays`-style number (does not subtract reservation). Form behaviour unchanged: validation still uses `availablePaidDays`. |
| **Traces** | R.1, R.5, ST-8 |

---

#### TC-3427-10 — Manual admin correction (`VACATION_DAYS_UPDATE` event)
| Field | Value |
|-------|-------|
| **Precondition** | User with at least one manual admin correction visible in events feed (`VACATION_DAYS_UPDATE` event type). |
| **Steps** | 1. Login. 2. Open events modal. 3. Verify the correction row is present. 4. Compare modal value to tooltip sum and page "Expected remaining". |
| **Expected** | Modal value reflects the corrected balance. Tooltip sum = modal value. (This is the cohort #3373 was investigating — verify no discrepancy.) |
| **Traces** | R.2, parent #3373 |

---

### Group 4: UX & console (qa-1 only)

#### TC-3427-11 — Tooltip per-year breakdown sums to modal value
| Field | Value |
|-------|-------|
| **Precondition** | Reuse user from TC-01 (AV=false) and TC-02 (AV=true). |
| **Steps** | 1. Open modal. 2. Hover the (i) info icon to expand the per-year tooltip. 3. Sum the per-year `days` values. 4. Compare to modal value. |
| **Expected** | Sum **==** modal value for both AV branches. |
| **Traces** | R.2, R.5 |

---

#### TC-3427-12 — Footer table totals unchanged
| Field | Value |
|-------|-------|
| **Precondition** | Reuse user with several events in the feed. |
| **Steps** | 1. Open modal. 2. Note "Total" row at bottom of events table: `totalAccruedDays`, `totalUsedDays`, `totalAdministrativeDays`. 3. (API) `GET /v1/timelines/days-summary/{login}` — verify the three numbers match the footer. |
| **Expected** | All three numbers match the API response. Footer is unaffected by the modal label fix. |
| **Traces** | R.5, ST-8 |

---

#### TC-3427-13 — DevTools console clean on modal open
| Field | Value |
|-------|-------|
| **Precondition** | Browser DevTools open with Console tab. Any test user. |
| **Steps** | 1. Clear console. 2. Open events modal. 3. Inspect console for warnings/errors. 4. Especially look for PropTypes warnings about `userVacationDays.currentYear` (none expected — declared in PropTypes) and `userVacationDays.availablePaidDays` (none — no longer accessed). |
| **Expected** | No new errors or warnings on modal open. |
| **Traces** | R.5, ST-3 |

---

## C.3 Stage / qa-1 Matrix

| TC | qa-1 | stage (anchor) |
|---|---|---|
| TC-3427-01 | ✅ verify fix | ✅ reproduce bug |
| TC-3427-02 | ✅ regression smoke | ✅ confirm baseline |
| TC-3427-03 .. TC-3427-13 | ✅ | — |

Stage runs are evidence anchors only — pass/fail on stage means "the bug exists" / "AV=true unaffected", which is documented in Stage A from the ticket screenshots already. We re-shoot for our own evidence.

## C.4 Tooling Recipe

| Action | MCP / skill |
|---|---|
| UI navigation, login, screenshots | `mcp__playwright-vpn__browser_*` (TTT requires VPN) |
| Vacation API on qa-1 | `mcp__swagger-qa1-vacation-default__get-vacation-days-usr-using-get`, `mcp__swagger-qa1-vacation-default__get-vacation-days-grouped-by-years-using-get` |
| Vacation API on stage | `mcp__swagger-stage-vacation-default__get-vacation-days-usr-using-get`, `…-grouped-by-years-using-get` |
| Days-summary footer | `mcp__swagger-qa1-vacation-default__get-days-summ-by-employee-using-get` (or via `/v1/timelines/days-summary/{login}` direct) |
| DB discovery for cohorts | `mcp__postgres-qa1__execute_sql` against `ttt_vacation` schema |
| Build banner / pipeline confirmation | `gitlab-access` skill — pipelines on `hotfix/sprint-15` |
| Backend log forensics if errors appear | `graylog-access` skill, stream `TTT-QA-1` |
| Filing regression bugs | `gitlab-task-creator` skill (only with explicit user confirmation) |

## C.5 Pass/Fail Criteria for Sign-Off

- **Hard pass:** TC-01 + TC-02 + TC-03 + TC-04 + TC-05 all PASS on qa-1; TC-01 reproduces the bug on stage.
- **Soft pass:** TC-06 .. TC-13 all PASS or any FAIL is logged with severity LOW.
- **Block ship:** any FAIL on TC-01 .. TC-05.
- **Conditional ship:** FAIL on TC-09 / TC-10 with confirmed pre-existing nature (already broken on stage too) — flag separately, don't block #3427.
