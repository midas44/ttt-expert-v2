# Stage B: Static Testing — #3427

**Ticket:** [#3427](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3427)
**MRs:** [!5415](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5415) (Ilya, draft) and [!5424](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/merge_requests/5424) (Sergey) — identical content
**Commit under test:** `a68a067` on `hotfix/sprint-15`
**Scope:** Frontend-only · 1 file · +1 / −1 lines
**Date:** 2026-04-23

---

## B.1 Diff Review

### ST-1 — Semantic correctness (INFO, PASS)

**File:** `frontend/frontend-js/src/modules/vacation/components/userVacationEvents/VacationEventsModal/VacationEventsModal.js:120`

```diff
- <div>{userVacationDays.availablePaidDays}</div>
+ <div>{userVacationDays.currentYear}</div>
```

The label key `vacation.vacation_days_left` (RU "Остаток дней до конца года" — "Remaining days till year-end") describes the *projected year-end balance*, not the *currently usable* number.

- Frontend `currentYear` ← backend `availableDays` (reducer `myVacation/reducer.ts:172`) — the dynamic year-end projection.
- Frontend `availablePaidDays` ← backend `availablePaidDays` — the post-FIFO max-usable-now value (binary-search constrained).

The post-fix field is the semantically correct match for the label and aligns the modal with `UserVacationsPage.js:168` (`vacation.vacation_days_balance_to_end_of_year`) and the per-year tooltip sum.

**Verdict:** PASS. Verified by **TC-3427-01, TC-3427-02**.

---

### ST-2 — Null/undefined safety (LOW, PASS-with-note)

```js
<div>{userVacationDays.currentYear}</div>
```

No `?.` chaining and no `|| 0` fallback — but the parent `UserVacationsPage` does use `vacationDays.currentYear || 0`. Inconsistency with parent, but:

- The component is `memo`-wrapped and rendered only after the container fetches `userVacationDays` (`fetchVacationDaysForYears` + `fetchVacationDaysSummary` dispatched in `VacationEventsModalContainer.js:70-71`).
- PropTypes (lines 159–164) declare `currentYear: PropTypes.number.isRequired` — guarantees the field is a number when the component renders.
- `safeToFixed()` in the reducer normalises `undefined` to a numeric default before assignment, so even a null backend payload yields `0`.
- The pre-fix code had the same shape (`{userVacationDays.availablePaidDays}` with no fallback) — and `availablePaidDays` was *not even declared in PropTypes*. So the new code is strictly safer than what it replaces.

Risk of `Cannot read properties of undefined` is zero in normal flow. In a partial-load race condition the worst case is rendering empty string, identical to pre-fix.

**Verdict:** PASS. Verified by **TC-3427-13** (console clean check).

---

### ST-3 — PropTypes coverage (INFO, PASS)

```js
VacationEventsModal.propTypes = {
  userVacationDays: PropTypes.shape({
    currentYear: PropTypes.number.isRequired,
    nextYear:    PropTypes.number.isRequired,
    reserved:    PropTypes.number.isRequired,
  }).isRequired,
  // …
};
```

Pre-fix, the component accessed `userVacationDays.availablePaidDays` — a field **not declared** in PropTypes. The TypeScript shape in `src/types/vacation/myVacation.ts:87-99` does declare it on the Redux state, but the component's local PropTypes never did. The fix removes that latent inconsistency: `currentYear` is properly declared and used.

**Verdict:** PASS — the fix improves PropTypes hygiene as a side-effect.

---

### ST-4 — i18n / translation key (INFO, PASS)

The translation key `vacation.vacation_days_left` is unchanged. Confirmed in:

- `frontend/frontend-js/src/localisation/translations/vacation/translationsEN.json:22` — `"Annual vacation days left"`
- `frontend/frontend-js/src/localisation/translations/vacation/translationsRU.json:22` — `"Остаток дней до конца года"`

The Russian text literally says "Remainder of days until the end of the year" — i.e. the projection, matching `currentYear`/`availableDays`. The English text "Annual vacation days left" is more ambiguous but consistent. No new translations needed.

**Verdict:** PASS.

---

## B.2 Regression Surface

### ST-5 — Regression #3355 (HIGH, VERIFY)

**Original bug:** "[Bug][Vacation] System incorrectly adds vacation balance days to user on maternity leave" (fixed 2025-12-12 by switching modal to `availablePaidDays`).

**Risk:** If the original bug was a frontend display issue rooted in `currentYear` showing an incorrect value for maternity-leave users, switching back to `currentYear` resurrects it.

**Mitigating analysis:** Vault note `investigations/maternity-leave-lifecycle.md` and `patterns/vacation-day-calculation.md` indicate maternity-leave users follow a special case (`maternity=true` → available = sum of ALL year balances, no year restriction). The `availableDays` formula already handles this on the backend. So `currentYear` (= backend `availableDays`) should reflect the maternity-special-case correctly.

**Outstanding risk:** If `availablePaidDays` was masking a backend bug (e.g. `availableDays` not respecting the maternity flag), the fix may now expose it.

**Verdict:** VERIFY. Tested by **TC-3427-05** on a current maternity-leave user.

---

### ST-6 — Regression #3357 (LOW, PASS likely)

**Original bug:** "[Bug][Vacation] EV=False. Incorrect value of current balance days in case of next year vacation using days from current year" (fixed 2025-12-16 by switching modal to `currentYear`).

**Risk:** This fix re-applies #3357's direction. The bug it patched was that `availablePaidDays` showed the wrong number for AV=false users with a next-year vacation consuming current-year days. Reverting to `currentYear` is the same direction as #3357's original fix, so it should resolve the same scenario.

**Verdict:** Expected PASS — the fix re-aligns with #3357. Tested by **TC-3427-04**.

---

### ST-7 — Regression #3361 (HIGH, VERIFY)

**Original bug:** "[Bug][Vacations] AV=True. Incorrect multi-year balance days distribution in cases of transition from the current year to the next" (fixed 2026-01-28 by switching modal **and** UserVacationsPage:102 to `availablePaidDays`).

**Risk:** This fix reverts only the modal. UserVacationsPage:102 still uses `availablePaidDays` (the #3361 fix is still in effect there). So:
- AV=true page header: `availablePaidDays` (correct per #3361)
- AV=true modal: `currentYear` (= backend `availableDays`) — **changed**

By formula, `availableDays = currentYearDays + pastYearDays + futureDays + editedVacationDays` for AV=true. `availablePaidDays` is computed via binary-search FIFO over the same inputs. They should converge for stable states but **may diverge during edits/redistribution** of multi-year vacations spanning Dec→Jan.

**Outstanding risk:** Transient divergence during the `tdemetriou` scenario (creating a vacation 2026-01-25 → 2026-02-21 from a Dec 2025 starting balance) could re-display 0 in the modal while the page shows the correct redistributed value.

**Verdict:** VERIFY — this is the highest-risk regression. Tested by **TC-3427-03** on an AV=true user reproducing the multi-year edit scenario.

---

### ST-8 — Side-effect / collateral scan (INFO, PASS)

Grep results across `frontend/frontend-js/src` for `vacationDays.currentYear` and `vacationDays.availablePaidDays`:

```
UserVacationsPage.js:102   {vacationDays.availablePaidDays || 0}    (AV=true header / AV=false top)
UserVacationsPage.js:135   <span>{vacationDays.availablePaidDays || 0}</span>   (AV=false top duplicate)
UserVacationsPage.js:168   <span>{vacationDays.currentYear || 0}</span>   (AV=false bottom — "Expected remaining")
VacationEventsModal.js:120 <div>{userVacationDays.currentYear}</div>          (post-fix; this MR)
```

Plus reducer + sagas references (state plumbing only). **No other display callers.** The fix is fully contained; nothing else needs to change to stay consistent.

`CreateFormContainer.js:97,102` consume `availablePaidDays` for *form validation* (max-usable-now check) — that's the correct field for that purpose (binary-search max), unaffected by the display fix.

**Verdict:** PASS. Tested by **TC-3427-12** (footer table totals unchanged) and **TC-3427-11** (tooltip sum still correct).

---

## B.3 Component-Stack Impact Assessment

| Component | File | Change in #3427? | Verifying TC |
|---|---|---|---|
| `VacationEventsModal` | `…/VacationEventsModal/VacationEventsModal.js` | **Yes** — line 120 field swap | TC-01..05, 07..10 |
| `VacationEventsModalContainer` | `…/containers/userVacationEvents/VacationEventsModalContainer.js` | No | — |
| `VacationDaysTooltip` | `…/components/VacationDaysTooltip/index.tsx` | No (independent endpoint `/v1/vacationdays/{login}/years`) | TC-11 |
| Footer (in modal) | inline in `VacationEventsModal.js` | No (independent endpoint `/v1/timelines/days-summary/{login}`) | TC-12 |
| `UserVacationsPage` (parent) | `…/components/userVacations/UserVacationsPage.js` | No (lines 102/135 = `availablePaidDays` per #3361, line 168 = `currentYear` always) | TC-01, 02, 04 |
| `myVacation/reducer.ts` | `…/ducks/myVacation/reducer.ts` | No (mapping unchanged: `currentYear ← availableDays`, `availablePaidDays ← availablePaidDays`) | — |
| `CreateFormContainer` | `…/containers/myVacation/modal/CreateFormContainer.js` | No (uses `availablePaidDays` for max-usable validation) | TC-09 (smoke that form still validates correctly) |

---

## B.4 Static Testing Verdict

| Severity | Findings | Status |
|---|---|---|
| BLOCKER | 0 | — |
| HIGH | 2 (ST-5, ST-7 — regression checks; both require dynamic verification but no static red flag) | **VERIFY** |
| MEDIUM | 0 | — |
| LOW | 1 (ST-2 — minor null-safety inconsistency vs parent, no functional impact) | PASS-with-note |
| INFO | 4 (ST-1, ST-3, ST-4, ST-8) | PASS |

**Static verdict:** ✅ **PASS — proceed to dynamic testing.** The fix is surgically scoped, semantically correct, improves PropTypes hygiene, and has zero collateral impact on adjacent components. Two ping-pong regressions (#3355 maternity, #3361 AV=true multi-year) require explicit dynamic verification before sign-off.
