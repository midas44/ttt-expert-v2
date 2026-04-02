---
type: agenda
updated: '2026-04-02'
---
# Investigation Agenda — Phase A (Knowledge Deepening)

## Scope: sick-leave, statistics, admin, security, cross-service

### P0 — Next Session (99) — Transition Preparation
- [ ] **Incorporate agent results** — Swagger live API testing results (statistics + admin), PostgreSQL schema deep-dive findings, Qase test coverage audit results
- [ ] **Final gap assessment** — identify any remaining depth gaps after agent integration
- [ ] **Phase B transition** — if all gaps addressed, update config.yaml: `phase.current: "generation"`, `phase.generation_allowed: true`. Reset control files per Phase Reset Protocol.

### P1 — If Gaps Remain (Session 100)
- [ ] **Qase audit** — verify existing test coverage gaps (if agent didn't complete)
- [ ] **Database schema** — statistics and admin tables (if agent didn't complete)
- [ ] **Cross-env comparison** — qa-1 vs stage for statistics and admin APIs
- [ ] **Security penetration testing** — verify API bypass patterns against live environment

### P2 — Backlog (carry to Phase B as enrichment)
- [ ] **Figma design comparison** — verify implemented UI against Figma designs for statistics and admin
- [ ] **Frontend code analysis** — complexity, dead code, duplication for statistics and admin modules
- [ ] **Integration test analysis** — existing backend test coverage

<details>
<summary>Completed Items (Sessions 96-98)</summary>

**Session 96:**
- [x] Phase reset: control files reset for Phase A (C→A transition)
- [x] Statistics ticket mining: 180+ tickets, comprehensive findings note created
- [x] Admin ticket mining: 120+ tickets, comprehensive findings note created
- [x] Sick-leave ticket mining: 45 tickets, findings note created
- [x] Security ticket mining: 85 tickets, findings note created
- [x] Cross-service ticket mining: 75 tickets, findings note created
- [x] Module health table: populated for all 5 modules

**Session 97:**
- [x] Knowledge depth verification: all 5 module deep-dive notes assessed
- [x] Statistics notes enrichment: frontend (800→2500 words), service (550→2000 words)
- [x] Admin note enrichment: +1500 words with PM Tool bugs, calendar validation
- [x] Sick-leave note enrichment: +1200 words with rejection order, norm propagation
- [x] Cross-service integration note created: 2500 words
- [x] Security patterns enrichment: +500 words
- [x] Vault index updated

**Session 98:**
- [x] Confluence requirements: Statistics Employee Reports full spec (2000+ words from page 119244531)
- [x] Sprint 15-16 tickets: 65+ new tickets, 9 critical documented (#3409, #3408, #3356, #3380, #3368, etc.)
- [x] API surface analysis: statistics (23 endpoints + DTOs), sick-leave (7 endpoints + DTOs), security (9 endpoints), admin (23 endpoints) from swagger specs
- [x] Vault notes enriched: 6 existing + 2 new (api-surface notes)
- [x] Coverage assessment: 87.6% weighted average
- [ ] Background agents: Swagger live testing, DB schema, Qase audit — results pending

</details>
