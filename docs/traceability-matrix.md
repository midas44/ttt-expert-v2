# Test Execution Traceability Matrix

Tracks autotest behavior across multiple runs with different test data modes and environments.

## How It Works

1. **JSON Reporter** (`e2e/reporters/jsonResultsReporter.ts`) — captures structured per-test results during every Playwright run
2. **History Archival** (`globalTeardown.ts`) — copies results to `autotests/history/<runId>/` after each run
3. **Matrix Generator** (`scripts/generate-matrix.ts`) — reads all history, generates `history/matrix.html`

## Usage

### Run tests (results are automatically captured and archived)

```bash
cd autotests
npx playwright test e2e/tests/vacation/ e2e/tests/day-off/ --grep "@col-absences|@regress" --project chrome-regress
```

After the run completes:
- `test-results-json/results.json` — raw reporter output
- `history/<runId>/results.json` — archived copy with enriched metadata

### Generate the matrix

```bash
npm run matrix
```

Or run tests + generate in one command:

```bash
npm run test:matrix
```

### View the matrix

```bash
xdg-open history/matrix.html
```

The HTML is self-contained (inline CSS/JS, no server needed).

## Matrix Features

- **Tab navigation**: All | per-domain (vacation, day-off, sick-leave, ...) | per-collection (col:absences)
- **Per-test row**: TC ID, title, module, priority, test docs reference (XLSX path), pass rate, flaky rate
- **Per-run columns**: color-coded status dot with tooltip (status, duration, browser, error details)
- **Run header**: date/time, environment, test data mode badge (dynamic/saved/static)
- **Status colors**: green (passed), red (failed), orange (flaky), gray (skipped), pink (timed out)
- Shows last 30 runs by default

## Building History Across Runs

Each test execution adds a new column to the matrix. To build a comparison:

```bash
# Run 1: dynamic mode on qa-1
# (ensure global.yml has testDataMode: dynamic)
npx playwright test e2e/tests/vacation/ e2e/tests/day-off/ --project chrome-regress

# Run 2: saved mode on qa-1
# (switch global.yml to testDataMode: saved, savedDataSet: latest)
npx playwright test e2e/tests/vacation/ e2e/tests/day-off/ --project chrome-regress

# Regenerate matrix with both runs
npm run matrix
```

## File Locations

| File | Purpose |
|------|---------|
| `e2e/reporters/jsonResultsReporter.ts` | Custom Playwright JSON reporter |
| `scripts/generate-matrix.ts` | HTML matrix generator script |
| `test-results-json/results.json` | Latest reporter output (gitignored) |
| `history/<runId>/results.json` | Archived results per run (gitignored) |
| `history/matrix.html` | Generated traceability matrix (gitignored) |
| `manifest/test-cases.json` | TC metadata source (title, priority, module, XLSX path) |
| `manifest/collection-*.json` | Collection membership definitions |
