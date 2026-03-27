---
type: exploration
tags:
  - vacation
  - accrued-days
  - conversion
  - ticket-mining
  - bugs
created: '2026-03-26'
updated: '2026-03-26'
status: active
related:
  - '[[analysis/vacation-business-rules-reference]]'
  - '[[exploration/tickets/vacation-ticket-findings]]'
---
# Ticket #3015 — Validate Accrued Days for Future Payment Months

Deep analysis: 59 comments, 31 sub-bugs. Core feature for AV=false vacation logic.

## Feature Summary
When creating/editing a regular vacation, verify that future requests (later payment month) still have enough accrued paid days. If not, auto-convert the future request from Regular to Administrative. User sees orange warning on popup + red notification banner after save.

**Key formula:** `X = monthsWorked * md/12 + remainderDays - md` where md = annual vacation norm (typically 24).

## Sub-Bugs Summary (31 reported)

### Critical Bugs (conversion logic)
- **Bug 1:** Inter-year conversion fails — creating 2024 request triggers 2025 conversion incorrectly
- **Bug 3:** Error 400 on save when future request in 2025 uses 2024 days
- **Bug 4:** Error 400 when both requests in 2024 — freed-up days from conversion not added back to balance
- **Bug 7:** Wrong order — checks latest-first instead of earliest-first. After fix, skips some requests
- **Bug 10:** Multiple future requests — only some converted, not all
- **Bug 14:** Complex cascading bug — popup warns about wrong request
- **Bug 16.1:** Wrong request selected for conversion — should pick minimum X value
- **Bug 17:** Current request auto-converts to Admin instead of converting future request
- **Bug 19:** Past-period request incorrectly selected for conversion; no warning shown

### UI/Notification Bugs
- **Bug 2:** Missing red conversion banner after save (only green "Changes saved" appears)
- **Bug 5:** On creation: only red banner, missing green "New request created"
- **Bug 6:** On edit: only green banner, missing red conversion banner
- **Bug 9:** Red banner has different dismiss behavior than green banner
- **Bug 11:** Separate banner per converted request — spacing issues
- **Bug 21:** Frontend warns about past-year request when all current-year days used
- **Bug 22:** Same-month requests: warning appears but no conversion needed
- **Bug 23:** Administrative request creation still triggers conversion warning
- **Bug 29:** UI message identifies WRONG request as converted
- **Bug 30:** No UI messages, but conversion happens silently on backend
- **Bug 31:** UI messages shown, but NO actual conversion on backend

### Validation/Calculation Bugs
- **Bug 3.1:** `/v1/vacationdays/available` doesn't detect eligible conversion target
- **Bug 12:** Changing payment type Admin→Regular doesn't trigger conversion check
- **Bug 13:** Editing payment type doesn't update available days count
- **Bug 24:** Can't change converted Admin request back to Regular even when days now available

## Design Decisions
1. **Conversion order:** Chronological by payment month, earliest first. Select request with minimum X value
2. **Cross-month vacations:** Payment month auto-shifts to end month if start month lacks days
3. **Separate banner per conversion:** Each converted request gets its own red notification
4. **No production calendar support:** Holiday transfers don't affect accrued check (intentional limitation)
5. **Month disabling rolled back:** Too complex; only auto-shift kept

## Key Edge Cases for Testing
1. Inter-year conversion (2024 request → converts 2025 request using 2024 days)
2. Employee with requests consuming days from 3 different years
3. Multiple future requests eligible — all must be converted
4. Same-month requests — no conversion should trigger
5. Administrative requests — no conversion check
6. Cross-month vacation (last day in new month) — auto-shift behavior
7. Silent conversion vs. UI-only warning (mismatch between backend and frontend)
8. Conversion rollback: after deleting the triggering request, can converted request revert?

## Related
- [[analysis/vacation-business-rules-reference]]
- [[exploration/tickets/vacation-ticket-findings]]
- [[exploration/tickets/vacation-ticket-3014-form-changes]]
- [[modules/vacation-service-deep-dive]]
