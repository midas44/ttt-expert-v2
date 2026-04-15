---
name: autotest-runner
description: >
  Run generated Playwright E2E tests and analyze results. Use this skill when the user
  asks to "run autotests", "run generated tests", "execute test suite", "test results",
  "run test suite", "run specs", "run playwright tests", or wants to execute and review
  E2E test outcomes. Also use when the user asks to "run tests for module X", "check
  test status", "rerun failed tests", or mentions running a specific spec file. Covers
  running tests with filters (by module, tag, project, or file), parsing results, and
  saving run data to SQLite.
---

# Autotest Runner

**Scope:**
- TTT: full
- CS:  partial (@integration tag filters cross-project specs; runner is project-agnostic)


Run Playwright E2E tests and analyze results. Supports filtering, parallel execution,
and tracking results in SQLite for trend analysis.

## When to Use

- User asks to run all or a subset of generated tests
- User wants test results analyzed or summarized
- User asks to rerun failed tests
- User says "run autotests", "run test suite", "test results"

## Process

### 1. Determine Scope

Ask the user or infer what to run:

| Scope | Command |
|-------|---------|
| All tests | `npx playwright test` |
| Single spec | `npx playwright test e2e/tests/reports/reports-tc042.spec.ts` |
| Module (by tag) | `npx playwright test --grep @reports` |
| Priority (by tag) | `npx playwright test --grep @critical` |
| Project (browser) | `npx playwright test --project=chromium` |
| Failed only (rerun) | `npx playwright test --last-failed` |
| Ticket scope | `npx playwright test e2e/tests/t3404/` |

### 2. Execute Tests

```bash
cd /home/v/Dev/ttt-expert-v2/autotests && npx playwright test [filters] \
  --reporter=list,json \
  --output=test-results/
```

For long suites, run in background and monitor:

```bash
cd /home/v/Dev/ttt-expert-v2/autotests && npx playwright test [filters] \
  --reporter=json > test-results/run-$(date +%Y%m%d-%H%M%S).json 2>&1
```

### 3. Parse Results

From the JSON reporter output, extract:

- Total tests, passed, failed, skipped, flaky
- Per-module breakdown
- Failure details: test name, error message, stack trace, screenshot path
- Duration per test and total suite duration

### 4. Analyze Failures

For each failure, classify the error type:

| Type | Indicators | Action |
|------|-----------|--------|
| Selector not found | `locator.click: Error` / `Timeout` | Check if UI changed -- use `page-discoverer` |
| Timeout | `Test timeout of 30000ms exceeded` | Check if operation is slow or selector wrong |
| Data mismatch | `expect(received).toBe(expected)` | Verify test data matches environment state |
| Auth failure | Redirected to login page | Check fixture auth, session may have expired |
| Network error | `ERR_CONNECTION` / `502` | Check VPN, proxy bypass, environment health |

For known issues, search the vault:

```
mcp__qmd-search__search(query: "<error pattern> <module>", collection: "expert-vault")
```

### 5. Save to SQLite

Track each run for trend analysis:

```sql
INSERT INTO autotest_runs (run_id, timestamp, total, passed, failed, skipped, duration_ms, filter, report_path)
VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?);
```

### 6. Report to User

Summarize results concisely:

```
Run complete: 45 tests in 3m 22s
  Passed: 42 | Failed: 2 | Skipped: 1

Failures:
  1. tc-042-submit-weekly-report.spec.ts -- Timeout waiting for submit button
     -> Likely selector issue (UI may have changed)
  2. tc-105-vacation-request.spec.ts -- Expected "Approved" but got "Pending"
     -> Data state issue (approval not triggered)
```

## Important Rules

- Always run from the `autotests/` directory (playwright.config.ts must be in cwd)
- Use `--reporter=list` for human-readable output during interactive sessions
- Use `--reporter=json` when you need to parse results programmatically
- On failure, check if the environment is healthy before blaming the test (call
  `mcp__swagger-qa1-ttt-test__get-using-get-5` to verify API is responding)
- Save screenshots from failed tests to `artifacts/playwright/` for review
