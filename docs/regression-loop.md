# Cross-Environment Regression Detection

Identifies tests that fail on qa-1 (current version) but pass on stage (previous version) using the same test data.

## How It Works

Each iteration of the loop:
1. **Phase A**: Runs tests in `dynamic` mode on `qa-1` — generates fresh test data + results
2. **Phase B**: Runs the same tests in `saved` mode on `stage` — replays the exact same test data from Phase A

A test that fails on qa-1 but passes on stage with identical data = **regression** (bug introduced in the current version).

## Quick Start

```bash
cd autotests
npm run regress-loop
```

Default: 10 iterations over vacation, day-off, sick-leave, and absences collection.

After the loop finishes:

```bash
npm run matrix
xdg-open history/matrix.html
```

## Configuration

All settings are overridable via environment variables:

```bash
# Run 3 iterations over vacation tests only
ITERATIONS=3 SCOPE="e2e/tests/vacation/" npm run regress-loop

# Run 5 iterations over all absences
ITERATIONS=5 npm run regress-loop

# Compare different environments
ENV_A="qa-1" ENV_B="timemachine" ITERATIONS=2 npm run regress-loop

# Use headless mode for faster runs
PROJECT="chrome-headless" ITERATIONS=10 npm run regress-loop
```

| Variable | Default | Description |
|----------|---------|-------------|
| `ITERATIONS` | `10` | Number of Phase A + Phase B cycles |
| `SCOPE` | `e2e/tests/vacation/ e2e/tests/day-off/ e2e/tests/sick-leave/` | Test directories to run |
| `GREP` | `@col-absences\|@regress` | Playwright grep filter for test tags |
| `PROJECT` | `chrome-regress` | Playwright project (headed) |
| `ENV_A` | `qa-1` | Current version environment |
| `ENV_B` | `stage` | Previous version environment |

## Reading the Matrix

After running `npm run matrix`, the HTML shows:

- **Run columns**: Alternate between qa-1 (dynamic) and stage (saved) runs
- **Test data ID**: Both runs in a pair share the same test data ID
- **Regr column**: Number of regression detections per test case (red badge)
- **Red ring on dots**: Status dots with a red ring indicate a regression detection
- **Regressions tab**: Filters to only show TCs with at least one regression

## What Counts as a Regression

A regression is detected when two runs share the same `testDataRunId` (same test data) but have different environments, and a test case:
- **Failed** on one environment
- **Passed** on the other

This ensures the failure is due to code differences between environments, not data differences.

## Config Restoration

The script saves and restores `config/ttt/ttt.yml` and `autotests/e2e/config/global.yml` automatically, even if interrupted (via bash `trap`). After the loop, your config is back to its original state.

## File Locations

| File | Purpose |
|------|---------|
| `scripts/regression-loop.sh` | Main loop script |
| `scripts/generate-matrix.ts` | Matrix generator with regression detection |
| `history/<runId>/results.json` | Archived results per run |
| `test-data/<runId>/*.yml` | Test data artifacts per run |
| `history/matrix.html` | Generated traceability matrix |
