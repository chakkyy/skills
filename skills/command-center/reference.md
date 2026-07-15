# ccmd — command reference

The full CLI surface. `ccmd help` prints a condensed version. Every command
exits 0 (it never blocks a hook). `project`/`branch` auto-derive from git.

**Store:** `$ACC_HOME` (default `~/.agents-command-center`) — your data and
`config.json`. Set `ACC_HOME` to run against a throwaway store (tests, demos)
without touching your real one.

## Running ccmd

`ccmd` ships inside the skill at `bin/ccmd` and is **not on your PATH**. Either
run it by absolute path, or link it once:

```
ccmd link [--dir <bin>]  # symlink the binary into a PATH dir (default ~/.local/bin)
ccmd where               # print the binary's absolute path
```

`ccmd where` is handy for agents/hooks that need the absolute path
(`ACC_CCMD="$(…/bin/ccmd where)"`).

## Setup

```
ccmd init [flags]        # first-run setup (writes config.json)
ccmd demo                # seed a realistic example store (for preview/screenshots)
```

`ccmd init` with **no flags and a TTY** runs an interactive wizard. With any flag
(or no TTY) it's non-interactive:

| Flag | Meaning |
|------|---------|
| `--theme swiss\|terminal\|soft` | Board theme (default `swiss`). |
| `--accent "#0a84ff"` | Accent color (hex). |
| `--features loops,seen,mirror` | Enable these; others off. `stats` and core are always on. |
| `--product "id:Label:repo1,repo2"` | A product = a tab grouping repos. Repeatable. |
| `--product "id:Label:icon:repo1,repo2"` | Optional icon (compass, globe, terminal, page, box, cube, cloud, spark, layers, database, bot). |
| `--force` | Overwrite an existing config instead of merging. |

## Reporting

```
ccmd report --status IN_PROGRESS|BLOCKED|DONE --summary "…" \
  [--task "PROJ-1 / PR #2"] [--progress "3/5 · CI green"] \
  [--done "a;b"] [--in-flight "…"] [--next "…"] [--blocked "…"] \
  [--note "…"] [--agent name] [--tier max] [--project p] [--branch b]
```

Overwrites your `project/branch` row (last one wins). `--summary` is the
headline. List flags (`--done/--in-flight/--next/--blocked`) split on `;`.
On the board: `--blocked` → "Your move", `--next` → "Next", URLs in `--note`
become links. `ACC_AGENT` / `ACC_TIER` env vars supply defaults for
`--agent`/`--tier`.

## Signals (blockers & questions)

```
ccmd signal --kind blocker|question --msg "…" [--project p]   # prints an <id>
ccmd resolve <id>                                             # clear it
```

Signals persist, highlighted, until resolved. One self-contained signal per
pending decision. Put it on the tab of the product it's about (`--project`).

## Loops (async-work shelf)

```
ccmd loop --title "…" --summary "…" [--prompt-path f.md] [--links "u;u"] \
  [--prereqs "…"] [--hours N] [--status ready|waiting|draft] [--project p] [--id slug]
ccmd loop --done <id>
```

`draft` = still curating · `waiting` = curated but a prereq is unmet · `ready` =
paste-and-go. Grouped by product on the Loops tab. (Requires `features.loops`.)

## Read tracking

```
ccmd seen <key>          # key: entry:<project>/<branch>  |  signal:<id>
ccmd unseen <key>
ccmd prune [--presence]  # archive DONE/read rows now (--presence stamps last-seen)
```

## Rendering & serving

```
ccmd serve [--port 7777]     # live local dashboard; marking read persists here (POST /seen · /unseen)
ccmd render                  # regenerate $ACC_HOME/dashboard.html
ccmd data                    # JSON of the board model (debug / other consumers)
```

## Optional hosted mirror

Off by default (`features.mirror`). The board is local-first; the mirror exists
for teams that want a shared URL.

```
ccmd mirror [--fragment] [--out file.html]   # HTML export for a hosted page
ccmd set-url <url> | ccmd get-url            # remember the mirror URL
```

`--fragment` omits the `<html>/<head>/<body>` wrapper (for embedding in a host
that supplies its own).

## Config file

`$ACC_HOME/config.json`:

```jsonc
{
  "products": [
    { "id": "web", "label": "Web", "icon": "globe", "repos": ["app", "marketing"] }
  ],
  "theme": "swiss",              // swiss | terminal | soft
  "accent": "#0a84ff",           // any hex
  "features": { "loops": true, "seen": true, "mirror": false },
  "mirrorUrl": null,
  "staleMs": 21600000            // rows with no update past this go grey (6h default)
}
```

Feature toggles turn off the matching tab, commands, and board sections. `stats`
and the core report/signal loop are always on.

## Environment variables

| Var | Effect |
|-----|--------|
| `ACC_HOME` | Store location (default `~/.agents-command-center`). |
| `ACC_PORT` | Default port for `ccmd serve`. |
| `ACC_AGENT` / `ACC_TIER` | Defaults for `report --agent` / `--tier`. |

## Gotcha

`ccmd report --help` is **not** help — the unknown flag is swallowed and it
overwrites your row with an empty report. The only help is `ccmd help`.
