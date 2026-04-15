# CLAUDE.md — Energy Intelligence Terminal

## Project Identity

This is a **Middle East energy infrastructure intelligence terminal** — not a dashboard, not a monitor, a **terminal**. It combines geospatial infrastructure data, satellite-based disruption monitoring (NASA FIRMS), and public market data into a single professional-grade interface.

The mental model: Bloomberg MAP + FIRMS + JODI + oil analytics — free, open-source, focused on one region with real depth.

**Target user**: An oil trader, analyst, or researcher who needs to understand Middle Eastern energy infrastructure, monitor for disruptions, and contextualize market data — without paying $24K/year for Bloomberg.

**Framing (important)**: This tool does NOT replace Bloomberg. It does something Bloomberg does poorly: combining physical infrastructure awareness with satellite-based anomaly detection **and quantitative disruption modeling** in a purpose-built interface. Bloomberg MAP is clunky and general-purpose. FIRMS is raw and noisy. Kpler does vessels, not infrastructure. This tool sits in the intersection. Never refer to this as a "Bloomberg killer" or "Bloomberg alternative" — it is a **specialized open-source energy intelligence layer built around a physical commodities trader's mental model**.

**Project name**: Working title is **MEIT** (Middle East Intelligence Terminal) or **Atlas** — decide during development. The header should show a short terminal-style identifier (4-5 chars, uppercase).

---

## The Connecting Thread (North Star)

Atlas exists to answer one analytical question, in many forms:

> **Given a disruption at chokepoint or asset X, what breaks in the physical supply chain, for how long, which refineries lose feedstock, and does the forward curve already know?**

Everything else is chrome. This is the single principle that decides what gets built, what gets deprioritized, and what gets cut entirely.

### The Stress Test

Before proposing, scoping, or building any feature, run it against this question:

> **"If the user moved a hypothetical Hormuz disruption slider from 0% to 60%, would this feature's output change?"**

- **Yes** → the feature participates in the analytical core. Build it.
- **No, but it supplies an input the modeler consumes** (e.g., chokepoint transit volumes, refinery feedstock grades, bypass pipeline capacities, OECD inventory baselines) → build it, because it feeds the core.
- **No, and it doesn't feed the core** (e.g., generic news scroll, decorative tickers, a second US benchmark when DME Oman is missing) → it's chrome. Demote to P3 or drop entirely.

Apply this test to every PR. It is the only priority rule that matters.

---

## Development Philosophy

### The Vertical Slice Mandate

**Build one complete, end-to-end analytical feature before expanding horizontally.**

The first vertical slice is the **Hormuz Bypass Modeler**: a UI disruption slider wired to a deterministic math module wired to terminal-wide visual updates (map highlighting, refinery feedstock callouts, chokepoint panel, inventory countdown). The slider, the math, and the visuals must work together perfectly before a single new unrelated data layer, news feed, or generic chart is added.

Concretely this means:

1. **UI layer** — slider in the situation room, scoped to a chokepoint (start with Hormuz), bound to a `disruptionPct` state value in `[0, 100]`.
2. **Math layer** — a pure `src/utils/bypassModel.ts` module: inputs are `chokepointTransitMbpd`, `disruptionPct`, available bypass capacities (Saudi East-West ~5 mbpd, UAE ADCOP ~1.5 mbpd), OECD inventory baseline, daily draw rate. Outputs: `grossDisruptedMbpd`, `bypassUtilisationPctBySegment`, `netUnresolvableDeficitMbpd`, `daysToOecdOperationalMinimum`. Fully unit-tested.
3. **Visual layer** — the slider moving must update: the chokepoint panel (red flag on Hormuz), the East-West and ADCOP pipelines (utilisation bar), a refinery overlay highlighting facilities that depend on the disrupted grade mix, and a countdown tile showing days-to-minimum. Every panel pulls from the same model output, not from independent recomputations.

**No horizontal expansion until that slice is complete.** Do not map another random pipeline, add another generic EIA time series, or build a news feed while the modeler is unfinished. We are optimizing for **domain-specific mathematical modeling over software bloat**.

### Why this matters

A terminal with 30 features and no analytical spine is a data browser. A terminal with *one* working quantitative scenario model — even if nothing else is there yet — is an instrument. Atlas is being built as the second thing.

---

## Architecture & Tech Stack

- **Framework**: React 18+ with TypeScript (strict mode)
- **Map**: Mapbox GL JS (supports satellite tiles, vector layers, custom sources)
  - Free tier: 50K map loads/month — more than sufficient
  - Requires `VITE_MAPBOX_ACCESS_TOKEN` in env
- **Charts**: D3.js for custom financial charts (futures curves, spreads). Recharts acceptable for simpler charts (bar charts, line charts) but D3 preferred for anything that needs to look terminal-grade.
- **Data Grid**: TanStack Table (React Table v8) for all tabular views
- **Styling**: CSS Modules or vanilla CSS. No Tailwind. No component libraries (no MUI, no Chakra). Every component is hand-built to match the design system. This is non-negotiable — the visual identity IS the product.
- **State Management**: React Context + useReducer for global state (active layers, filters, selected asset, **bypass model inputs**). No Redux — overkill for this.
- **Data**: Static JSON/GeoJSON files live in `public/data/` and are fetched at runtime from `/data/...` URLs. No backend database. API calls to EIA/FIRMS are client-side fetches with caching and static-snapshot fallback (see Data Integrity Rules).
- **Build**: Vite
- **Deployment**: Static site (Vercel, Netlify, or GitHub Pages)

### Project Structure
```
src/
├── components/
│   ├── map/           # Map container, layers, controls, popups
│   ├── panels/        # Sidebar panels, filter panels, detail cards
│   ├── charts/        # All chart components (price, futures, production)
│   ├── tables/        # Data table views
│   ├── layout/        # Shell, header, status bar, panel manager
│   ├── market/        # Market data surfaces (tape, sparkline, brief)
│   ├── model/         # Scenario modeling UI (bypass modeler, slider, outputs)
│   └── common/        # Shared primitives (buttons, toggles, badges)
├── hooks/             # Custom hooks (useMapLayers, useFIRMS, useEIAData, useCrudePrices, useBypassModel)
├── services/          # API clients with static-snapshot fallback (EIA, FIRMS, CME)
├── types/             # TypeScript interfaces for all data models
├── utils/             # Helpers (formatting, geo calculations, stats, bypassModel)
├── styles/            # Global CSS, design tokens, fonts
└── constants/         # Enums, config, layer definitions, bypass capacity constants

public/
└── data/              # Runtime-served static JSON/GeoJSON datasets (fetched via /data/*)
                       # Includes static snapshots used as API fallbacks
```

---

## Design System — READ THIS CAREFULLY

The design system is the single most important thing to get right. A wrong color, a rounded corner, a soft shadow — any of these immediately breaks the terminal aesthetic and makes it look like a student project. Reference: `docs/DESIGN_SYSTEM.md`

### The Non-Negotiables

- **Background**: `#000000` (true black). Not `#1a1a1a`, not `#111`. Black.
- **Primary accent**: Amber/orange (`#FF8C00` base, `#FFA500` for highlights, `#CC7000` for muted). This is the Bloomberg DNA.
- **Text**: `#E0E0E0` for primary body text, `#FFFFFF` for emphasis/headers, `#666666` for disabled/tertiary.
- **Semantic colors**: `#00C853` (green) for positive/operational/up. `#FF1744` (red) for negative/alert/down. `#FFD600` (yellow) for warning/elevated/caution. `#2196F3` (blue) for informational/links. These are used ONLY for semantic meaning, never decoratively.
- **Font**: `JetBrains Mono` (primary), fallback to `IBM Plex Mono`, then `Consolas`, then `monospace`. **Monospace everywhere. No exceptions.** No sans-serif, no serif, no variable fonts. Headers, labels, body text, tooltips — all monospace.
- **Headers/labels**: UPPERCASE with letter-spacing: 0.05-0.1em. Font-weight 600-700.
- **Borders**: 1px solid `#333333` for subtle dividers. 1px solid `#FF8C00` for active/selected elements. Never thicker than 1px except for the top accent line on the header (2px amber).
- **Border radius**: `0px`. Everywhere. No rounded corners. No `border-radius: 4px`. No `border-radius: 2px`. Zero. This is a terminal, not a SaaS product.
- **Shadows**: None. No `box-shadow`. No drop shadows. No glow effects. Depth is communicated through borders and background color steps (`#000` → `#0A0A0A` → `#111111` → `#1A1A1A`).
- **Padding**: Dense. 8px is standard padding for most elements. 12px for panel content. 4px for compact table cells. Never more than 16px for anything except the main layout gutters.
- **Animations**: Minimal. No spring animations, no bounces, no slides. Opacity transitions (150ms) for hover states. That's it.

### Component Patterns

**Panel**: Black background, 1px `#333` border, uppercase amber label at top, 8px internal padding. Collapsible with a simple `▸`/`▾` toggle.

**Data cell / stat block**: Label in `#666` uppercase 10px, value in `#FFF` 14-16px, change indicator in green/red 12px with `+`/`-` prefix and `▲`/`▼` arrows.

**Button**: Background `transparent`, border 1px `#555`, text `#CCC`, uppercase 11px. Hover: border `#FF8C00`, text `#FF8C00`. Active/selected: background `#FF8C00`, text `#000`. Never filled/solid in default state.

**Toggle / Tab**: Inactive = text only in `#666`. Active = text `#FF8C00` with 2px bottom border amber. No background change.

**Popup / Detail Card**: Background `#111`, border 1px `#333`, max-width 360px. Header in amber uppercase. Data rows as `label: value` pairs with label in `#888` and value in `#FFF`. Close button = `×` in top right.

**Status bar** (bottom of viewport): Height 28px, background `#0A0A0A`, border-top 1px `#222`. Contains: connection status dot (green pulsing = live), last update timestamp, region label, data source status. Monospace 11px. Left-aligned status items separated by `·` or `|`.

**Header bar** (top): Height 40px, background `#0A0A0A`, 2px amber top border. Contains: terminal identifier (e.g., `ATLAS`), region selector, time window toggles, view mode switches (Map | Table | Dashboard). Dense, compact, no wasted space.

**Scenario slider** (new, for the bypass modeler): Full-width horizontal range input, track in `#222`, filled segment in amber `#FF8C00`, thumb as a 1px square with no radius, current value rendered above the thumb as `DISRUPTION: 60%` in monospace amber. No rounded caps, no tooltips, no bounce — value updates live on drag.

### Map Styling

- Base map: Dark style (Mapbox Dark or custom style with black water, very dark land, `#333` borders, `#555` labels). Satellite mode as toggle.
- Refinery markers: Circles. Fill color by status (green=operational, orange=planned startup, red=unplanned incident, yellow=maintenance, gray=closed). Radius scaled by capacity (sqrt scale, not linear — otherwise the big ones eat the map). Stroke: 1px `#000`. **When the bypass modeler is active, refineries whose feedstock depends on the disrupted chokepoint get a 1px amber outline.**
- Pipeline lines: Differentiated by hydrocarbon type — crude oil = `#FF5722` (deep orange-red), natural gas = `#FF8C00` (amber), NGL = `#FFB74D` (light amber), products = `#FFCC80` (pale amber). Width scaled by capacity. Opacity 0.7 default, 1.0 on hover. **Bypass pipelines (East-West, ADCOP) render a utilisation bar along their length when the modeler is active.**
- Fields: Diamond markers or small squares. Color by type: oil-weighted = orange, gas-weighted = blue-tinted amber, mixed = white. Size by reserves/production.
- FIRMS hotspots: When shown, use concentric pulsing circles. Normal = dim gray (almost invisible). Elevated = yellow pulse. Alert = red pulse with larger radius. This distinguishes them from infrastructure markers.
- Chokepoints: Rendered as dashed lines across straits (Hormuz, Bab el-Mandeb) with a label showing estimated daily transit volume. **The disrupted chokepoint shows a red-tinted overlay proportional to the slider value.**

---

## Data Sources & Refresh Cadence

**CRITICAL RULE**: Every piece of data displayed must show its source and last update timestamp. Never present data without attribution. Never hide staleness. Reference: `docs/DATA_SOURCES.md`

| Data | Source | Refresh | Format | Free? |
|------|--------|---------|--------|-------|
| Refineries, pipelines, fields, LNG, terminals | Global Energy Monitor trackers | Quarterly | CSV/XLSX download → JSON | Yes |
| FIRMS hotspots | NASA FIRMS API (VIIRS/MODIS) | Near real-time (every few hours) | CSV API | Yes |
| Crude oil prices (Brent, DME Oman, Murban) | EIA API v2 + DME settlements | Daily | JSON API / curated JSON | Yes (EIA key for live) |
| Petroleum product prices | EIA API v2 | Weekly/Monthly | JSON API | Yes |
| US crude inventories | EIA Weekly Petroleum Status Report | Weekly (Wed 10:30am ET) | JSON API | Yes |
| OPEC production by country | OPEC MOMR / JODI / EIA International | Monthly (lagged 1-2 months) | Curated JSON | Yes |
| Futures settlements (Brent, DME Oman) | ICE + DME daily settlements | Daily (end of day) | Scraped/manual → JSON | Yes (public page) |
| Country profiles | Curated from EIA, OPEC, public sources | Manual updates | JSON | Yes |
| Chokepoint transit volumes | EIA analysis / public estimates | Periodic | Static JSON | Yes |
| **Bypass capacity constants (East-West, ADCOP)** | **EIA / operator disclosures** | **Static (updated on capacity changes)** | **Static JSON + constants** | **Yes** |
| Crude grade specifications | Industry reference data | Static | JSON | Yes |
| **Refinery feedstock configurations** | **Curated from operator disclosures and trade press** | **Manual updates** | **Static JSON** | **Yes** |
| OECD inventory baselines | IEA monthly report | Monthly | Curated JSON | Yes |
| Outage events | Manually curated from news | As events occur | JSON event log | Yes |
| News headlines | Reuters/EIA RSS feeds | Near real-time | RSS/XML | Yes |

### Environment Variables

Mapbox is the only *hard* dependency — no free fallback exists for the tile renderer. EIA and FIRMS are **soft dependencies**: when their keys are absent (or the API fails), the corresponding service must fall back to a static JSON snapshot checked into `public/data/`, and the UI must visibly label the data as `STATIC_SNAPSHOT` (see Data Integrity Rules #6).

| Variable | Required? | Behavior when missing |
|----------|-----------|----------------------|
| `VITE_MAPBOX_ACCESS_TOKEN` | **Hard required** | Map does not render. Register free at mapbox.com (50K loads/month). |
| `VITE_EIA_API_KEY` | Soft — live mode only | `eiaPrices` service falls back to `/data/market/crude_prices_30d.json`, mode = `STATIC_SNAPSHOT`. Register free at eia.gov. |
| `VITE_FIRMS_MAP_KEY` | Soft — live mode only | FIRMS service falls back to a static curated detections JSON, mode = `STATIC_SNAPSHOT`. Register free at firms.modaps.eosdis.nasa.gov. |

**Reference implementation** for the fallback pattern: `src/services/eiaPrices.ts`. Every new external data source must follow the same shape.

---

## Feature Specification

Full specification in `docs/SPEC.md`. The priority tiers below have been **re-sequenced around the Connecting Thread stress test**, not left in spec-document order. Any feature that doesn't change when the user moves a hypothetical disruption slider — and doesn't supply an input to something that does — has been demoted or dropped.

### P0 — The Analytical Core (must have for a minimum viable terminal)

These items are non-negotiable. They constitute the first **vertical slice** of Atlas. Nothing in P1+ gets built until every P0 item is shipped and tested.

1. Map engine with dark + satellite base layers
2. Infrastructure layers: refineries, pipelines, fields, terminals, ports (from GEM data)
3. Chokepoint layer (Hormuz, Bab el-Mandeb, Suez, Turkish Straits) with transit volume labels
4. Asset detail cards on click (Bloomberg MAP-style popups in the right sidebar)
5. Design system fully implemented (terminal aesthetic, already in place)
6. Header bar with terminal ID, region selector, view toggles
7. Status bar with timestamps, connection status, and live `EIA: BRENT $xx.xx · <date>` tile
8. Situation room / landing view (key indicators at a glance)
9. **Hormuz Bypass Modeler — the vertical slice.** Disruption slider (0–100%), pure `bypassModel.ts` utility, and terminal-wide visual updates (refinery feedstock highlighting, bypass pipeline utilisation bars, chokepoint red overlay, days-to-OECD-minimum countdown). See Development Philosophy.
10. **FIRMS integration done right.** Geofence every infrastructure asset, only surface detections within radius, confidence threshold ≥80 default, detection-count anomaly flagging (not FRP sigma), visual hierarchy from dim dot → yellow → red pulse, structured alert feed. See FIRMS Implementation Notes.
11. **Crude grade reference table** (API gravity, sulfur, producing countries) — required as an input to the bypass modeler's feedstock-dependency highlighting.
12. **Refinery feedstock dependency map** — which refineries depend on which crude grades, curated JSON. Directly consumed by the bypass modeler to highlight affected facilities.
13. **Middle East benchmark prices** — Brent, DME Oman, Murban. DME Oman and Murban are the primary Gulf-crude benchmarks and matter more for this terminal than additional US benchmarks. EIA live + static fallback.
14. **Brent price chart with outage-event overlay** — historical Brent line chart with vertical rules at outage event dates. Promotes the existing sparkline to a real D3 chart and ties the market to the physical event log.
15. **Outage event log** — JSON event structure with severity classification and map overlay. Provides the time dimension and the vertical-rule dates for #14.
16. Data table view for every dataset (sortable, filterable, column-reorderable)
17. Layer toggle controls with filters (country, operator, status, type, capacity)
18. Keyboard shortcuts (M=map, T=table, D=dashboard, 1–6=layer toggles, `?`=help, `/`=command bar, `]`=right rail)

### P1 — High Priority (build after the P0 vertical slice is complete)

19. Country profiles panel — Saudi Arabia first, done properly with Hormuz dependency %, bypass capacity, crude grades, terminal locations. Then Iran, Iraq, Kuwait, UAE, Qatar, Oman, Bahrain, Yemen. Each profile must feed the bypass modeler with country-level inputs.
20. Futures curve visualization — ICE Brent and DME Oman forward curves. Directly tests whether the paper market agrees with the bypass modeler's physical math. D3.
21. Brent–DME Oman spread chart — the east-of-Suez arbitrage signal.
22. OPEC quota compliance tracker — production vs. quota by member, monthly from OPEC MOMR. Shows who's cheating on cuts; informs bypass assumptions.
23. US crude inventory chart — weekly EIA data with 5-year average band overlay. Feeds the OECD-minimum countdown.
24. Sanctions reference layer — Iran, Russia, Venezuela country overlay with sidebar explanation of available-supply implications. Directly affects which bypass grades are actually reachable by which refineries.
25. Crack spread / refining margin approximation (3-2-1) — connects grade-quality analysis to refinery economics.

### P2 — Important (context and extension, after P1)

26. OPEC production by country — historical charts.
27. Supply flow visualization — major tanker routes as static lines (Persian Gulf → Asia, Red Sea, Cape of Good Hope).
28. Freight rate panel — Baltic Exchange TD3C (AG → China) and TD20 (AG → Europe). Contextualises the arbitrage the bypass modeler implies.
29. Export capability (PNG screenshot of map, CSV of table data).
30. Storage utilisation estimates — Cushing from EIA weekly, ARA from public sources.

### P3 — Stretch / Chrome (only if everything above is done)

31. Vessel tracking via AIS (free tier from AISHub) — live layer of tanker positions. Big rabbit hole, attempt only if P0–P2 are all green.
32. News feed — RSS from Reuters Energy, EIA, OPEC. Low analytical signal; kept because it makes the shell feel live.
33. Geopolitical context sidebar.
34. Demand forecast comparison (IEA vs OPEC).
35. Floating storage headline numbers.

### Features removed from the spec

The following appeared in earlier drafts and have been **cut** because they fail the Connecting Thread stress test without adding anything the modeler consumes:

- Standalone WTI daily chart as a first-class panel. (WTI remains available via EIA but is not a headline benchmark for a Middle East terminal. Brent + DME Oman + Murban cover the region.)
- Generic "key indicators" decorative tiles that don't read from the model or from real data feeds.

If a future idea doesn't pass the stress test, it goes here, not into P3.

---

## Data Integrity Rules

1. **Never fabricate data.** If a field is unknown, show `--` or `N/A`, never a zero or estimate without labeling it.
2. **Always show source attribution.** Every chart, every table, every stat block must have a small source label (e.g., `Source: EIA | Updated: 2026-04-10`).
3. **Always show timestamps.** Last update for each data source. Use relative time for recent (`7m ago`) and absolute for older (`2026-03-15`).
4. **Distinguish between live, daily, monthly, and static data.** Use the status bar or small badges to indicate cadence.
5. **Never hide data staleness.** If OPEC data is 2 months old, say so. This is a feature, not a bug — it shows the user understands data latency.
6. **Live-or-static fallback is mandatory for every external data source.** Every service must degrade to a static JSON snapshot in `public/data/` when its API key is missing or the request fails. The UI must surface the mode (`LIVE` / `STATIC_SNAPSHOT`) visibly — in the market tape, in the panel badge, or in the status bar — so the user always knows whether they are looking at live or frozen data. Reference implementation: `src/services/eiaPrices.ts` + `src/hooks/useCrudePrices.ts` + `src/components/market/MarketTape.tsx`. Follow the same shape for FIRMS, OPEC production, futures settlements, and any future feed.
7. **Model outputs must cite their inputs.** When the bypass modeler shows `NET DEFICIT: 4.2 MBPD`, a small source line must list the constants used (`Hormuz baseline: 20.5 MBPD · East-West cap: 5.0 MBPD · ADCOP cap: 1.5 MBPD · source: EIA 2024`). Never treat model outputs as gospel; always expose the assumptions.

---

## Coding Conventions

- **TypeScript strict mode.** No `any` types. Every data model has a proper interface in `src/types/`.
- **Named exports** for components. Default exports only for page-level components.
- **Functional components only.** No class components.
- **CSS Modules** for component styles. Global styles only in `src/styles/`.
- **No inline styles** except for truly dynamic values (e.g., computed widths, positions from data).
- **Descriptive variable names.** `refineryCapacityBpd` not `cap`. `pipelineLengthKm` not `len`. `netUnresolvableDeficitMbpd` not `deficit`.
- **Constants in UPPER_SNAKE_CASE** in `src/constants/`. Bypass capacities, OECD minimums, and other model constants live here with inline source citations.
- **File naming**: Components in PascalCase (`MapContainer.tsx`), utilities in camelCase (`formatCapacity.ts`, `bypassModel.ts`), types in PascalCase (`Refinery.ts`).
- **Colocated file triplet.** Every component lives as `Foo.tsx` + `Foo.module.css` + `Foo.test.tsx` in the *same* directory. No `__tests__/` folders. No separate style directories. Utilities follow the same pattern: `bypassModel.ts` + `bypassModel.test.ts`.
- **Pure model utilities are mandatory.** Any math that drives UI (bypass model, anomaly scoring, spread calculations) lives as a pure function in `src/utils/` with full unit test coverage. React components consume the output; they never compute it inline.
- **Comment why, not what.** Don't comment obvious code. Do comment business logic, data quirks, model assumptions, and workarounds.
- **No console.log in production code.** Use a logger utility if needed for dev.
- After you finish your work, it will be reviewed in Codex.

### Verification & Definition of Done

A change is **not done** until all three of the following commands exit clean, in this order:

```bash
npx tsc -b          # full project type-check (catches test-file errors the IDE may hide)
npx vitest run      # full test suite, including colocated *.test.ts(x) files
npm run build       # production Vite build
```

Rules:

1. **LSP diagnostics can go stale mid-session.** Trust the three commands above, not the IDE red squiggles. If `tsc -b` is clean and the IDE still shows errors, the IDE is lying — move on.
2. **Do not claim completion from partial runs.** "Tests pass" means `vitest run`, not `vitest` (watch mode) or a single-file run.
3. **New pure utilities require tests.** If you add `bypassModel.ts`, you add `bypassModel.test.ts` in the same commit. No exceptions for math-bearing code.
4. **Prop-shape changes require test updates.** If you add a required prop to a component, update every existing test that renders that component in the same commit. Treat the compile error as the checklist.
5. **Never commit a red build.** If the three commands don't pass, the work isn't finished — don't hand it off to review saying "mostly done."

---

## FIRMS Implementation Notes

Reference: `docs/SPEC.md` section on FIRMS. **This is a P0 feature, not P1.**

### What worked in the old project
- Basic FIRMS API integration
- Plotting hotspots on map
- Time window filtering (24H/3D/7D)

### What didn't work
- Every single hotspot was shown regardless of proximity to infrastructure → noise drowns signal
- No way to distinguish routine gas flares from actual incidents
- Hotspots in remote desert (no infrastructure nearby) were shown, creating false sense of activity
- FRP-based sigma analysis was attempted but noisy due to small sample sizes per facility and atmospheric variability

### How to do it right this time
1. **Geofencing**: Define a bounding circle (2-5km radius, scaled by facility footprint) around every known infrastructure asset. Only display FIRMS detections that fall within a geofence. This is the single most impactful filter.
2. **Confidence threshold**: Normalize confidence to a 0-100 score and default to `>= 80` for display (VIIRS mapping: `low`=40, `nominal`=75, `high`=95; MODIS uses its numeric confidence directly). Let the user adjust the threshold via slider.
3. **Detection count anomaly**: Instead of FRP sigma analysis, flag when the *number of detections* at a facility in the current time window is significantly higher than the historical average for that facility. This is more robust than FRP analysis.
4. **Visual hierarchy**: Normal detections at geofenced facilities = small dim dot (acknowledging presence, not alarming). Elevated count = yellow indicator. Anomalous spike = red pulsing indicator.
5. **Alert feed**: Structured text alerts for any facility showing anomalous detection patterns. Format: `[TIMESTAMP] [SEVERITY] [FACILITY_NAME] — [COUNT] detections in [WINDOW], [X]x above [PERIOD] average — Facility: [OWNER], [CAPACITY] bpd`
6. **Static-snapshot fallback** (per Data Integrity Rule #6). When `VITE_FIRMS_MAP_KEY` is missing or the API fails, load a curated `/data/firms/recent_detections.json` snapshot and label the panel `STATIC_SNAPSHOT`.

### Geofence Data
The geofence radii should be stored alongside infrastructure data. Rough guidelines:
- Major refineries (>200k bpd): 5km radius
- Medium refineries (50-200k bpd): 3km radius
- Small facilities, terminals, gas plants: 2km radius
- Pipeline segments: 1km buffer along route (if route geometry available)
- Fields: 3-5km depending on known field extent

---

## Map Interaction Patterns

- **Default view**: Centered on Persian Gulf, zoom level showing full Middle East (lat ~27, lon ~50, zoom ~5)
- **Click on asset**: Opens detail card in right sidebar. Does NOT open a popup bubble over the map (those obstruct the view). The sidebar card shows all metadata.
- **Hover on asset**: Shows a minimal tooltip with name and type only. No delay on show, 100ms delay on hide.
- **Click on empty space**: Closes any open detail card.
- **Layer controls**: Left sidebar, collapsible. Each layer has: visibility toggle, expand arrow for filters. When expanded, shows filter dropdowns (country, operator, status, etc.).
- **Zoom**: Standard scroll zoom. Cluster markers at low zoom levels, expand at high zoom. Pipelines simplify geometry at low zoom.
- **Search**: A search bar that fuzzy-matches asset names, pipeline names, country names. Selecting a result flies the map to that asset and opens its detail card.
- **Scenario-mode visual state**: When the bypass modeler slider is non-zero, the map enters a "scenario" visual mode — affected refineries gain amber outlines, bypass pipelines gain utilisation bars, and the disrupted chokepoint gets a red overlay. This is the single most important cross-panel linkage in the app.

---

## Critical UX Principles

1. **Information density over whitespace.** Every pixel should earn its place. If there's empty space, either the layout is wrong or data is missing.
2. **Consistency over creativity.** Every panel, every card, every chart should use the same design tokens. No one-off styling.
3. **Data first, chrome second.** The user came for data. Borders, labels, and controls are infrastructure — necessary but not the point.
4. **Don't animate what doesn't move.** No loading spinners that are actually just decoration. No gratuitous transitions. The only things that should animate are: data refreshing (brief flash), FIRMS alert indicators (pulsing), and map transitions (fly-to on search).
5. **Terminal, not dashboard.** The difference is density and intent. A dashboard summarizes; a terminal lets you interrogate. Every view should support drill-down.
6. **Every action leaves a trace.** Every user action — command-bar submission, view switch, dataset toggle, slider change, asset selection — must append a timestamped entry to the activity log. The log is the session trace; silent actions break the terminal metaphor.

### Interaction Primitives (what's already built)

These exist in the codebase and new features must integrate with them. Do not re-invent.

- **Command bar** (`src/utils/commandBar.ts`, header search input). Press `/` to focus. Resolves free-text queries to a view switch, dataset toggle, or asset selection. Failed lookups append `COMMAND NOT FOUND: <query>` to the activity log — never silent.
- **Activity log** (`src/types/activity.ts`, appended via `appendActivity()` in `App.tsx`, displayed in the situation-room dashboard). Every action → one entry, top-of-stack, capped at 14 entries. New features must call `appendActivity()` for any user-triggered state change.
- **Shortcut overlay** (`src/components/layout/ShortcutOverlay.tsx`). `?` toggles it. When adding a new keyboard shortcut, register it in the overlay and in the `KEYBOARD_SHORTCUT_*` tables in `App.tsx`.
- **Ticking clock** (in `HeaderBar.tsx`, 1-second interval). The header is always live even when data is static. New time-sensitive surfaces should match its 1-second cadence where appropriate.
- **Market tape** (`src/components/market/MarketTape.tsx`, wired via `useCrudePrices`). 32px strip between header and sidebars. Shows Brent, WTI, spread, and `LIVE`/`STATIC` mode badge. Reference pattern for surfacing any live-or-static external data.

---

## Spec & Reference Docs

- `docs/SPEC.md` — Full feature specification with detailed requirements for every module
- `docs/DATA_SOURCES.md` — Detailed documentation on every data source, API endpoints, schemas, and parsing notes
- `docs/DESIGN_SYSTEM.md` — Complete design token reference, component specs, and visual examples
