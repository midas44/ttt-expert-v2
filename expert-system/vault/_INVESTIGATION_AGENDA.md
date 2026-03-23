---
type: agenda
updated: '2026-03-22'
---
# Phase C — Autotest Generation Agenda

## P0 — Next Session (S46)
- [ ] Generate next 5 vacation tests from pending list (37 remaining)
  - TC-VAC-036: Manager approves vacation request
  - TC-VAC-037: Manager rejects vacation request
  - TC-VAC-038: Manager approves multiple vacations
  - TC-VAC-039: Auto-approval for CPO self-vacation
  - TC-VAC-040: Approver change by admin
- [ ] Verify all against qa-1 with `--workers=1`
- [ ] Update tracking tables and manifest

## P1 — Sessions 47-49
- [ ] Complete remaining approval flow tests (TC-VAC-041–044)
- [ ] Payment-related tests (TC-VAC-053–055)
- [ ] Remaining correction tests (TC-VAC-067–068)
- [ ] Remaining CRUD tests (TC-VAC-047, TC-VAC-062)

## P2 — Sessions 50+
- [ ] Admin/role-based tests (TC-VAC-088–109, 22 tests)
- [ ] Revisit blocked tests (TC-VAC-023, TC-VAC-027) if accounting period API discovered
- [ ] Revisit failed TC-VAC-011 (available days display)

## Constraints
- **Workers**: Must use `--workers=1` — backend can't handle concurrent vacation operations
- **Proxy**: Fixed in playwright.config.ts — env vars cleared in launchOptions
- **Vacation days**: DB `available_vacation_days` ≠ UI remaining balance. Use threshold ≥15 for 5-day vacations
- **Chart CSS**: Table elements CSS-hidden due to overflow — use `evaluate()` and `state: "attached"`
- **Chart search**: Multi-field matching (name, project, manager, office) — don't assert exact filtering
- **Pagination**: Standard MUI pagination with aria roles — `navigation "Pagination"`, `button "Previous page"` etc.
- **Events feed**: `button "Vacation events feed"` — shows lifecycle events with dates

<details>
<summary>Completed (S31-S45)</summary>

- [x] Phase B → C transition
- [x] Re-parse XLSX into manifest (109 test cases)
- [x] S31-32: TC-VAC-001/002/003/005/006/007/010/013/021/022 (10 verified)
- [x] S33: TC-VAC-004/008/009/015 (4 verified), TC-VAC-011 failed
- [x] S34: TC-VAC-012/014/016/017/018 (5 verified)
- [x] S35: TC-VAC-024/025/026/028/029 (5 verified)
- [x] S36: TC-VAC-030/031/032/033/034 (5 verified)
- [x] S37: TC-VAC-056/057/083/084/085 (5 verified)
- [x] S38: TC-VAC-086/087/045/046 (4 verified), TC-VAC-023 blocked
- [x] S39: TC-VAC-079/088/089/090/091 (3 verified, 2 from S38 fix)
- [x] S40: Fix getAvailableDays(), TC-VAC-046/060/061/074/077 (5 verified)
- [x] S41: Fix TC-VAC-035/048, TC-VAC-075/076/078 (5 verified)
- [x] S42: TC-VAC-080/081/082/049/050 (5 verified)
- [x] S43: TC-VAC-051/052/058/059/064 (5 verified)
- [x] S44: TC-VAC-065/066/069/073 (4 verified), TC-VAC-027 blocked
- [x] S45: TC-VAC-070/071/072/019/020 (5 verified)
</details>