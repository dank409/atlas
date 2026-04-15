# Real Data Ingestion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seeded fields, terminals, and pipelines datasets with real GEM-derived runtime data while keeping the existing map workspace stable until OGIM refineries are available.

**Architecture:** Add a reproducible raw-to-runtime build script that reads the supplied GEM files from `raw/`, normalizes them into the app's GeoJSON contract under `public/data/`, and updates the UI contracts so the newly ingested datasets can be rendered, filtered, and inspected. Keep refineries on the current seed data for now, but remove the "curating" placeholders for datasets we can now publish from source files.

**Tech Stack:** Python 3 with `openpyxl`, React, TypeScript, Vitest, Mapbox GL JS

---

## Chunk 1: Lock output expectations with tests

### Task 1: Add failing data contract tests

**Files:**
- Create: `src/services/workspaceData.static.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that:
- `public/data/infrastructure/fields.geojson` has > 0 features
- `public/data/infrastructure/terminals.geojson` has > 0 features
- `public/data/infrastructure/pipelines.geojson` has materially more than the seed count and contains real GEM metadata
- published pipeline geometries are only `LineString` or `MultiLineString`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/workspaceData.static.test.ts`
Expected: FAIL because fields/terminals are still empty seed files.

## Chunk 2: Build the raw-to-runtime pipeline

### Task 2: Implement the ingestion script

**Files:**
- Create: `scripts/build_workspace_data.py`
- Modify: `package.json`
- Modify: `public/data/infrastructure/fields.geojson`
- Modify: `public/data/infrastructure/pipelines.geojson`
- Modify: `public/data/infrastructure/terminals.geojson`

- [ ] **Step 1: Implement the minimal script**

The script should:
- read GOGET field rows from `raw/Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx`
- read GGIT LNG rows from `raw/GEM-GGIT-LNG-Teminals-2025-09.xlsx`
- read GOIT/GGIT pipeline GeoJSON exports from `raw/.../*.geojson`
- filter to the approved target countries
- normalize into the runtime GeoJSON shape with `_metadata`
- preserve only valid point and line geometries
- keep refineries untouched for now

- [ ] **Step 2: Add an npm entry point**

Add a script such as `build:data` that runs the ingestion script.

- [ ] **Step 3: Generate the runtime files**

Run the script and overwrite the published `fields`, `pipelines`, and `terminals` files in `public/data/infrastructure/`.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `npm test -- src/services/workspaceData.static.test.ts`
Expected: PASS

## Chunk 3: Make the new datasets visible in the workspace

### Task 3: Update UI contracts for fields and terminals

**Files:**
- Modify: `src/types/infrastructure.ts`
- Modify: `src/constants/datasetCatalog.ts`
- Modify: `src/utils/infrastructure.ts`
- Modify: `src/components/panels/MapContentPanel.tsx`
- Modify: `src/components/map/MapView.tsx`

- [ ] **Step 1: Expand the geometry/types contract**

Support real pipeline geometries (`LineString` and `MultiLineString`) and real dataset statuses/options for fields and terminals.

- [ ] **Step 2: Replace the placeholder rails**

Enable field and terminal filters in `MapContentPanel` and update legends/labels so the datasets behave like real workspace layers.

- [ ] **Step 3: Render the new point layers on the map**

Add map sources/layers/selection support for:
- fields
- terminals

- [ ] **Step 4: Keep existing refinery/chokepoint flows stable**

Do not change the refinery seed behavior in this chunk.

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
