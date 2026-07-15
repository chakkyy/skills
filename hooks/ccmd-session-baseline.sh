#!/bin/bash
# Command Center baseline (UserPromptSubmit hook).
# On EVERY user prompt, capture a CONTENT-sensitive fingerprint of the cwd's git
# working tree (not just `git status`) plus a high-resolution timestamp, so that
# "there was work this turn" in ccmd-report-check.sh is accurate even when the
# turn only edits a file that was already dirty. Also runs `ccmd prune --presence`.
set -u

CCMD="${ACC_CCMD:-ccmd}"

INPUT=$(cat)
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // "nosession"' 2>/dev/null)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)

# Private, session-scoped state dir (0700) — never a predictable /tmp path (#15).
STATE_DIR="${TMPDIR:-/tmp}/ccmd-hook-$(id -u)"
mkdir -p "$STATE_DIR" 2>/dev/null || true
chmod 700 "$STATE_DIR" 2>/dev/null || true
SAFE_SID=$(printf '%s' "$SESSION_ID" | tr -c 'A-Za-z0-9._-' '_')
STATE="$STATE_DIR/state-${SAFE_SID}"

# High-resolution timestamp (ms). Prefer node (ccmd already needs it); fall back to seconds.
NOW_MS=$(node -e 'process.stdout.write(String(Date.now()))' 2>/dev/null || echo $(( $(date +%s) * 1000 )))

# Content fingerprint of the whole working tree: tracked changes (diff) + every
# untracked file's name and content. Editing an already-dirty file changes this.
fp() {
  {
    git diff HEAD 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null | while IFS= read -r f; do
      printf '\n== %s ==\n' "$f"; cat "$f" 2>/dev/null
    done
  } | shasum 2>/dev/null | awk '{print $1}'
}

BASE_FP=""
if [ -n "$CWD" ] && cd "$CWD" 2>/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BASE_FP=$(fp)
fi

umask 077
{
  echo "last_prompt_ts=${NOW_MS}"
  [ -n "$BASE_FP" ] && echo "base_fp=${BASE_FP}"
} > "$STATE" 2>/dev/null
chmod 600 "$STATE" 2>/dev/null || true

# Presence = acknowledgement: archive DONE/read rows and re-render.
"$CCMD" prune --presence >/dev/null 2>&1 || true

exit 0
