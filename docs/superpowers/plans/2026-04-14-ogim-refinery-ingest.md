# OGIM Refinery Ingest Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the refinery seed layer with OGIM-backed refinery publishing while keeping regional map coverage intact where OGIM is incomplete.

**Architecture:** Extend the existing `build_workspace_data.py` pipeline to read refinery rows from the OGIM GeoPackage, normalize them into the runtime refinery contract, and merge a tiny curated supplement only for named Gulf sites still absent from the OGIM slice. Update the TypeScript refinery contract to support unknown status and capacity so the UI remains honest when the source lacks those fields.

**Tech Stack:** Python, SQLite/GeoPackage, TypeScript, Vitest

---

## Chunk 1: Lock the publish contract with tests

### Task 1: Add failing refinery publish coverage

**Files:**
- Modify: `tests/workspaceData.static.test.ts`

- [ ] **Step 1: Write a failing test for refinery publish source**

Assert that `public/data/infrastructure/refineries.geojson` is no longer the old approved seed source.

- [ ] **Step 2: Write a failing test for refinery publish scale**

Assert that the published refinery layer contains materially more than the current 4-row seed and includes honest unknown handling.

- [ ] **Step 3: Run the targeted test**

Run: `npm test -- tests/workspaceData.static.test.ts`
Expected: FAIL because the published refinery file is still the seed output.

## Chunk 2: Implement OGIM refinery publishing

### Task 2: Build and normalize the refinery layer

**Files:**
- Modify: `scripts/build_workspace_data.py`
- Create: `raw/reference/refinery_seed_supplement.json`

- [ ] **Step 1: Add OGIM refinery ingestion**

Read `raw/OGIM/OGIM_v2.7.gpkg`, pull the `Crude_Oil_Refineries` layer, filter to target countries, and normalize refinery rows into runtime feature records.

- [ ] **Step 2: Add a small curated supplement merge**

Merge only refinery rows from the supplement file whose normalized name/country pair is still absent after OGIM ingest.

- [ ] **Step 3: Publish metadata honestly**

Set collection metadata to describe the OGIM source and any supplement note instead of pretending all refinery statuses or capacities are known.

## Chunk 3: Update the app contract for honest unknowns

### Task 3: Allow refinery status and capacity uncertainty without breaking the UI

**Files:**
- Modify: `src/types/refinery.ts`
- Modify: `src/types/infrastructure.ts`
- Modify: `src/utils/infrastructure.ts`
- Modify: `src/components/map/MapView.tsx`
- Modify: `src/components/panels/SelectionPreviewCard.tsx`
- Modify: `src/components/panels/ContextPanelStack.tsx`
- Modify: `src/components/tables/AssetGridTable.tsx`
- Modify: `src/constants/datasetCatalog.ts`

- [ ] **Step 1: Add `unknown` refinery status and optional capacity support**

Keep the UI honest when OGIM does not provide those values.

- [ ] **Step 2: Update refinery legend/rendering**

Add a neutral gray unknown state so the map remains legible.

- [ ] **Step 3: Update refinery value formatting**

Show `--` when capacity is absent instead of manufacturing numbers.

## Chunk 4: Verify end-to-end

### Task 4: Regenerate data and verify

**Files:**
- Test only

- [ ] **Step 1: Rebuild published workspace data**

Run: `npm run build:data`
Expected: PASS

- [ ] **Step 2: Run targeted static data tests**

Run: `npm test -- tests/workspaceData.static.test.ts`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: PASS
