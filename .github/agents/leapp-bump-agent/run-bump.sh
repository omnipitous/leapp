#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(pwd)
WORKDIR="packages/core"
OUT_JSON=$(mktemp)

cd "$WORKDIR"
# get outdated list (JSON). npm outdated exits non-zero when outdated, so allow failure
npm outdated --json > "$OUT_JSON" || true

if [ ! -s "$OUT_JSON" ] || [ "$(cat "$OUT_JSON")" = "{}" ]; then
  echo "No outdated packages in $WORKDIR"
  exit 0
fi

# pick a candidate: prefer same-major (safer), fallback to first
read PACKAGE CURRENT LATEST < <(node "$REPO_ROOT/.github/agents/leapp-bump-agent/pick_candidate.js" "$OUT_JSON")

if [ -z "$PACKAGE" ]; then
  echo "No candidate"
  exit 0
fi

BRANCH_NAME="bump/$(echo "$PACKAGE" | sed 's/[@\/]/-/g')-${LATEST}-$(date -u +%Y%m%dT%H%M%SZ)"

# export branch name for later steps in GitHub Actions
if [ -n "${GITHUB_ENV:-}" ]; then
  echo "PR_BRANCH=${BRANCH_NAME}" >> "$GITHUB_ENV"
else
  echo "PR_BRANCH=${BRANCH_NAME}" > ./.github/agents/leapp-bump-agent/pr_branch.txt
fi

cd "$REPO_ROOT"

echo "Installing $PACKAGE@$LATEST in $WORKDIR"
npm --workspace "$WORKDIR" install "${PACKAGE}@${LATEST}" --no-audit --no-fund

echo "Running build/tests"
npm --workspace "$WORKDIR" run build
npm --workspace "$WORKDIR" test

mkdir -p changelogs
CL_FILE="changelogs/packages-core-$(echo "$PACKAGE" | sed 's/[@\/]/-/g')-${LATEST}.md"
cat > "$CL_FILE" <<EOF
# Bump ${PACKAGE} to ${LATEST}

- Updated ${PACKAGE} from ${CURRENT} to ${LATEST}
- Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Notes: Automated bump run by leapp-bump-agent.

EOF

echo "Updated files. PR branch: $BRANCH_NAME"
exit 0
