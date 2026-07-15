#!/bin/bash
# Command Center baseline (UserPromptSubmit hook).
# On EVERY user prompt, capture: the prompt timestamp and the cwd's git state
# (HEAD + a hash of the working tree). This lets "there was work" in
# ccmd-report-check.sh mean "changes in THIS turn", not "in the whole session".
# It also runs `ccmd prune --presence` — the user typing = they're back = ack.
set -u

CCMD="${ACC_CCMD:-ccmd}"

INPUT=$(cat)
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // "nosession"' 2>/dev/null)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)

STATE="/tmp/ccmd-state-${SESSION_ID}"
NOW_MS=$(($(date +%s) * 1000))

BASE_HEAD=""
BASE_DIRTY=""
if [ -n "$CWD" ] && cd "$CWD" 2>/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BASE_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "none")
  BASE_DIRTY=$(git status --porcelain 2>/dev/null | shasum | awk '{print $1}')
fi

{
  echo "last_prompt_ts=${NOW_MS}"
  [ -n "$BASE_HEAD" ] && echo "base_head=${BASE_HEAD}"
  [ -n "$BASE_DIRTY" ] && echo "base_dirty=${BASE_DIRTY}"
} > "$STATE"

# Presence = acknowledgement: archive DONE/read rows and re-render.
"$CCMD" prune --presence >/dev/null 2>&1 || true

exit 0
