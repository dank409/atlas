# Header Search And Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact refinery search workflow and global `M` / `T` / `D` view shortcuts so users can jump between views and select assets from the terminal header.

**Architecture:** Keep search state in `App.tsx` because selection affects view mode, map activation, and the right-side detail panel. Render a dense search control in `HeaderBar.tsx`, pass only the data it needs as props, and guard keyboard shortcuts so they do not fire while the user is typing into interactive fields.

**Tech Stack:** React 19, TypeScript, Testing Library, Vitest, CSS Modules

---

## Chunk 1: App-Level Search And Shortcut State

### Task 1: Lock Red State For Cross-View Behavior

**Files:**
- Test: `src/App.integration.test.tsx`

- [ ] **Step 1: Run the failing integration test**

Run: `npx vitest run src/App.integration.test.tsx --reporter verbose`
Expected: FAIL because there is no header search input yet and keyboard view shortcuts are not wired.

- [ ] **Step 2: Confirm the failure reason**

Expected:
- The keyboard shortcut test stays on the dashboard after pressing `t`.
- The search test cannot find an input with placeholder `SEARCH`.

### Task 2: Wire Search And Shortcuts In App State

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/HeaderBar.tsx`
- Modify: `src/components/layout/HeaderBar.module.css`

- [ ] **Step 1: Add app-level search state**

Track:
- `searchQuery`
- filtered refinery matches derived from loaded refinery records

- [ ] **Step 2: Add global keyboard shortcut handling**

Behavior:
- `m` switches to `map`
- `t` switches to `table`
- `d` switches to `dash`
- Ignore shortcuts while focus is inside `input`, `textarea`, `select`, or content-editable nodes

- [ ] **Step 3: Add header search props and UI**

Header receives:
- current query
- change handler
- result list
- selection handler

Behavior:
- Match on refinery name, country name, country code, owner, and operator
- Show a compact dropdown only when the query is non-empty
- Selecting a result sets the selected refinery, switches to map view, and closes the dropdown

- [ ] **Step 4: Keep implementation minimal**

Do not add command palette behavior, fuzzy ranking libraries, or keyboard navigation yet.

## Chunk 2: Verification

### Task 3: Prove The Slice Works

**Files:**
- Test: `src/App.integration.test.tsx`
- Test: `src/components/layout/HeaderBar.test.tsx`

- [ ] **Step 1: Run the focused integration test**

Run: `npx vitest run src/App.integration.test.tsx --reporter verbose`
Expected: PASS

- [ ] **Step 2: Run related component coverage**

Run: `npm test -- --runInBand`
Expected: PASS for the existing component and service suite plus the integration test

- [ ] **Step 3: Run production build verification**

Run: `npm run build`
Expected: PASS with no new errors
