---
name: collection-generator
description: >
  Create and process Curated Test Collections — named sets of test cases from
  different modules grouped into a single runnable Playwright test suite via a shared tag.
  Use this skill when the user asks to "create collection", "process collection",
  "curated collection", "cross-module test suite", "collection tag", "run collection",
  or mentions a collection name like "absences". Also use when the user wants to group
  tests from multiple domains into one executable suite.
---

# Collection Generator

Create and process Curated Test Collections for cross-module Playwright test suites.

## Concept

A **Curated Test Collection** is a named XLSX workbook that references existing test cases
from multiple modules. Processing a collection:
1. Adds a shared tag (`@col-<name>`) to existing spec files
2. Identifies test cases that need spec generation
3. Produces a report JSON for tracking

Collections enable cross-cutting test suites without duplicating specs — tests stay in
their original module directories, grouped only by tag.

## When to Use

- User asks to create a cross-module test suite
- User wants to run tests from different domains together
- User mentions "collection", "curated tests", or a collection name
- User sets `autotest.scope` to a collection name for autonomous Phase C execution

## Collection XLSX Format

**Location:** `test-docs/collections/<name>/<name>.xlsx`
**Sheet name:** `COL-<name>` (prefix `COL-` prevents `parse_xlsx.py` from parsing it as a module)

| Column | Header | Description | Example |
|--------|--------|-------------|---------|
| A | `test_id` | Source TC ID from module workbook | `TC-CS-013` |
| B | `source_module` | Module the TC belongs to | `cross-service` |
| C | `source_suite` | Suite (TS-* tab) the TC lives in | `TS-CrossService-EventProp` |
| D | `title` | Test case title (for reference) | `Calendar change triggers...` |
| E | `inclusion_reason` | Why this TC is in the collection | `Core calendar interaction` |
| F | `priority_override` | Optional (Critical/High/Medium/Low) | `Critical` |

All data in columns B-F is for reference — only column A (`test_id`) is used for processing.
Column B (`source_module`) is required for locating the spec file and manifest entry.

## Process: Create a New Collection

### Step 1: Identify test cases

Search the manifest for relevant test cases:
```python
import json
with open("autotests/manifest/test-cases.json") as f:
    manifest = json.load(f)
# Browse modules and suites to pick test cases
```

Or query SQLite:
```sql
SELECT test_id, title, module, feature FROM test_case_tracking
WHERE module IN ('vacation', 'day-off', 'cross-service')
ORDER BY module, test_id;
```

### Step 2: Create the XLSX

Use openpyxl to create the workbook:
```python
import openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "COL-<name>"
# Add headers and rows (see format above)
wb.save("test-docs/collections/<name>/<name>.xlsx")
```

### Step 3: Process the collection

```bash
# Dry run first — see what would happen
python3 autotests/scripts/process_collection.py --collection <name> --dry-run

# Execute — inject tags into existing specs
python3 autotests/scripts/process_collection.py --collection <name>
```

The script outputs a report at `autotests/manifest/collection-<name>.json` with:
- `tags_added` — specs that received the new tag
- `tags_already_present` — specs that already had the tag (idempotent)
- `needs_generation` — test cases without specs (need autotest-generator)
- `not_in_manifest` — test cases not found in manifest (check XLSX data)

### Step 4: Generate missing specs

For each test case with `"action": "needs_generation"` in the report, invoke the
`autotest-generator` skill. When generating, add the collection tag alongside the
standard tags:

```typescript
// Standard spec tag line:
test("TC-CS-013: Calendar change triggers vacation recalculation @regress @cross-service @col-absences", async ({
```

The tag format is `@col-<collection-name>`.

After generation, re-run `process_collection.py` to verify all tags are in place.

### Step 5: Run the collection

```bash
# Run all tests in the collection
cd autotests && npx playwright test --grep "@col-<name>" --project=chrome-headless

# Run in headed mode for debugging
cd autotests && npx playwright test --grep "@col-<name>" --project=chrome-debug
```

### Step 6: Verify

```bash
# Count tagged specs
grep -r "@col-<name>" autotests/e2e/tests/ | wc -l

# Should match the total in the collection XLSX
```

## Collection as Autonomous Scope

Use the `collection:` prefix in `autotest.scope`:

```yaml
autotest:
  scope: "collection:absences"   # prefix is mandatory
```

The Phase C session protocol:
1. Detects `collection:` prefix → extracts name (`absences`)
2. Runs `process_collection.py --collection absences` → reads report JSON
3. Works **only** on TCs in the report with `"action": "needs_generation"`
4. Generates up to `max_tests_per_session` specs per session
5. Re-runs `process_collection.py` after generation to update tags and report
6. When 0 `needs_generation` remain → scope complete, sets `autonomy.stop: true`

**Scope format summary:**
- `"all"` → full module sweep
- `"vacation"` → single module
- `"3404"` → ticket scope (`t3404`)
- `"collection:absences"` → curated collection (prefix required)

## Tag Convention

- Format: `@col-<collection-name>`
- Injected into the test title string alongside existing tags
- Example: `@regress @vacation @col-absences`
- Multiple collection tags allowed on same spec (test can be in multiple collections)

## Existing Example

**Collection: `absences`**
- Location: `test-docs/collections/absences/absences.xlsx`
- Tag: `@col-absences`
- 30 test cases: 13 cross-service + 9 vacation + 8 day-off
- Focus: absence-related cross-service interactions (calendar, notifications, sync)

## Cross-references

- **autotest-generator** — for generating missing specs (Phase C pipeline)
- **xlsx-parser** — for refreshing the main manifest before processing
- **autotest-runner** — for running the collection's test suite
- **autotest-progress** — for tracking collection coverage
