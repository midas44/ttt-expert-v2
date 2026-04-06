#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# Regression Detection Loop
#
# Alternates between:
#   Phase A: dynamic mode on ENV_A (qa-1) — generates fresh test data
#   Phase B: saved mode on ENV_B (stage) — replays same data on previous version
#
# After all iterations, run: npm run matrix
# Regressions = tests that fail on ENV_A but pass on ENV_B with the same data.
#
# Usage:
#   bash scripts/regression-loop.sh
#   ITERATIONS=3 bash scripts/regression-loop.sh
#   ITERATIONS=5 SCOPE="e2e/tests/vacation/" bash scripts/regression-loop.sh
##############################################################################

# --- Configuration (override via env vars) ---
ITERATIONS=${ITERATIONS:-10}
SCOPE=${SCOPE:-"e2e/tests/vacation/ e2e/tests/day-off/ e2e/tests/sick-leave/"}
GREP=${GREP:-"@col-absences|@regress"}
PROJECT=${PROJECT:-"chrome-regress"}
ENV_A=${ENV_A:-"qa-1"}
ENV_B=${ENV_B:-"stage"}

# --- Paths ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOTESTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TTT_YML="$AUTOTESTS_DIR/../config/ttt/ttt.yml"
GLOBAL_YML="$AUTOTESTS_DIR/e2e/config/global.yml"
RUN_ID_FILE="$AUTOTESTS_DIR/test-data/.current-run-id"

# --- Save original config for restore ---
ORIG_ENV=$(grep '^env:' "$TTT_YML" | sed 's/env: *"\?\([^"]*\)"\?/\1/')
ORIG_MODE=$(grep '^testDataMode:' "$GLOBAL_YML" | sed 's/testDataMode: *//')
ORIG_DATASET=$(grep '^savedDataSet:' "$GLOBAL_YML" | sed 's/savedDataSet: *//')

restore_config() {
  echo "[restore] Restoring original config..."
  sed -i "s/^env: .*/env: \"$ORIG_ENV\"/" "$TTT_YML"
  sed -i "s/^testDataMode: .*/testDataMode: $ORIG_MODE/" "$GLOBAL_YML"
  sed -i "s/^savedDataSet: .*/savedDataSet: $ORIG_DATASET/" "$GLOBAL_YML"
  echo "[restore] Done: env=$ORIG_ENV, mode=$ORIG_MODE, dataset=$ORIG_DATASET"
}

trap restore_config EXIT

echo "=============================================="
echo " Regression Detection Loop"
echo " Iterations: $ITERATIONS"
echo " ENV_A: $ENV_A (current version)"
echo " ENV_B: $ENV_B (previous version)"
echo " Scope: $SCOPE"
echo " Grep: $GREP"
echo " Project: $PROJECT"
echo "=============================================="

cd "$AUTOTESTS_DIR"

for i in $(seq 1 "$ITERATIONS"); do
  echo ""
  echo "====== Iteration $i/$ITERATIONS ======"

  # --- Phase A: dynamic on ENV_A ---
  echo "[phase-A] Setting env=$ENV_A, testDataMode=dynamic"
  sed -i "s/^env: .*/env: \"$ENV_A\"/" "$TTT_YML"
  sed -i "s/^testDataMode: .*/testDataMode: dynamic/" "$GLOBAL_YML"
  sed -i "s/^savedDataSet: .*/savedDataSet: latest/" "$GLOBAL_YML"

  echo "[phase-A] Running tests on $ENV_A (dynamic)..."
  npx playwright test $SCOPE --grep "$GREP" --project "$PROJECT" || true

  # Capture the run ID from Phase A
  if [ ! -f "$RUN_ID_FILE" ]; then
    echo "[phase-A] WARNING: .current-run-id not found — globalSetup may not have run"
    # Try to find the latest test-data dir
    DATA_RUN_ID=$(ls -1d test-data/20* 2>/dev/null | sort | tail -1 | xargs basename 2>/dev/null || echo "")
  else
    DATA_RUN_ID=$(cat "$RUN_ID_FILE" 2>/dev/null || echo "")
  fi

  if [ -z "$DATA_RUN_ID" ]; then
    echo "[phase-A] ERROR: Could not determine test data run ID. Skipping Phase B."
    continue
  fi
  echo "[phase-A] Test data run ID: $DATA_RUN_ID"

  # --- Phase B: saved on ENV_B ---
  echo "[phase-B] Setting env=$ENV_B, testDataMode=saved, savedDataSet=$DATA_RUN_ID"
  sed -i "s/^env: .*/env: \"$ENV_B\"/" "$TTT_YML"
  sed -i "s/^testDataMode: .*/testDataMode: saved/" "$GLOBAL_YML"
  sed -i "s/^savedDataSet: .*/savedDataSet: $DATA_RUN_ID/" "$GLOBAL_YML"

  echo "[phase-B] Running tests on $ENV_B (saved)..."
  npx playwright test $SCOPE --grep "$GREP" --project "$PROJECT" || true

  echo "[iter-$i] Done."
done

echo ""
echo "=============================================="
echo " All $ITERATIONS iterations complete."
echo " Generate matrix: npm run matrix"
echo " View: xdg-open history/matrix.html"
echo "=============================================="
