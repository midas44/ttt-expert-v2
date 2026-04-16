---
type: integration
systems: [ttt, pmt]
tags: [pmt, integration, sync, project-management]
updated: 2026-04-16
status: stub
---

# TTT ↔ PMT Integration (one-way project sync)

PMT (Project Management Tool) is the source-of-truth for project records (project settings, project lifecycle metadata). TTT consumes project data via one-way API sync from PMT.

## Flows exercised by cross-project E2E tests

- Change project parameters on PMT → verify the synced state on TTT side (e.g., renamed project, updated project type / manager / department / status appears correctly in TTT admin + downstream reports).
- Create a new project on PMT → verify that TTT pulls in the new project and that expected functionality works (project visible in admin project list, assignable to employees, shows up in reports with the right attributes).

## Related notes

- [[pm-tool-integration-deep-dive]] — PM Tool integration deep dive (TTT-side): 2-phase ID mapping (`ttt_id`, `pmToolId`, `pmtId`), Sprint 15 changes, field semantics.
- [[pm-tool-sync-implementation]] — PM Tool sync implementation walkthrough: `PmToolEntitySyncLauncher`, `PmToolProjectSynchronizer`, `pm_tool_sync_failed_entity` table, rate limiter.
- [[pm-tool-stage-comparison]] — PM Tool differences between release/2.1 and stage branches.
- [[admin-panel-deep-dive]] — TTT admin panel; contains "PM Tool sync" section with TTT-side behavior.
- [[cross-service-integration]] — TTT cross-service integrations overview; lists PM Tool among integrations.
- [[pmt/_overview]] — PMT at a glance (access, role, scope).

## External documentation

- PMT Confluence entry: https://projects.noveogroup.com/spaces/NOV/pages/18944057/Project+Management+Tool

## Open items

`TODO(PMT)`: flesh out with concrete field-level mapping (PMT → TTT), sync triggers (manual vs cron), error handling, and known-bug catalogue once an investigation session covers it. Today this note is a stub that points at existing TTT-side content; the symmetric PMT-side details will accrue as cross-project tests are authored.
