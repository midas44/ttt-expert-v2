---
type: coverage
updated: '2026-04-16'
---
# Knowledge Coverage — Phase C (Autotest Generation)

## Project Coverage

| Project | Role | Vault notes | Test specs |
|---------|------|-------------|------------|
| TTT | Primary SUT | All modules below | All `tests/<module>/` specs |
| CS  | Secondary, integrated (UI-only) | `vault/cs/` — 6 notes from live UI exploration 2026-04-15 (overview, employee profile, salary offices, transfer workflow, hiring workflow, automation notes) + `vault/integrations/ttt-cs-sync.md` | None yet — appears as episodic UI steps in `tests/integration/` cross-project specs |
| PMT | Secondary, integrated (UI-only) | `vault/pmt/_overview.md` (stub, 2026-04-16) + `vault/integrations/ttt-pmt-sync.md` (stub); TTT-side deep dives already exist: `modules/pm-tool-integration-deep-dive.md`, `modules/pm-tool-sync-implementation.md`, `branches/pm-tool-stage-comparison.md`, plus `modules/admin-panel-deep-dive.md` ("PM Tool sync" section) and `modules/cross-service-integration.md` | None yet — appears as episodic UI steps in `tests/integration/` cross-project specs |

### CS investigation status (2026-04-15)

First hands-on CS session delivered end-to-end coverage of the employee-lifecycle surfaces:
- ✅ Auth (CAS SSO, slebedev + pvaynmaster accounts, cookie-level role switch)
- ✅ Employee directory + profile edit page (5 cards)
- ✅ Accountant-card timeline + event-add wizard (maternity-leave verified)
- ✅ Salary Offices settings (Current/Archive, 3 sub-tabs, year-scoped vacation policy, inline edit, unarchive)
- ✅ Employee transfer workflow (11-item checklist across 3 tabs, Change/Retrieve, Complete)
- ✅ New-employee hiring (multi-role card approvals, status progression New → Registration in progress → Ready to publish → Published)
- ✅ Language switcher on `/preferences`
- ⬜ Contractors page, News, Mailing groups, Review, Employment termination — not explored
- ⬜ Permissions matrix across the 5 card-owner roles — partially inferred, not fully mapped

## Phase C: Autotest Generation Progress

### Completed Scopes

| Module | XLSX Cases | Specs | Verified | Blocked | Coverage | Status |
|--------|-----------|-------|----------|---------|----------|--------|
| t2724 | 38 | 38 | 38 | 0 | 100% | COMPLETE |
| vacation | 100 | 96 | 85 | 15 | 85% | COMPLETE |
| day-off | 121 | 33 | 25 | 3 | 89% (of specs) | COMPLETE |
| t3404 | 24 | 21 | 21 | 0 | 88% | COMPLETE |
| planner | 82 | 25 | 24 | 1 | 29% (of XLSX) | COMPLETE |

Vacation+day-off scope closed at Session 124: 110/128 verified (86%), 18 blocked by environment.

**Blocked vacation tests (15):** TC-VAC-024,039,064-070,077,084,090,097 + 2 auth/env
- Email pipeline (4): TC-VAC-039,068,069,070 — RabbitMQ consumer down on QA-1
- Calendar (1): TC-VAC-084 — API 502 on QA-1
- Auth/env (10): require timemachine clock, multi-user JWT, or TTT test endpoint auth

**Blocked day-off tests (3):** TC-DO-028,029 + 1 auth/env — approval state is final (no re-approve/re-reject)

### Current Scope (reports, accounting)

| Module | XLSX Cases | Specs | Verified | Failed | Pending | Coverage |
|--------|-----------|-------|----------|--------|---------|----------|
| reports | 60 | 19 | 8 | 1 | 41 | 13.3% |
| accounting | 38 | 0 | 0 | 0 | 38 | 0% |

### Reports Breakdown by Suite

| Suite | Total | Verified | Remaining |
|-------|-------|----------|-----------|
| TS-Reports-CRUD | 15 | 7 | 8 |
| TS-Reports-Confirmation | 12 | 0 | 12 |
| TS-Reports-Periods | 8 | 0 | 8 |
| TS-Reports-AutoReject | 5 | 0 | 5 |
| TS-Reports-Statistics | 8 | 0 | 8 |
| TS-Reports-Notifications | 4 | 0 | 4 |
| TS-Reports-Permissions | 8 | 0 | 8 |

### Queued Modules (XLSX exists, no specs)

| Module | XLSX Cases | Priority |
|--------|-----------|----------|
| sick-leave | 71 | Next |
| statistics | 76 | After sick-leave |
| admin | 84 | Low |
| security | 81 | Low |
| cross-service | 70 | Low |

### Overall Totals

| Metric | Count |
|--------|-------|
| Total XLSX test cases | 845 |
| Total automated specs | 232 (27.5%) |
| Total verified | ~186 |
| Total blocked | ~19 |
| Modules complete | 5 of 12 |

### Phase C Goals
- Generate and verify autotest specs for all 60 reports test cases
- Generate and verify autotest specs for all 38 accounting test cases
- Write-back discovered selectors and patterns to vault
- Target: 80%+ verified rate per module
