---
name: autotest-progress
description: >
  Report automation progress, coverage metrics, and prioritize next tests to automate.
  Use this skill when the user asks about "autotest progress", "automation coverage",
  "what's automated", "next test to automate", "automation status", "coverage report",
  "what should I automate next", "automation dashboard", or any question about how much
  of the test documentation has been converted to automated tests. Also use when the
  user wants to see per-module automation percentages, track which test cases are done,
  or plan the next automation sprint.
---

# Autotest Progress

Track and report automation coverage across all test case documentation. Helps
prioritize which tests to automate next based on module health, priority, and effort.

## When to Use

- User asks how much automation is complete
- User wants to know what to automate next
- User needs a coverage report for stakeholders
- User asks about a specific module's automation status

## Process

### 1. Check Scope

Read `autotest.scope` from `expert-system/config.yaml`. If not `"all"`, filter all queries to that module only. Valid values: `all`, `vacation`, `sick-leave`, `day-off`, `reports`, `statistics`, `accounting`, `admin`, `planner`, `security`, `cross-service`.

### 2. Gather Data

Query the SQLite tracking table (add `WHERE module = '<scope>'` if scope is not `"all"`):

```sql
-- Overall progress
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM autotest_tracking), 1) as pct
FROM autotest_tracking
GROUP BY status
ORDER BY count DESC;
```

```sql
-- Per-module breakdown
SELECT
  module,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'generated' THEN 1 ELSE 0 END) as automated,
  SUM(CASE WHEN status = 'passing' THEN 1 ELSE 0 END) as passing,
  SUM(CASE WHEN status = 'failing' THEN 1 ELSE 0 END) as failing,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  ROUND(SUM(CASE WHEN status IN ('generated','passing') THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as coverage_pct
FROM autotest_tracking
GROUP BY module
ORDER BY coverage_pct ASC;
```

### 2. Calculate Metrics

Key metrics to report:

- **Overall coverage**: automated / total test cases (%)
- **Per-module coverage**: each module's automation percentage
- **Pass rate**: passing / automated (% of automated tests that work)
- **Priority coverage**: critical and high priority test cases automated (%)
- **Velocity**: tests automated per week (from generated_at timestamps)

### 3. Prioritize Next Tests

Recommend the next tests to automate using this priority order:

1. **Critical priority, unautomated** -- highest business risk
2. **Modules with lowest coverage** -- reduce gaps in weak areas
3. **High priority in modules with existing page objects** -- lower effort, reuse pages
4. **Tests that validate known bug areas** -- cross-reference with vault `design_issues`
5. **Smoke tests across modules** -- maximize breadth for regression catching

```sql
-- Next 10 tests to automate
SELECT t.test_case_id, t.module, t.title, t.priority,
  CASE
    WHEN t.priority = 'critical' THEN 1
    WHEN t.priority = 'high' THEN 2
    WHEN t.priority = 'medium' THEN 3
    ELSE 4
  END as priority_rank
FROM autotest_tracking t
WHERE t.status = 'pending'
ORDER BY priority_rank ASC, t.module ASC
LIMIT 10;
```

### 4. Present Dashboard

Format the report as a clear summary:

```
Automation Progress (2026-03-20)
================================
Overall: 127/1233 (10.3%) automated | 119 passing | 8 failing

Per Module:
  Module          Total  Auto  Pass  Fail  Pend  Coverage
  -------         -----  ----  ----  ----  ----  --------
  reports           156    32    30     2   124    20.5%
  vacations         203    28    27     1   175    13.8%
  projects          180    22    20     2   158    12.2%
  employees         145    15    14     1   130    10.3%
  confirmation      120    12    11     1   108    10.0%
  ...

Priority Coverage:
  Critical: 45/89 (50.6%)
  High:     52/312 (16.7%)

Next recommended: TC-089 (reports, critical), TC-201 (vacations, critical), ...
```

### 5. Quick Status (from manifest)

If SQLite tracking is not yet populated, fall back to the manifest:

```bash
python3 -c "
import json, os
with open('autotests/manifest/test-cases.json') as f:
    manifest = json.load(f)
specs = set()
for root, dirs, files in os.walk('autotests/e2e/specs'):
    for f in files:
        if f.endswith('.spec.ts'):
            specs.add(f.replace('.spec.ts', ''))
total = manifest['summary']['total']
automated = len(specs)
print(f'Manifest: {total} test cases')
print(f'Specs found: {automated}')
print(f'Coverage: {automated/total*100:.1f}%')
"
```

## Important Rules

- Always show both the count and percentage -- raw numbers without context are misleading
- When recommending next tests, consider the effort (does a page object already exist?)
  not just the priority
- If coverage data seems stale, prompt the user to run `xlsx-parser` to refresh
- Cross-reference with `module_health` table in SQLite for modules with known issues
  that need test coverage most urgently
