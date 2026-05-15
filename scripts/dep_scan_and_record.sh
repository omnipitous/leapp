#!/usr/bin/env bash
set -o errexit
set -o pipefail
set -o nounset

TARGET="${1:-packages/core}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODULE_DIR="$REPO_ROOT/$TARGET"
RUN_TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
SAFE_TARGET=$(echo "$TARGET" | sed 's/[\/ ]/-/g')
RUN_DIR="$REPO_ROOT/ci-runs/${RUN_TS}_${SAFE_TARGET}"
RUN_COPY_DIR="$RUN_DIR/$(echo "$TARGET" | sed 's/[\/]\+/_/g')"

mkdir -p "$MODULE_DIR/.ci" "$RUN_COPY_DIR"

if [ ! -d "$MODULE_DIR" ]; then
  echo "Module not found: $MODULE_DIR" >&2
  exit 2
fi

pushd "$MODULE_DIR" > /dev/null

OUTDATED_JSON="$MODULE_DIR/.ci/outdated-${RUN_TS}.json"
AUDIT_JSON="$MODULE_DIR/.ci/audit-${RUN_TS}.json"
SCAN_MD="$MODULE_DIR/.ci/dependency-scan-${RUN_TS}.md"

# npm outdated may exit with code >0 when outdated packages exist; allow it
set +o errexit
npm outdated --json 2>/dev/null | tee "$OUTDATED_JSON" || true
npm audit --json 2>/dev/null | tee "$AUDIT_JSON" || true
set -o errexit

# Compose a human readable scan
cat > "$SCAN_MD" <<EOF
# Dependency scan - $RUN_TS

Module: $TARGET

## Outdated packages (npm outdated)

EOF

if [ -s "$OUTDATED_JSON" ]; then
  # Pretty table if jq available, otherwise raw JSON
  if command -v jq >/dev/null 2>&1; then
    echo "| Package | Current | Wanted | Latest | Type |" >> "$SCAN_MD"
    echo "|---|---:|---:|---:|---|" >> "$SCAN_MD"
    jq -r 'to_entries[] | [.key, .value.current, .value.wanted, .value.latest, (.value.type // "dependencies")] | @tsv' "$OUTDATED_JSON" \
      | awk -F"\t" '{printf "| %s | %s | %s | %s | %s |\n", $1, $2, $3, $4, $5}' >> "$SCAN_MD"
  else
    echo "(jq not found) Raw JSON saved at $OUTDATED_JSON" >> "$SCAN_MD"
    echo >> "$SCAN_MD"
    cat "$OUTDATED_JSON" >> "$SCAN_MD"
  fi
else
  echo "No outdated packages detected." >> "$SCAN_MD"
fi

# Audit summary
cat >> "$SCAN_MD" <<EOF

## Audit summary (npm audit)

EOF

if [ -s "$AUDIT_JSON" ]; then
  if command -v jq >/dev/null 2>&1; then
    TOTAL_VULNS=$(jq '.metadata.vulnerabilities | map_values(.) | add' "$AUDIT_JSON" 2>/dev/null || true)
    echo "Vulnerabilities summary: see $AUDIT_JSON" >> "$SCAN_MD"
    echo "Raw audit JSON saved at $AUDIT_JSON" >> "$SCAN_MD"
  else
    echo "(jq not found) Raw audit JSON saved at $AUDIT_JSON" >> "$SCAN_MD"
  fi
else
  echo "No audit information produced or no vulnerabilities found." >> "$SCAN_MD"
fi

# Copy artifacts to repo-level run dir for traceability
cp --parents "$OUTDATED_JSON" "$RUN_COPY_DIR" 2>/dev/null || cp "$OUTDATED_JSON" "$RUN_COPY_DIR/" 2>/dev/null || true
cp --parents "$AUDIT_JSON" "$RUN_COPY_DIR" 2>/dev/null || cp "$AUDIT_JSON" "$RUN_COPY_DIR/" 2>/dev/null || true
cp --parents "$SCAN_MD" "$RUN_COPY_DIR" 2>/dev/null || cp "$SCAN_MD" "$RUN_COPY_DIR/" 2>/dev/null || true

# Produce a short JSON summary for the agent
SUMMARY_JSON="$MODULE_DIR/.ci/dependency-scan-summary-${RUN_TS}.json"
jq -n --arg path "$TARGET" --arg ts "$RUN_TS" '{path:$path, timestamp:$ts, outdated: (input_filename? // null)}' > "$SUMMARY_JSON" 2>/dev/null || echo "{\"path\": \"$TARGET\", \"timestamp\": \"$RUN_TS\"}" > "$SUMMARY_JSON"
cp "$SUMMARY_JSON" "$RUN_COPY_DIR/" 2>/dev/null || true

popd > /dev/null

echo "Scan completed: $RUN_COPY_DIR"
exit 0
