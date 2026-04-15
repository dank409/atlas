# Map Line Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MAP workspace feel less rigid by softening pipeline and chokepoint rendering while preserving the terminal visual language.

**Architecture:** Extract the line-layer styling contract out of `MapView.tsx` so it can be tested directly, then reuse that contract in the live map. Add restrained visual polish through layered casing, round joins/caps, clearer hover emphasis, and a slightly calmer toolbar/surface treatment.

**Tech Stack:** React, TypeScript, Mapbox GL JS, Vitest

---

## Chunk 1: Lock the visual contract with tests

### Task 1: Add failing tests for line layer style behavior

**Files:**
- Create: `src/components/map/mapLayerStyles.ts`
- Create: `src/components/map/mapLayerStyles.test.ts`

- [ ] **Step 1: Write failing tests for pipeline style definitions**

Assert that the pipeline rendering contract includes:
- a casing layer
- rounded line joins and line caps
- softer default opacity than the current fully rigid look
- a hover layer for immediate visual response

- [ ] **Step 2: Write failing tests for chokepoint style definitions**

Assert that chokepoints also use rounded joins/caps and keep a dedicated hover/selection treatment.

- [ ] **Step 3: Run the targeted tests**

Run: `npm test -- src/components/map/mapLayerStyles.test.ts`
Expected: FAIL because the extracted style contract does not exist yet.

## Chunk 2: Implement the line polish pass

### Task 2: Reuse the new style contract in the live map

**Files:**
- Modify: `src/components/map/MapView.tsx`
- Modify: `src/components/map/MapView.module.css`
- Create: `src/components/map/mapLayerStyles.ts`

- [ ] **Step 1: Extract reusable pipeline and chokepoint layer definitions**

Move the line-layer styling objects into a dedicated helper module so the contract is explicit and testable.

- [ ] **Step 2: Add softer layered rendering**

For pipelines and chokepoints, add:
- a subtle dark casing underlay
- round joins and caps
- a dedicated hover layer
- slightly calmer default opacity and width balance

- [ ] **Step 3: Add a small map-surface polish pass**

Tighten the toolbar/surface styling enough that the map reads cleaner next to the new line work without changing the overall layout.

- [ ] **Step 4: Run the targeted tests**

Run: `npm test -- src/components/map/mapLayerStyles.test.ts`
Expected: PASS

## Chunk 3: Verify end-to-end

### Task 3: Full verification

**Files:**
- Test only

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS
