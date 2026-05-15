done
#!/usr/bin/env bash
set -o errexit
set -o pipefail
set -o nounset

# Repo root (script lives in <repo>/scripts)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-packages/core}"
MODULE_DIR="$REPO_ROOT/$TARGET"
RUN_TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
SAFE_TARGET=$(echo "$TARGET" | sed 's/[\/ ]/-/g')
RUN_DIR="$REPO_ROOT/ci-runs/${RUN_TIMESTAMP}_${SAFE_TARGET}"
MAIN_LOG="$RUN_DIR/run.log"
MAIN_SUMMARY="$RUN_DIR/summary.md"

mkdir -p "$RUN_DIR"

echo "Run started: $RUN_TIMESTAMP" | tee "$MAIN_LOG"
echo "Target: $TARGET" | tee -a "$MAIN_LOG"

if [ ! -d "$MODULE_DIR" ]; then
  echo "Target module directory not found: $MODULE_DIR" | tee -a "$MAIN_LOG"
  echo "STEP_EXIT_CODE=2" | tee -a "$MAIN_LOG"
  exit 2
fi

mkdir -p "$MODULE_DIR/.logs" "$MODULE_DIR/.ci"

pushd "$MODULE_DIR" > /dev/null

for STEP in clean setup build test; do
  echo "=== STEP: $STEP ===" | tee -a "$MAIN_LOG"

  STEP_START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  STEP_START_EPOCH="$(date +%s)"
  STEP_TS_FN="$(echo "$STEP_START_ISO" | sed 's/:/-/g')"
  MODULE_LOG_FILE="$MODULE_DIR/.logs/${STEP}-${STEP_TS_FN}.log"
  MODULE_JSON="$MODULE_DIR/.ci/${STEP}-${STEP_TS_FN}.json"
  MODULE_EXPLAIN="$MODULE_DIR/operation-${STEP}-explain.md"
  MODULE_REPORT="$MODULE_DIR/operation-${STEP}-report.md"
  RUN_COPY_DIR="$RUN_DIR/$(echo "$TARGET" | sed 's/[\/]\+/_/g')"
  mkdir -p "$RUN_COPY_DIR"

  # choose command (prefer npm script)
  CMD="npm run $STEP"

  echo "Command chosen: $CMD" | tee -a "$MAIN_LOG" > "$MODULE_LOG_FILE"

  set +o errexit
  # run the command and capture output to both module log and main run log
  eval "$CMD" 2>&1 | tee -a "$MAIN_LOG" | tee -a "$MODULE_LOG_FILE"
  RC=${PIPESTATUS[0]}
  set -o errexit

  STEP_END_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  STEP_END_EPOCH="$(date +%s)"
  DURATION=$((STEP_END_EPOCH - STEP_START_EPOCH))

  NODE_VER="$(node --version 2>/dev/null || echo "not-found")"
  NPM_VER="$(npm --version 2>/dev/null || echo "not-found")"
  OS_INFO="$(uname -a)"

  # parse basic test metrics from module log
  TOTAL_TESTS=$(grep -Eo '([0-9]+) total' "$MODULE_LOG_FILE" | head -n1 | grep -Eo '[0-9]+' || true)
  PASSED_TESTS=$(grep -Eo '([0-9]+) passed' "$MODULE_LOG_FILE" | head -n1 | grep -Eo '[0-9]+' || true)
  FAILED_TESTS=$(grep -Eo '([0-9]+) failed' "$MODULE_LOG_FILE" | head -n1 | grep -Eo '[0-9]+' || true)

  # parse coverage (statements) if present
  COVER_STATEMENTS_VAL=$(grep -E 'Statements' "$MODULE_LOG_FILE" | head -n1 | sed -E 's/.*Statements[^0-9]*([0-9]+(\.[0-9]+)?).*/\1/' || true)

  # normalize nulls
  TOTAL_TESTS_VAL=${TOTAL_TESTS:-null}
  PASSED_TESTS_VAL=${PASSED_TESTS:-null}
  FAILED_TESTS_VAL=${FAILED_TESTS:-null}
  COVER_STATEMENTS_VAL=${COVER_STATEMENTS_VAL:-null}

  # write JSON summary
  cat > "$MODULE_JSON" <<EOF
{
  "operation": "$STEP",
  "path": "$TARGET",
  "command": "$CMD",
  "start": "$STEP_START_ISO",
  "end": "$STEP_END_ISO",
  "exit_code": $RC,
  "duration_seconds": $DURATION,
  "env": { "node": "$NODE_VER", "npm": "$NPM_VER", "os": "$OS_INFO" },
  "tests": { "total": $TOTAL_TESTS_VAL, "passed": $PASSED_TESTS_VAL, "failed": $FAILED_TESTS_VAL },
  "coverage": { "statements": $COVER_STATEMENTS_VAL },
  "artifacts": [".logs/${STEP}-${STEP_TS_FN}.log"]
}
EOF

  # write concise report
  cat > "$MODULE_REPORT" <<EOF
# operation-$STEP report

- operation: $STEP
- module: $TARGET
- command: $CMD
- start: $STEP_START_ISO
- end: $STEP_END_ISO
- exit_code: $RC
- duration_seconds: $DURATION

Raw log: .logs/${STEP}-${STEP_TS_FN}.log
JSON summary: .ci/${STEP}-${STEP_TS_FN}.json
EOF

  # write explain file (human readable)
  cat > "$MODULE_EXPLAIN" <<EOF
Operation: $STEP
Command chosen: $CMD

Reasoning:
- package.json present: $(test -f package.json && echo "yes" || echo "no")
- tsconfig.json present: $(test -f tsconfig.json && echo "yes" || echo "no")

Notes:
- Environment: node=$NODE_VER npm=$NPM_VER os=$OS_INFO
- Exit code: $RC
- Duration: ${DURATION}s

See raw log at .logs/${STEP}-${STEP_TS_FN}.log for full output.
EOF

  # copy JSON and explain to repo-level run dir for aggregation
  cp "$MODULE_JSON" "$RUN_COPY_DIR/" 2>/dev/null || true
  cp "$MODULE_EXPLAIN" "$RUN_COPY_DIR/" 2>/dev/null || true
  cp "$MODULE_REPORT" "$RUN_COPY_DIR/" 2>/dev/null || true

  echo "STEP_EXIT_CODE=$RC" | tee -a "$MAIN_LOG"
  if [ "$RC" -ne 0 ]; then
    echo "Step $STEP failed with exit code $RC" | tee -a "$MAIN_LOG"
    popd > /dev/null
    echo "Run ended: $RUN_TIMESTAMP" | tee -a "$MAIN_LOG"
    # create a simple summary
    echo "# Summary: $RUN_TIMESTAMP" > "$MAIN_SUMMARY"
    echo "- Target: $TARGET" >> "$MAIN_SUMMARY"
    echo "- Last failed step: $STEP (exit_code=$RC)" >> "$MAIN_SUMMARY"
    echo "- Log file: $MAIN_LOG" >> "$MAIN_SUMMARY"
    exit "$RC"
  fi
done

popd > /dev/null

# Compose final summary
{
  echo "# Summary: $RUN_TIMESTAMP"
  echo "- Target: $TARGET"
  echo "- Run dir: $RUN_DIR"
  echo
  grep -E 'Test Suites:|Tests:|Snapshots:|Time:|All files|Statements|Branches|Functions|Lines' "$MAIN_LOG" || true
  echo
  echo "Artifacts copied to ${RUN_DIR}/$(echo "$TARGET" | sed 's/[\/]\+/_/g')/"
  echo "Full log: $MAIN_LOG"
} > "$MAIN_SUMMARY"

exit 0
