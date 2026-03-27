---
name: test-reporting
description: >
  Report test results to GitLab issues as structured comments. Use this skill when the
  user asks to post test results, add QA comments, report testing status, write a test
  summary on a ticket, or document test findings on a GitLab issue. Also use when the
  user says "report results", "post QA comment", "add test results to ticket", "mark as
  tested", "write test report", or "comment with results". This skill provides the
  standard format for QA test result comments and handles posting them via the GitLab API.
---

# Test Reporting — GitLab Issues

Post structured QA test result comments on GitLab issues using the REST API.

## Configuration

- **PAT (API token):** stored in `.claude/.mcp.json` → `env.GITLAB_PERSONAL_ACCESS_TOKEN`
- **Project ID:** `1288` (ttt-spring)

Read the PAT from `.claude/.mcp.json` at the start of any reporting operation.

---

## Comment Format

All QA test result comments follow this structure:

```markdown
**QA: <STATUS>**

<1-3 sentence summary of what was tested and the outcome>

<details>
<summary>Detailed test results</summary>

### <Section 1 title>

<Tables, lists, or descriptions of test steps and results>

### <Section 2 title>

<More detailed results>

### Notes

<Edge cases, caveats, untested areas, environment info>

</details>
```

### Status Values

| Status | When to use |
|---|---|
| **PASSED** | All test scenarios pass |
| **FAILED** | One or more critical scenarios fail |
| **PARTIALLY PASSED** | Core functionality works but some scenarios have issues |
| **BLOCKED** | Cannot test due to environment/dependency issues |

### Formatting Guidelines

- **Header line** is always `**QA: <STATUS>**` (bold, no extra markup)
- **Summary** goes right after the header — short, scannable, no collapsible wrapper
- **Detailed results** go inside `<details>` / `<summary>` tags (collapsible)
- Use **markdown tables** for structured results (steps, expected/actual, status)
- Use checkmark emoji in tables: `✅` for pass, `❌` for fail, `⚠️` for partial/warning
- Reference **pipeline IDs**, **job IDs**, and **environment names** for traceability
- Include **endpoint responses** or **log excerpts** as evidence when relevant
- End with a **Notes** section for caveats, untested areas, or environment state after testing

---

## Example: CI/CD Rollback Test Report

```markdown
**QA: PASSED**

Rollback deployment tested on **qa-1** and **timemachine** environments using pipelines
290682, 290686, and 290955 (release/2.1). All core scenarios verified successfully:
- `generate-manifest` produces correct service versions (all ≤ pipeline ID)
- `rollback` jobs deploy exact versions from the manifest
- Test endpoint correctly reports the deployed pipeline build number
- Regular `deploy` remains unaffected

<details>
<summary>Detailed test results</summary>

### Phase 1: Manifest verification

| Pipeline | ttt-app | frontend | vacation | email | calendar | discovery | gateway | All ≤ PID |
|---|---|---|---|---|---|---|---|---|
| 290682 | **290682** | 290619 | 290504 | 290504 | 290621 | 290611 | 290611 | ✅ |
| 290686 | **290686** | 290619 | 290504 | 290504 | 290621 | 290611 | 290611 | ✅ |
| 290955 | **290955** | 290955 | 290887 | 290887 | 290887 | 290887 | 290887 | ✅ |

### Phase 2: Rollback on qa-1

| Step | Action | Endpoint result | Status |
|---|---|---|---|
| Baseline | Regular deploy (290955) | `Deployed version: LOCAL` | Expected |
| Rollback → 290682 | `rollback-qa-1-release` job 1052823 | `Deployed version: 290682` | ✅ PASS |
| Rollback → 290686 | `rollback-qa-1-release` job 1052894 | `Deployed version: 290686` | ✅ PASS |
| Restore | Regular deploy (290955) | `Deployed version: LOCAL` | Expected |

### Notes

- Same-pipeline rollback is a no-op (docker-compose does not recreate unchanged containers)
- Both environments restored to latest regular deploy after testing

</details>
```

---

## Bug Report Format (Individual Bugs as Comments)

Each bug found during QA testing gets its **own separate comment** on the GitLab issue. The format uses a checkbox prefix for tracking resolution status.

### Template

```markdown
* [ ] <N>. <Brief description of the bug>

**Example:**

`<env>`, `<user>`, <context description>

<details><summary>screen1</summary>

![screen1](/uploads/...)

</details>

**Expected:**

<What the correct behavior should be>

**Notes:**

* <Edge cases, related bugs, additional context>

**Env:**

`<env-name>`
```

### Checkbox Status Conventions

| Checkbox | Meaning |
|---|---|
| `* [ ] 1.` | Open bug, not resolved |
| `* [x] 1.` | Resolved / fixed |
| `* [x] [NOT A BUG] 1.` | Investigated, not a bug |
| `* [x] [WON'T FIX] 1.` | Acknowledged, won't be fixed |
| `* [x] [CAN'T REPRODUCE] 1.` | Cannot reproduce on current build |
| `* [x] [DESIGN] 1.` | Requires design decision |
| `* [ ] [DESIGN] 1.` | Open design question |

### Key Rules

1. **One bug per comment** — enables reply threading and independent resolution tracking
2. **Never edit original bug text** — always append updates using `**Upd:**`, `**Upd2:**` etc.
3. **Screenshots in collapsible `<details>` blocks** — keeps comments compact
4. **`**Env:**` block always present** — use backtick format: `` `qa-1` ``, `` `qa-1, timemachine` ``
5. **`**Example:**` block** — include env, user login, and reproduction context in backticks
6. **Sub-variants** of one bug use `1.1`, `1.2` numbering within the same comment
7. **Use backticks** for code entities: `` `lastApprovedDate > approvePeriod` ``, `` `useWeekendTableHeaders.tsx` ``

### Bug Report Example

```markdown
* [ ] 1. Edit icon missing for day-off on approve period start date (boundary `>` vs `>=`)

**Example:**

`qa-1`, `aglushko` (office Уран), approve period = `2026-03-01`, test holiday created on `2026-03-01`

<details><summary>screen1</summary>

![boundary-bug](/uploads/...)

</details>

**Expected:**

Day-off on March 1 (= approve period start date) should have the edit icon, since March 1 IS in the open approve period.

**Notes:**

* Code in `useWeekendTableHeaders.tsx` uses `lastApprovedDate > moment(approvePeriod)` — should be `>=`
* Low probability (holidays rarely fall on 1st of month) but incorrect behavior when they do
* Identified during static analysis (GAP-1 / ST-1), confirmed dynamically by creating a test holiday

**Env:**

`qa-1`
```

### Design Notes Format

For architectural or design observations (not bugs), use a separate comment:

```markdown
**Design Notes:** [Updated]

@designer_name @developer_name

* <Observation or recommendation>
* <Cross-reference to related tickets>
```

### TO DO Tracking

When bugs need developer attention, post a summary comment:

```markdown
**TO DO:**

@developer_name

1, 3, 5 (bug numbers from earlier comments that still need fixing)
```

---

## Updating Existing QA Comments

To update an existing QA comment (e.g., after deeper testing), use the PUT endpoint:

```bash
curl -s --noproxy "gitlab.noveogroup.com" \
  --header "PRIVATE-TOKEN: $TOKEN" \
  --header "Content-Type: application/json" \
  -X PUT "https://gitlab.noveogroup.com/api/v4/projects/1288/issues/$IID/notes/$NOTE_ID" \
  --data "$(python3 -c "import json,sys; print(json.dumps({'body': sys.stdin.read()}))" <<< "$BODY")"
```

**Note:** `$NOTE_ID` is the ID of the existing comment to update. Use GET to find it first.

---

## How to Post

Build the comment body in a shell variable, then post via the GitLab API:

```bash
TOKEN="<read from .claude/.mcp.json>"

BODY=$(cat <<'EOFBODY'
**QA: PASSED**

Summary of testing...

<details>
<summary>Detailed test results</summary>

### Section

| Col1 | Col2 |
|---|---|
| data | data |

</details>
EOFBODY
)

curl -s --noproxy "gitlab.noveogroup.com" \
  --header "PRIVATE-TOKEN: $TOKEN" \
  --header "Content-Type: application/json" \
  -X POST "https://gitlab.noveogroup.com/api/v4/projects/1288/issues/$IID/notes" \
  --data "$(python3 -c "import json,sys; print(json.dumps({'body': sys.stdin.read()}))" <<< "$BODY")"
```

**Important:** Always use the `python3 -c "import json..."` pipe to safely encode the body
as JSON. This handles newlines, quotes, and special characters correctly. Do NOT try to
manually escape the body or use `jq` — the python approach is proven reliable.

The response contains `id` (comment ID), `author`, and `created_at`. Build the direct
link as: `https://gitlab.noveogroup.com/noveo-internal-tools/ttt-spring/-/issues/<IID>#note_<id>`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Bad or expired PAT | Re-read token from `.claude/.mcp.json` |
| 404 Not Found | Wrong project ID or IID | Use project `1288`, check issue number |
| Tables not rendering | Missing blank line before table | Add `\n` before markdown table |
| Collapsible section not working | Missing blank line after `<summary>` tag | Ensure blank line between `</summary>` and content |
