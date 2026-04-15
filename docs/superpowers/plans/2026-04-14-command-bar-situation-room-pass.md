# Command Bar and Situation Room Pass

> **For agentic workers:** This pass was implemented directly in the main workspace to tighten the current terminal interaction loop without refactoring the whole shell.

**Goal:** Make the app feel more like a dense terminal by fixing the chokepoint-specific grid path, introducing a real command bar, and replacing the thin dashboard with a split-pane situation room.

**Architecture:** Keep the existing MAP workspace intact, but treat the header as a command surface rather than passive search. Make chokepoints a first-class grid dataset so that line-only mode behaves like every other layer. Concentrate the first split-pane terminal layout in the `DASH` view instead of rebuilding the whole shell in one pass.

**Tech Stack:** React, TypeScript, TanStack Table, CSS Modules, existing workspace reducer.

---

## Implemented

- Added a pure `resolveTerminalCommand()` utility to support direct `MAP`, `TABLE`, `DASH`, dataset-focus commands like `PIPE`, and asset commands like `REF RUWAIS`.
- Switched header search into a command bar form while preserving search-result fallback when input is not a recognized command.
- Added an in-memory activity log so user actions become visible in the new situation room.
- Made chokepoints render into the synchronized asset grid instead of falling into an empty-state branch.
- Added chokepoint-specific grid sorting/columns (`TRANSIT`, `BENCHMARKS`).
- Replaced the old three-stat dashboard with a denser situation room composed of:
  - workspace snapshot
  - current selection pane
  - priority assets table
  - chokepoint watch table
  - activity log
- Extended the shortcut overlay with command examples so the command syntax is discoverable.

## Explicit Non-Goals For This Pass

- No full-shell split-pane refactor of MAP view yet.
- No live market tape or streaming EIA pricing in the header yet.
- No refinery coordinate override/correction layer yet.
- No chart panel integration yet.

## Verification

- `npm test`
- `npm run build`

## Follow-Up

1. Add a proper command cheat sheet panel and richer command grammar (`WTI`, `HORMUZ`, operator shortcuts).
2. Push the split-pane model into the main MAP view rather than limiting it to `DASH`.
3. Add live market widgets and a real alert/news strip so the terminal feels active even when the user is idle.
