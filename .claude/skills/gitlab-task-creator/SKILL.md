---
name: gitlab-task-creator
description: >
  Create new tasks/issues in the GitLab instance at gitlab.noveogroup.com — from a local
  markdown file or inline body, with labels, assignee, and optional link to a parent/related
  issue. Use this skill whenever the user asks to "create a ticket", "create issue", "open
  a GitLab task", "file a bug", "post the task doc as a ticket", "register an issue for
  X", "turn this markdown into a GitLab issue", "link issue to epic/parent", or mentions
  creating anything in GitLab. Also use when the user references a file in `docs/tasks/`
  and asks to publish it as a ticket, or asks to set an issue's assignee, labels, or
  parent link. Covers title prefix conventions, label-casing verification, the
  assignee_ids POST→PUT workaround, and the `relates_to` / `blocks` link types valid on
  this GitLab CE 16.11 instance. Complements the read-only gitlab-access skill.
---

# GitLab Task Creator — Time Tracking Tool (TTT)

**Scope:**
- TTT: full
- CS:  N/A (GitLab project 1288 (ttt-spring) is hardcoded; CS repo not yet identified)
- PMT: N/A (GitLab project 1288 (ttt-spring) is hardcoded; PMT repo not yet identified)

Create issues (a.k.a. "tasks" / "tickets") in `noveo-internal-tools/ttt-spring` on the
self-hosted GitLab CE 16.11 instance at `gitlab.noveogroup.com`. Read-only operations
(fetching issues, listing comments, searching) live in the companion `gitlab-access` skill.

## Configuration

- **PAT (API token):** stored in `.claude/.mcp.json` → `env.GITLAB_PERSONAL_ACCESS_TOKEN`
- **Project ID:** `1288` (ttt-spring). Always use this — no need to resolve.
- **API base:** `https://gitlab.noveogroup.com/api/v4`
- **TLS:** the instance terminates with an internal CA that Python sometimes rejects — use `verify=False` (or the Python equivalent with `ssl.CERT_NONE`). The `curl -k` flag does the same.

Read the PAT from `.claude/.mcp.json` at the start of any creation operation.

## Title convention

Prefix category in square brackets, matching existing tickets:

| Prefix | When |
|---|---|
| `[QA Automation]` | Anything produced by the AI expert system: new collections, autotest work, pipeline stress-tests (e.g. #3402, #3417, #3423) |
| `[Bug]` | Defect reports |
| `[Hotfix]` | Post-release fixes |
| `[Planner]`, `[Vacations]`, `[Statistics]`, `[Admin]`, `[Reports]` | Module-scoped work |

**Omit the H1 from the body.** GitLab renders the ticket title in the issue header; a
leading `# Title` inside the description just duplicates it and pushes the substance down.
Start the body directly with the metadata line(s) (e.g. `**Parent epic:** #3402`) or the
first section heading (`## Summary`). The same rule applies when editing an existing
issue — if you spot a stray H1 that repeats the title, strip it.

## Body source

Prefer authoring the body as a markdown file under `docs/tasks/<topic>/<name>.md`, then
posting it verbatim as the `description`. This keeps the content reviewable, diffable, and
version-controlled. Inline bodies are fine for short one-liners.

### Ticket references in the body

Bare `#NNN` is auto-linked by GitLab to an issue in the same project. Inside backticks
(`` `#NNN` ``) the reference stays literal. Two rules:

1. **Real ticket references** (e.g. `#3402`, `#3417`) — write bare so they link.
2. **Non-ticket numbers that happen to start with `#`** (row numbers, job numbers,
   list indexes) — reword as "row 19" / "job 8" / "item 3". Leaving them bare creates
   false links to unrelated low-numbered issues; wrapping in backticks works but reads as
   inline code.

### Collapsible explainers for jargon and deep context

Whenever the body uses a term, pattern, or concept that a reviewer outside the immediate domain might not know — message-broker semantics (e.g. "RabbitMQ fan-out"), internal acronyms, non-obvious flows, optional proofs of correctness — attach a collapsible **explainer block** right after the first mention. This keeps the main body short and skimmable while preserving the depth for readers who want it.

Use GitLab's native `<details>` / `<summary>` markup:

```markdown
…the producer emits events that fan out across services via RabbitMQ fan-out, and
writes to CS / PM Tool.

<details>
<summary>What "RabbitMQ fan-out" means here</summary>

One published event reaches many independent consumers. In TTT the four backends talk
over RabbitMQ; a single cron tick can trigger cascaded work in several services…

</details>
```

Guidelines:

- **Summary line** is a question or short noun phrase — "What X means here", "Why we do Y", "Evidence that Z holds". Users scan these; make the topic obvious.
- **Body** is Markdown — full tables, lists, and nested code blocks render correctly. Keep it tight (≤ 10–15 lines); if it needs more, link out to a vault note or Confluence page instead.
- **Blank lines** around the opening `<summary>` and around any images/code inside `<details>` are required for GitLab to render the content correctly.
- **One explainer per term.** Place it after the first occurrence; subsequent uses in the same ticket can rely on the reader having expanded it.
- **Don't hide critical information.** Acceptance criteria, scope, deliverables, and numbers stay in the visible body. Collapsible blocks are for context, not substance.

The same pattern applies to comments posted via the `test-reporting` skill — expand a short failure line with a `<details>` block that holds the full stack trace, payload, or log excerpt.

### Icons usage policy

Icons belong on category-marking H2 section headings, nowhere else. A small consistent set helps a reader scan a long body; sprinkling turns it into noise. Keep the body prose, metadata lines, and bullet items icon-free.

Approved glyphs for ticket-body H2 headings:

| Section | Glyph |
|---|---|
| References | 📚 |
| Scope / Inventory | 📋 |
| Deliverables | 📦 |
| Acceptance criteria / Done definition | ✅ |
| Non-goals / Exclusions | 🚫 |
| Prerequisites / Dependencies (optional) | ⚙️ |
| Warnings / Critical caveats (optional) | ⚠️ |

Rules:
- One glyph per heading, placed at the start: `## 📦 Deliverables`.
- Each glyph used **at most once per ticket** — pick either "Acceptance criteria" or "Done criteria", not both.
- Skip icons on Summary, Motivation, Verification recipe, and similar narrative sections — they aren't category markers.
- Do **not** decorate the title prefix, metadata lines, body paragraphs, or bullet items.
- Table cells may use `✅ ❌ ⚠️` for status columns (see `test-reporting`); that's a separate convention and doesn't count against the heading budget.

Anti-patterns: titles starting with `🚀` / `⚡` / similar; bullets like `🔹 item`, `👉 item`; per-paragraph emoji garnish; different glyphs for the same category across sibling tickets (users read many tickets in a row and lose their bearings).

### External spec / documentation links

When referencing a specification, design, or documentation page hosted outside GitLab (Confluence, Google Docs, Figma, Notion, SharePoint, etc.), always use this canonical format:

```
[<DocSystem>: <Title>](<URL>)
```

- `<DocSystem>` — title-cased system name as users say it: `Confluence`, `Google Docs`, `Figma`, `Notion`, `SharePoint`.
- `<Title>` — the actual page/document title, **not** the URL slug or numeric ID. URL-decode and replace `+` with spaces when pulling it out of a Confluence path.

Examples:

```
[Confluence: cron](https://projects.noveogroup.com/spaces/NOV/pages/32904541/cron)
[Confluence: Time Tracking Tool](https://projects.noveogroup.com/spaces/NOV/pages/18940713/Time+Tracking+Tool)
[Figma: Vacation Dashboard v2](https://www.figma.com/design/abc123/...)
[Google Docs: Release 2.1 plan](https://docs.google.com/document/d/.../edit)
```

Do **not** use:
- ❌ `Confluence NOV/32904541 — cron` (exposes the page ID as if it were the identifier)
- ❌ bare URLs without anchor text
- ❌ generic anchors like `[link](URL)`, `[here](URL)`, `[doc](URL)`

Apply this in the issue body the same way — the body is scanned in the GitLab UI, and `[Confluence: cron]` tells a reader the origin and topic at a glance. Page IDs are implementation detail.

## Labels

Label names are **case-sensitive and exact**. The label `In Progress` is stored in title
case, not "in progress". Always verify with a search call before posting; mismatched
labels are silently dropped from the request.

```bash
curl -sk --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/labels?search=progress&per_page=100"
```

Common labels on this project:
- Sprint tags: `Sprint 14`, `Sprint 15`, `Sprint 16`, …
- Status: `In Progress`, `Production Ready`
- Category: `Auto QA`, `Bug`, `Hotfix`

## Assignee

Resolve the GitLab user ID by username once, then pass `assignee_ids: [ID]`:

```bash
curl -sk --header "PRIVATE-TOKEN: $TOKEN" \
  "https://gitlab.noveogroup.com/api/v4/users?username=vulyanov"
# => [{ "id": 901, "username": "vulyanov", ... }]
```

### The POST → PUT quirk

On this GitLab instance, **form-encoded POST silently drops `assignee_ids`** even though
the API docs list it as a valid parameter on create. Two reliable workarounds:

1. **POST with JSON body** (recommended) — `Content-Type: application/json` plus
   `assignee_ids: [901]` in the JSON payload. Works in one call.
2. **POST then PUT** — POST without assignees, then immediately PUT the issue with
   `{"assignee_ids": [901]}` as JSON. Used as a fallback in the bundled script.

Always confirm success by reading back the `assignees` field from the API response and
checking the expected username is present.

## Linking to a parent / related issue

GitLab CE 16.11 does **not** expose Epics (Premium-only). Parent/child semantics are
instead expressed as issue links. Valid `link_type` values on this instance:

| link_type | Meaning |
|---|---|
| `relates_to` | generic related-issue link (default) |
| `blocks` | "this blocks that" |
| `is_blocked_by` | **NOT ACCEPTED** on CE 16.11 — returns 400 |

```bash
curl -sk -X POST --header "PRIVATE-TOKEN: $TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"target_project_id": 1288, "target_issue_iid": 3402, "link_type": "relates_to"}' \
  "https://gitlab.noveogroup.com/api/v4/projects/1288/issues/$IID/links"
```

Verify with `GET /projects/1288/issues/$IID/links` afterwards — the POST response body is
sometimes empty while the link itself is persisted.

## One-shot script

A bundled script handles all of the above in one call:

```bash
python3 .claude/skills/gitlab-task-creator/scripts/create_issue.py \
  --title "[QA Automation] Cron & Startup Jobs Testing Collection" \
  --body-file docs/tasks/cron/cron-testing-task.md \
  --labels "Sprint 16,Auto QA,In Progress" \
  --assignee vulyanov \
  --link 3402
```

Flags:
- `--title` — required. Include the bracket prefix.
- `--body` or `--body-file` — exactly one. `--body` is inline text; `--body-file` reads markdown from disk.
- `--labels` — comma-separated. The script looks each one up and aborts on a casing mismatch so nothing is silently dropped.
- `--assignee` — GitLab username (not display name). The script resolves to `assignee_ids`.
- `--link IID[:link_type]` — repeatable. Default link_type is `relates_to`.
- `--project-id` — override project. Defaults to `1288` (ttt-spring).
- `--dry-run` — print the payload without posting.

On success it prints the `iid`, `web_url`, final `labels`, `assignees`, and any links
created. On failure it exits non-zero with the GitLab error body.

## Full manual workflow (without the script)

1. Read the PAT from `.claude/.mcp.json`.
2. Verify labels: `GET /projects/1288/labels?search=<term>` for each label.
3. Resolve assignee: `GET /users?username=<name>` → take `.id`.
4. POST the issue with JSON body:
   ```bash
   curl -sk -X POST --header "PRIVATE-TOKEN: $TOKEN" \
     --header "Content-Type: application/json" \
     --data @payload.json \
     "https://gitlab.noveogroup.com/api/v4/projects/1288/issues"
   ```
   where `payload.json` is `{"title": "...", "description": "...", "labels": "A,B,C", "assignee_ids": [901]}`.
5. If `assignees` came back empty, PUT `{"assignee_ids": [901]}` to `/issues/<iid>`.
6. For each parent/related issue, POST the link as shown above.
7. Confirm: `GET /projects/1288/issues/<iid>` and inspect `title`, `labels`, `assignees`, plus `GET .../links`.

## Do-not-do

- Do **not** wrap real ticket references in backticks in the body — breaks auto-linking.
- Do **not** POST `assignee_ids` via URL-encoded form bodies — silently dropped.
- Do **not** use `link_type: is_blocked_by` — returns HTTP 400 on CE 16.11.
- Do **not** duplicate the `[Category]` prefix inside the body H1 — the title already carries it.
- Do **not** create the issue when a similar one already exists — search first
  (`GET /projects/1288/issues?search=<keyword>&state=opened`) and ask the user before
  posting.

## Related skills

- `gitlab-access` — read-only operations, attachments, pipelines, CI ops.
- `test-reporting` — QA test-result comments on existing issues (writes notes, not issues).
