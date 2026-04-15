# Terminal Dark Basemap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dark map mode render closer to Bloomberg-black instead of Mapbox's default charcoal gray while preserving the existing map workflow and satellite toggle.

**Architecture:** Replace the dark basemap foundation entirely instead of repainting Mapbox's stock dark style. `MapView` should point dark mode at the Carto Dark Matter style directly, with a focused unit test locking the style URL so the visual contract cannot silently drift back.

**Tech Stack:** React, TypeScript, Vitest, Mapbox GL JS

---

## Chunk 1: Dark Basemap Override

### Task 1: Plan the style seam

**Files:**
- Create: `src/components/map/darkBasemapTheme.ts`
- Modify: `src/components/map/MapView.tsx`
- Test: `src/components/map/darkBasemapTheme.test.ts`

- [ ] **Step 1: Write the failing test**

Create a focused test that asserts dark mode uses the Carto Dark Matter style URL directly and no longer relies on post-load repaint logic.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/map/darkBasemapTheme.test.ts`
Expected: FAIL because the helper still points at Mapbox dark mode and still exposes the old override strategy.

- [ ] **Step 3: Write minimal implementation**

Add a helper that exports the Carto dark style URL and removes the old repaint behavior.

- [ ] **Step 4: Wire the helper into the map**

In `MapView.tsx`, use the new dark style URL directly and keep satellite mode untouched.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/map/darkBasemapTheme.test.ts`
Expected: PASS

### Task 2: Verify app behavior

**Files:**
- Modify: `src/components/map/MapView.tsx`
- Test: existing suite only

- [ ] **Step 1: Run targeted regression checks**

Run:
- `npm test`
- `npm run build`

Expected:
- All tests pass
- Build passes
- Dark mode remains flat `mercator`
- Satellite mode still works unchanged
