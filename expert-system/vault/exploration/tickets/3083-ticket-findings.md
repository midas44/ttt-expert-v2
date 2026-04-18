---
type: external
tags: [tickets, pm-tool, project-sync, cron, t3423]
created: 2026-04-17
updated: 2026-04-17
status: active
related: ["[[t3423-investigation]]", "[[EXT-cron-jobs]]", "[[modules/pm-tool-sync-implementation]]"]
branch: release/2.1
---

# Ticket #3083 + #3286 — PM Tool Project Sync (Job 23)

Investigation target: cron job 23 (`PmToolSyncScheduler.doPmToolSynchronization`) business contract — what entities are synced, what fields are pulled from PM Tool, what validation/merge rules apply.

## #3083 — Admin > Projects UI changes due to PM Tool migration

- **State:** closed 2026-04-16 (Sprint 15), labels: Backend / Production Ready
- **Type:** Requirements/design ticket for what changes in TTT UI + backend when project management moves to PM Tool. NOT the sync implementation itself — that's #3286.
- **Title (ru):** "[Админка] [Проекты] Внести изменения в раздел в связи с переносом части функционала в PM Tool"
- **URL:** https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3083

### PM Tool → TTT sync field contract (per #3083 description)

Fields **synced from PM Tool** to `ttt.project` on each sync cycle:

| Field (ru) | English | Notes |
|---|---|---|
| Название | Name | |
| Заказчик | Customer | |
| Страна | Country | |
| Супервайзор | Supervisor (Senior Manager) | |
| Менеджер | Manager (PM) | |
| Владелец | Owner | |
| Наблюдатели | Observers | |
| Статус | Status | 7 values on PMT side (draft = mapped to ACTIVE in TTT per note 1) |
| Тип | Type | |
| Модель | Model | (`T&M` rendered as `TM` on PMT profile page — see PMT vault) |
| Presales IDs | Presales tickets | **Append-only merge** — new IDs from sync added to existing `pre_sales_ids`; existing IDs never deleted; empty array = no change |

Fields that **stay in TTT** (not synced from PM Tool):

- Учетное название (Accounting name)
- Общая стоимость (Total cost)
- Дата первого репорта / последнего репорта (first/last report date)
- Скрипт синхронизации с трекерами (tracker sync script)
- Трекер задач по проекту (issue tracker)
- Прокси-сервер для трекера задач (proxy for tracker)
- История изменений (change history — see below)

Fields **removed** (no longer needed):
- База знаний по проекту (knowledgebaseUrl)
- Посмотреть нотификации по проекту (view project notifications)

### Status mapping (from note 1)
- `'draft'` on PM Tool = `ACTIVE` on TTT

### IDs are cs-ids (from note 2-3 + #3286 description)
- All employee-related IDs in PM Tool project payloads are **cs-ids** (CompanyStaff IDs). Sync validates them before applying to DB.
- Entity mappings in TTT use these cs-ids — so a PM Tool project's manager cs-id must exist in `ttt.employee.cs_id` or the project sync item fails (logged via `PmToolEntitySyncLauncher` as `"Unable to sync PROJECT {id}"` ERROR).

### Accounting name (learners'-name) rules
- For existing projects: keep the existing учетное название
- For new projects: use the first `Название` value received at creation time
- Once populated: **never update** (immutable; fix-by-script only if corrupted)
- This name is what TTT exports in its API to downstream systems — critical for backwards-compat.

### Default script-url rule (from #3286 description)
- Historical behavior: on project creation in TTT, `taskInfoScript` auto-populated with `ttt.noveogroup.com/api/ttt/resource/defaultTaskInfoScript.js`.
- New sync-from-PM-tool behavior: if an incoming project has empty script-url, auto-populate with the default. **This auto-set does NOT create an event in the project history** (important for test-case design — don't assert event count on sync of new projects).

### Event history rules
- For pre-existing TTT projects: keep all prior events.
- For new events after cutover: write history entries **only** for fields still owned by TTT:
  - Скрипт синхронизации с трекерами
  - Трекер задач по проекту
  - Прокси-сервер для трекера задач
- All PM-Tool-owned fields (Name, Customer, Status, etc.) update silently on sync — no history event.

### Permissions (unchanged, for reference)
- `VIEW` — anyone with access to Admin > Projects
- `EDIT` (tracker data only, since other fields are PM-Tool-owned now): Supervisor, Manager, Owner, ADMIN
- `TEMPLATES` (task templates): same roles as EDIT, restricted to `status != FINISHED`

### Note 4 — regression fix (2026-02-25, omaksimova/snavrockiy)
- Test case confirmed: "When editing a tracker, a change-history event is written for the tracker-sync-script change."
- Endpoint: `GET /api/ttt/v1/projects/{id}/events` — returns history entries
- Fixed on qa2 in same session. Regression test worth preserving.

## #3286 — Backend implementation of PM Tool sync (closed)

- **URL:** https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3286
- **Zero human notes.** All info in description.
- **Title (ru):** "[Backend] Внести изменения в раздел в связи с переносом части функционала в PM Tool"

### DONE (in #3286 itself):
- Project sync implementation from PM-tool → TTT
- `pm_id` column added to `ttt.project` (maps local TTT project → PM-tool project id)
- Employee ID validation: all project employee-related IDs are cs-ids; validated against `ttt.employee.cs_id` before apply
- Default script-url auto-populate if empty
- Test API to trigger sync: matches `POST /api/ttt/v1/test/project/sync`

### NOT DONE (deferred from #3286):
- Turning off event writing on project-modification for PM-tool-owned fields
- Deprecating project-creation API
- Deprecating some fields (e.g., `knowledgebaseUrl`)
- **Schedule synchronization** — explicitly deferred. The @Scheduled annotation on `PmToolSyncScheduler` was added later (not in this ticket).

## Relevance to cron testing scope (t3423, job 23)

- **Entity scope:** Job 23 syncs `PROJECT` entity (confirmed via code + these tickets). Per-entity markers in `PmToolEntitySyncLauncher` will log `"PmTool Sync PROJECT started (fullSync=false)"`.
- **Expected log pattern for a healthy sync cycle:**
  1. `"Pm tool synchronization started"` (scheduler)
  2. `"PmTool Sync PROJECT started (fullSync=false)"` (launcher)
  3. N × `"PROJECT {pm_id} synched"` (one per successful project)
  4. Optional: `"Unable to sync PROJECT {pm_id} due to timeout"` / `"Unable to sync PROJECT {pm_id}"` (ERROR) for failures — ID parked in `pm_tool_sync_failed_project` for next retry
  5. Optional: `"PmTool Sync failed PROJECT ids count = N start"` / `"retry batch {a}-{b} of {total}"` / `"count = N finished"` (retry stage)
  6. `"PmTool Sync PROJECT finished (fullSync=false), result = SyncResult(...), retryResult = SyncResult(...)"`
  7. `"Pm tool synchronization finished"` (scheduler)

- **Feature-toggle gate:** `PM_TOOL_SYNC-{env}` — when OFF, only lines 1 and 7 (scheduler start/finish) emit. Test automation must verify flag state before asserting on launcher markers.

- **No end-to-end "full sync" via API:** The scheduler always calls `sync(false)`. A true `fullSync=true` only runs at application startup via `TttStartupApplicationListener`. `POST /api/ttt/v1/test/project/sync` triggers a partial sync; it has no `fullSync` query parameter in release/2.1.

- **Test-case ideas** (for Phase B cron-collection XLSX):
  - Happy-path: flag ON, fresh project created in PM Tool, cron fires, verify log chain + verify `ttt.project.pm_id` populated + verify employee cs-ids validated.
  - Append-only presales merge: modify `pre_sales_ids` in TTT, add disjoint IDs on PMT side, force sync, verify union (no loss of TTT-only IDs).
  - Immutable `accounting_name`: create project on PMT with name "Foo", sync, verify TTT `accounting_name = "Foo"`. Rename on PMT to "Bar", sync, verify TTT `accounting_name` stays "Foo" but `name` updates to "Bar".
  - Default script-url silent population: sync new project with empty script, verify default applied, verify **no history event** for the auto-set.
  - History event exclusion: sync existing project with changed Status, verify `project_event` table has no new row (field is PMT-owned).
  - History event inclusion: edit tracker script via TTT UI, verify new `project_event` entry.
  - CS-id validation failure: sync project whose PM references a non-existent cs_id in TTT, verify ERROR log + entry in `pm_tool_sync_failed_project` + next-run retry behavior.
  - Feature toggle gate: disable `PM_TOOL_SYNC-{env}`, fire cron, verify only scheduler start/finish emit (no launcher markers).
  - Startup full sync: restart TTT service, verify `TttStartupApplicationListener` triggers `fullSync=true` path and that **all** PM Tool projects are re-fetched.

## #3417 follow-up

Re-fetched notes on #3417 in session 131: only 3 human notes exist (912297, 912719, 912972), all status updates from @vulyanov (2026-04-13, -15, -16) about expert-system integration rollout (Roundcube skill, Graylog skill, CS onboarding, PMT onboarding). **No test/cron content.** The "notes 4-9" item in the prior agenda was based on an incorrect expectation — #3417 is not a source of bug/corner-case knowledge for cron testing. Close this agenda item as "n/a — no additional notes".
