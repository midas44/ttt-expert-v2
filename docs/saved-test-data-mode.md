# Saved Test Data Mode — Usage Guide

The autotest framework supports three data modes: `static`, `dynamic`, and `saved`.
In **dynamic** mode, every test run produces YAML artifacts in `autotests/test-data/`.
In **saved** mode, tests load data from those artifacts instead of querying the DB.

## Step 1: Run in dynamic mode (save artifacts)

Verify `autotests/e2e/config/global.yml`:

```yaml
testDataMode: dynamic
savedDataSet: latest
```

Run tests from the `autotests/` directory:

```bash
cd autotests

# Vacation tests
npx playwright test e2e/tests/vacation/ --project chrome-regress

# Day-off tests
npx playwright test e2e/tests/day-off/ --project chrome-regress

# Absences collection (cross-module: vacation + day-off + sick-leave)
npx playwright test --grep "@col-absences" --project chrome-regress
```

After each run, verify artifacts were saved:

```bash
ls autotests/test-data/
ls autotests/test-data/latest/
```

You should see:
- A timestamped run directory (e.g., `20260406-153022-qa1/`)
- A `latest` symlink pointing to it
- `_meta.yml` with run metadata
- One `.yml` file per data class that executed

## Step 2: Switch to saved mode

Edit `autotests/e2e/config/global.yml`:

```yaml
testDataMode: saved
savedDataSet: latest
```

To use a specific run instead of the latest, set `savedDataSet` to the run ID:

```yaml
savedDataSet: 20260406-153022-qa1
```

## Step 3: Re-run in saved mode

Run the exact same commands as Step 1:

```bash
npx playwright test e2e/tests/vacation/ --project chrome-regress
npx playwright test e2e/tests/day-off/ --project chrome-regress
npx playwright test --grep "@col-absences" --project chrome-regress
```

Data classes will load args from YAML artifacts instead of querying the DB.
If any class doesn't have a saved artifact, it falls back to dynamic (queries DB and saves for next time).

## Step 4: Switch back when done

```yaml
testDataMode: dynamic
```

## Notes

- Use `--project chrome-regress` for headless runs, `chrome-debug` or `chrome-smoke` for headed
- `globalSetup` creates the run directory; `globalTeardown` writes `_meta.yml` and updates the `latest` symlink
- Each data class saves its own `.yml` file — partial runs are fine
- Artifacts are git-tracked and can be committed for team sharing
- The `.current-run-id` temp file is gitignored
