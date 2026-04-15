# MAP UX Density Pass Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the MAP workspace so dense real infrastructure data is actually usable: sortable grid, clearer hover/selection feedback, easier pipeline clicks, and more immediate asset inspection.

**Architecture:** Shift the bottom asset grid from a mixed-all-assets dump to a focused-dataset view with dataset-aware columns and sorting. Add a lightweight map inspection card and hover tooltip in the map layer itself, while keeping the right rail as the full persistent context surface. Improve pipeline interaction with a dedicated hit layer so line selection is reliable at production map scales.

**Tech Stack:** React, TypeScript, TanStack Table, Mapbox GL JS, Vitest, Testing Library

---

## Chunk 1: Lock the UX contracts with tests

### Task 1: Add failing tests for grid behavior and immediate inspection

**Files:**
- Modify: `src/components/tables/AssetGridTable.tsx`
- Create: `src/components/tables/AssetGridTable.test.tsx`
- Modify: `src/App.integration.test.tsx`

- [ ] **Step 1: Write a failing asset grid sorting test**

Assert that clicking sortable headers reorders rows in a deterministic way for at least one dataset-aware column.

- [ ] **Step 2: Write a failing dataset-aware column test**

Assert that when the focused dataset is pipelines, the grid shows pipeline-specific column labels like owner/hydrocarbon/length instead of the generic mixed-asset labels.

- [ ] **Step 3: Write a failing integration test for upfront asset inspection**

Assert that selecting an asset opens an immediate inspection card in the map workspace in addition to the persistent right-rail context.

- [ ] **Step 4: Run the targeted tests to verify they fail**

Run: `npm test -- src/components/tables/AssetGridTable.test.tsx src/App.integration.test.tsx`
Expected: FAIL because sorting, dataset-aware columns, and the map inspection card are not implemented yet.

## Chunk 2: Rebuild the asset grid around focused datasets

### Task 2: Make the bottom grid sortable and dataset-aware

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/MapWorkspaceMain.tsx`
- Modify: `src/components/tables/AssetGridTable.tsx`
- Modify: `src/components/tables/AssetGridTable.module.css`
- Modify: `src/utils/infrastructure.ts`

- [ ] **Step 1: Scope grid rows to the focused dataset**

Change the MAP workspace grid so it defaults to showing rows for the focused dataset rather than every visible asset across all active layers.

- [ ] **Step 2: Implement dataset-aware columns**

Use TanStack Table to expose smarter columns for focused datasets:
- refineries: operator / owner / capacity
- pipelines: owner / hydrocarbon / length
- fields: operator / basin / production
- terminals: operator / role / capacity

- [ ] **Step 3: Implement sortable headers**

Add terminal-style sortable headers with ascending/descending state and stable sort accessors for text and numeric columns.

- [ ] **Step 4: Run the targeted tests**

Run: `npm test -- src/components/tables/AssetGridTable.test.tsx`
Expected: PASS

## Chunk 3: Improve map interaction density

### Task 3: Add hover labels, better pipeline hit targets, and an upfront selection card

**Files:**
- Modify: `src/components/map/MapView.tsx`
- Modify: `src/components/map/MapView.module.css`
- Modify: `src/components/layout/MapWorkspaceMain.tsx`
- Create: `src/components/panels/SelectionPreviewCard.tsx`
- Create: `src/components/panels/SelectionPreviewCard.module.css`

- [ ] **Step 1: Add a minimal hover tooltip**

Show a small map overlay with asset name and type on hover for points, pipelines, and chokepoints.

- [ ] **Step 2: Add a dedicated invisible pipeline hit layer**

Use a thicker transparent line layer for interaction so pipelines are reliably clickable without changing the visible line styling.

- [ ] **Step 3: Add a map-side selection preview card**

Render a persistent, compact card over the map region showing the selected asset’s headline data immediately after selection, without replacing the right-rail context panels.

- [ ] **Step 4: Run the targeted tests**

Run: `npm test -- src/App.integration.test.tsx`
Expected: PASS

## Chunk 4: Verify end-to-end

### Task 4: Full verification

**Files:**
- Test only

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS
