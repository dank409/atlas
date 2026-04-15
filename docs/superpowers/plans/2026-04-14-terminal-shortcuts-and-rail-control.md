# Terminal Shortcuts And Rail Control Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the MAP workspace closer to the written terminal spec by implementing the missing keyboard interaction model and a collapsible right sidebar.

**Architecture:** Extend app-level workspace/UI state in `App.tsx` so keyboard shortcuts can coordinate view mode, dataset toggles, search focus, selection clearing, help overlay visibility, and right-rail open/close behavior. Keep shell layout concerns inside `AppShellLayout` and add a focused shortcut overlay component instead of scattering help text across existing panels.

**Tech Stack:** React, TypeScript, CSS Modules, Vitest, Testing Library

---

## Chunk 1: Lock the interaction contract with tests

### Task 1: Add failing shortcut and rail behavior coverage

**Files:**
- Modify: `src/App.integration.test.tsx`
- Create: `src/components/layout/ShortcutOverlay.tsx`
- Modify: `src/components/layout/HeaderBar.test.tsx`

- [ ] **Step 1: Add a failing test for slash-to-search focus**

Assert that pressing `/` focuses the header search input when the user is not already typing.

- [ ] **Step 2: Add a failing test for escape deselect**

Assert that selecting an asset and then pressing `Escape` clears the selected asset and returns the detail rail to its placeholder state.

- [ ] **Step 3: Add a failing test for numeric layer toggles**

Assert that pressing `1` toggles refineries and pressing `2` toggles pipelines in the active dataset set.

- [ ] **Step 4: Add a failing test for right-rail collapse and reopen-on-selection**

Assert that pressing `]` collapses the right sidebar, and selecting an asset reopens it automatically.

- [ ] **Step 5: Add a failing test for shortcut help overlay**

Assert that pressing `?` opens a shortcuts overlay containing the core keyboard legend, and `Escape` closes it.

## Chunk 2: Implement app-level shortcut state and keyboard handling

### Task 2: Add the missing terminal controls

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/types/infrastructure.ts`
- Modify: `src/components/layout/HeaderBar.tsx`
- Modify: `src/components/layout/AppShellLayout.tsx`
- Modify: `src/components/layout/AppShellLayout.module.css`
- Create: `src/components/layout/ShortcutOverlay.tsx`
- Create: `src/components/layout/ShortcutOverlay.module.css`

- [ ] **Step 1: Extend UI state**

Track `isRightSidebarOpen` and `isShortcutHelpOpen` at the app layer.

- [ ] **Step 2: Expose the search input ref target**

Make the header search input focusable from app-level keyboard handling.

- [ ] **Step 3: Expand the keyboard handler**

Implement `/`, `Escape`, `?`, `]`, and numeric dataset toggle shortcuts while preserving the existing `M/T/D` view switching.

- [ ] **Step 4: Auto-reopen the right sidebar on asset selection**

If a user selects an asset from the map, search, or grid while the right rail is collapsed, reopen it automatically.

- [ ] **Step 5: Render a compact shortcut overlay**

Show a terminal-style help overlay with the implemented bindings only.

## Chunk 3: Verify end-to-end

### Task 3: Run the checks

**Files:**
- Test only

- [ ] **Step 1: Run targeted interaction tests**

Run: `npm test -- src/App.integration.test.tsx src/components/layout/HeaderBar.test.tsx`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS
