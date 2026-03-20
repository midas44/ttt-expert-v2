---
name: xlsx-parser
description: >
  Parse XLSX test documentation into a JSON manifest for test automation. Use this skill
  when the user asks to "parse xlsx", "update manifest", "parse test cases", "refresh
  manifest", "import test cases", "read xlsx", "convert xlsx to json", or any task
  involving extracting test case data from Excel workbooks into the automation pipeline.
  Also use when the user adds new XLSX files to the test-docs/ directory and needs them
  processed, or asks about test case counts, module coverage from the documentation,
  or wants to see what test cases are available for automation.
---

# XLSX Parser

Parse XLSX test documentation workbooks into a structured JSON manifest that the
autotest-generator skill consumes.

## When to Use

- New XLSX test documentation has been added or updated in `test-docs/`
- User asks to refresh or rebuild the test case manifest
- User wants to see what test cases are available before generating autotests
- Manifest is missing or outdated

## Source Files

XLSX workbooks are in `test-docs/` (10 workbooks, ~1,233 test cases across TTT modules).
Each workbook covers one module and contains sheets with test cases structured as:
test case ID, title, preconditions, steps, expected results, priority, tags.

## Process

### 1. Run the Parser

```bash
cd /home/v/Dev/ttt-expert-v2 && python3 autotests/scripts/parse_xlsx.py
```

If the parser script does not exist yet, create it. The script should:

- Read all `.xlsx` files from the input directory
- For each workbook, iterate over sheets
- Extract structured test case data (ID, module, title, preconditions, steps,
  expected results, priority, tags)
- Handle merged cells and multi-line step descriptions
- Output a single JSON manifest file

### 2. Validate Output

After parsing, verify the manifest:

```bash
python3 -c "
import json
with open('manifest/test-cases.json') as f:
    data = json.load(f)
print(f'Total test cases: {len(data[\"test_cases\"])}')
for module, count in sorted(data['summary']['by_module'].items()):
    print(f'  {module}: {count}')
"
```

### 3. Report Results

Show the user:
- Total test cases parsed
- Per-module breakdown
- Any parsing warnings (skipped rows, unrecognized formats)
- Delta from previous manifest (new/removed/changed test cases) if applicable

### 4. Optionally Populate SQLite

If the user wants tracking, sync the manifest to the SQLite analytics database:

```sql
INSERT OR IGNORE INTO autotest_tracking (test_id, module, suite, title, type, priority, automation_status, created_date, updated_date)
VALUES ('<test_id>', '<module>', '<suite>', '<title>', '<type>', '<priority>', 'pending', datetime('now'), datetime('now'));
```

This preserves the status of already-automated test cases while adding new ones.

## Manifest Schema

```json
{
  "generated_at": "2026-03-20T12:00:00Z",
  "source_files": ["test-docs/Reports-Tests.xlsx", "..."],
  "summary": {
    "total": 1233,
    "by_module": {"reports": 156, "vacations": 203, "...": "..."},
    "by_priority": {"critical": 89, "high": 312, "medium": 520, "low": 312}
  },
  "test_cases": [
    {
      "id": "TC-042",
      "module": "reports",
      "title": "Submit weekly report with all fields filled",
      "preconditions": ["User is logged in", "Report period is open"],
      "steps": [
        {"step": 1, "action": "Navigate to Reports page", "expected": "Reports page opens"}
      ],
      "priority": "high",
      "tags": ["reports", "submit", "smoke"]
    }
  ]
}
```

## Important Rules

- Never overwrite the manifest without checking for regressions in test case count
  (a sudden drop usually means a parsing bug, not removed test cases)
- Preserve any manual annotations added to the manifest (e.g., `"notes"` fields)
- The parser must handle Russian-language content in the XLSX files (some test cases
  may have Russian descriptions alongside English ones)
- If XLSX structure varies between workbooks, handle each format gracefully and log
  warnings rather than failing
