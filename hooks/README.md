# Hooks (optional)

These make reporting **automatic** in Claude Code. They're optional — the board
works without them, agents just have to remember to run `ccmd report`. With them
wired up, a turn that changes a repo and forgets to report gets blocked once.

Two hooks:

- **`ccmd-session-baseline.sh`** (`UserPromptSubmit`) — on each prompt, records
  the turn's git baseline and runs `ccmd prune --presence` (you being back = you
  acknowledging read rows).
- **`ccmd-report-check.sh`** (`Stop`) — re-renders the board, and if the repo
  changed this turn with no fresh report, blocks the close once with
  instructions.

## Install

1. Copy the scripts somewhere stable and make them executable:
   ```bash
   mkdir -p ~/.claude/hooks
   cp hooks/ccmd-*.sh ~/.claude/hooks/
   chmod +x ~/.claude/hooks/ccmd-*.sh
   ```
2. Point them at your `ccmd`. Either put `ccmd` on your `PATH`, or export the
   absolute path so the hooks can find it:
   ```bash
   export ACC_CCMD="$HOME/path/to/skills/command-center/bin/ccmd"
   ```
   (The scripts default to `ccmd` on `PATH`.)
3. Register them in `~/.claude/settings.json`:
   ```jsonc
   {
     "hooks": {
       "UserPromptSubmit": [
         { "hooks": [{ "type": "command", "command": "~/.claude/hooks/ccmd-session-baseline.sh" }] }
       ],
       "Stop": [
         { "hooks": [{ "type": "command", "command": "~/.claude/hooks/ccmd-report-check.sh" }] }
       ]
     }
   }
   ```

## Notes

- Requires `jq` and `git`. Both hooks exit 0 on anything unexpected — they never
  block your work by accident.
- The Stop hook is **one-shot** per stop chain (`stop_hook_active`): it blocks at
  most once, then lets you through. It won't loop.
- It skips repos under `~/.claude` and under `$ACC_HOME`, so it never
  self-polices your config/store.
