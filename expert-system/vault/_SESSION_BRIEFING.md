# Session Briefing

## Next Session — Instructions from Human Operator

**Phase:** A (knowledge_acquisition) | **Scope:** `t3423` (GitLab ticket #3423 — Cron & Startup Jobs Testing Collection) | **Mode:** full

The prior stream of work on `collection:absences` (sessions up to 128) is **paused**, not abandoned. Phase C is explicitly gated off in `expert-system/config.yaml` (`autotest.enabled: false`; `autotest.scope` left as dormant `collection:absences`). When this ticket reaches Phase C later, flip `autotest.enabled: true` and `autotest.scope: "collection:cron"` together.

### Start here every session

Read the pinned session preamble first — it carries the full scope table, deliverable paths, and non-default conventions for this ticket:

- `expert-system/vault/exploration/tickets/t3423-investigation.md`

Then read the ticket body for authoritative detail:

- `docs/tasks/cron/cron-testing-task.md` (mirrors [GitLab #3423](https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/3423))

### Non-default convention (critical)

This is a **ticket-scoped** investigation that produces **collection-shaped** deliverables. The default ticket-scope output path (`test-docs/t3423/t3423.xlsx`) is **wrong** for this ticket. Emit Phase B output to:

- `test-docs/collections/cron/test-plan.md`
- `test-docs/collections/cron/cron.xlsx` (sheet `COL-cron`, mirror `test-docs/collections/absences/absences.xlsx`)
- `test-docs/collections/cron/coverage.md`

Test IDs use the collection form `TC-CRON-###`, not the ticket form `TC-T3423-###`. If a session starts creating `test-docs/t3423/`, stop and reroute.

### Phase A focus

The ticket's canonical backlog is the 23-row scope table (cron + startup jobs across ttt, vacation, calendar, email services). For each row, the minimum Phase A outcome is:

1. Confirm the test-trigger endpoint exists on the target env (qa-1 is the default) and document its contract — request shape, sync/async, return payload.
2. For email-emitting crons (`E` channel): confirm expected subject format, sender, env prefix in the Roundcube mailbox — use the `roundcube-access` skill to sample live.
3. For every cron (all have `L` channel): confirm the Graylog marker (log message or lock name) the eventual test will query — use the `graylog-access` skill to sample.
4. For startup-only jobs (19, 21) and startup-full mode of 23: confirm CI permissions and mechanism for the `restart-<env>` job on `release/2.1` (qa-1, ttt-timemachine) and `stage` pipelines.

Mine these tickets for edge cases and historical bugs: #3083, #3262, #3303, #3345, #3346, #3337, #3417.

Update the three prior-art notes where they have gaps (don't silently re-learn — write back):
- `[[external/EXT-cron-jobs]]`
- `[[exploration/api-findings/cron-job-live-verification]]`
- `[[patterns/email-notification-triggers]]`

Log closed audit items in the `## Audit log` section at the bottom of `t3423-investigation.md` — one dated line per closed item, per session.

### Phase transition

`auto_phase_transition: true` is set. When `knowledge_coverage_target: 0.8` is met, the runner flips `phase.current` to `generation` and begins Phase B. Phase C remains gated until `autotest.enabled` is flipped manually.

### Non-goals for this session series

- **No Phase C artefacts** — do not scaffold `RoundcubeVerificationFixture` / `GraylogVerificationFixture`, do not create `autotests/e2e/tests/integration/cron/` specs, do not run `process_collection.py`.
- **No production cron or CI changes** — only existing test-trigger endpoints and the existing `restart-<env>` job are invoked.
- **No raw cron-expression validation** at the code level — the task verifies observable behaviour.
