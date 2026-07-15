#!/bin/bash
# Command Center enforcement (Stop hook).
# If the turn changed the repo (HEAD moved or the working tree differs from the
# last prompt's baseline) and there's no fresh `ccmd report` for the cwd's
# project/branch since that prompt, block the stop ONCE with instructions.
# One-shot via stop_hook_active — it never loops. Also re-renders the board.
set -u

CCMD="${ACC_CCMD:-ccmd}"

INPUT=$(cat)
STOP_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // "nosession"' 2>/dev/null)
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)

# Keep the board fresh on every stop (cheap, never blocks).
"$CCMD" render >/dev/null 2>&1 || true

# Anti-loop: one-shot per stop chain. If we already blocked once, let it pass.
[ "$STOP_ACTIVE" = "true" ] && exit 0
[ -z "$CWD" ] && exit 0
cd "$CWD" 2>/dev/null || exit 0

# Git repos only.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Denylist: don't self-police the config/store dir or your agent config.
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
ACC_HOME_DIR="${ACC_HOME:-$HOME/.agents-command-center}"
case "$REPO_ROOT" in
  "$HOME/.claude"*) exit 0 ;;
  "$ACC_HOME_DIR"*) exit 0 ;;
esac

# This turn's baseline (written by ccmd-session-baseline.sh on each prompt).
STATE="/tmp/ccmd-state-${SESSION_ID}"
[ -f "$STATE" ] || exit 0
LAST_PROMPT_TS=$(grep '^last_prompt_ts=' "$STATE" | head -1 | cut -d= -f2-)
BASE_HEAD=$(grep '^base_head=' "$STATE" | head -1 | cut -d= -f2-)
BASE_DIRTY=$(grep '^base_dirty=' "$STATE" | head -1 | cut -d= -f2-)
[ -n "$LAST_PROMPT_TS" ] || exit 0
[ -n "$BASE_HEAD" ] || exit 0   # prompt happened outside a repo: no enforcement

# Was there work this turn? (read-only turns don't trigger)
CUR_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "none")
CUR_DIRTY=$(git status --porcelain 2>/dev/null | shasum | awk '{print $1}')
[ "$CUR_HEAD" = "$BASE_HEAD" ] && [ "$CUR_DIRTY" = "$BASE_DIRTY" ] && exit 0

# Is there a fresh report (after the prompt) for this project/branch?
FRESH=$("$CCMD" check --since "$LAST_PROMPT_TS" 2>/dev/null | jq -r '.fresh // false' 2>/dev/null)
[ "$FRESH" = "true" ] && exit 0

jq -n '{decision: "block", reason: "Command Center: you changed this repo during the turn but did not report your status. Before closing, run: ccmd report --status IN_PROGRESS|BLOCKED|DONE --summary \"one concrete, readable sentence about the CURRENT state\" (add --task/--progress/--next/--blocked if they apply). Then close the turn normally. If you hit a blocker or need a decision, also run ccmd signal --kind blocker|question --msg \"…\"."}'
exit 0
