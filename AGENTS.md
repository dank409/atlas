# AGENTS.md — Energy Intelligence Terminal

## Project Identity

This is a **Middle East energy infrastructure intelligence terminal** — not a dashboard, not a monitor, a **terminal**. It combines geospatial infrastructure data, satellite-based disruption monitoring (NASA FIRMS), and public market data into a single professional-grade interface.

The mental model: Bloomberg MAP + FIRMS + JODI + oil analytics — free, open-source, focused on one region with real depth.

**Target user**: An oil trader, analyst, or researcher who needs to understand Middle Eastern energy infrastructure, monitor for disruptions, and contextualize market data — without paying $24K/year for Bloomberg.

**Framing (important)**: This tool does NOT replace Bloomberg. It does something Bloomberg does poorly: combining physical infrastructure awareness with satellite-based anomaly detection in a purpose-built interface. Bloomberg MAP is clunky and general-purpose. FIRMS is raw and noisy. Kpler does vessels, not infrastructure. This tool sits in the intersection. Never refer to this as a "Bloomberg killer" or "Bloomberg alternative" — it is a **specialized open-source energy intelligence layer**.

**Project name**: Working title is **MEIT** (Middle East Intelligence Terminal) or **Atlas** — decide during development. The header should show a short terminal-style identifier (4-5 chars, uppercase).

---

## Architecture & Tech Stack

- **Framework**: React 18+ with TypeScript (strict mode)
- **Map**: Mapbox GL JS (supports satellite tiles, vector layers, custom sources)
  - Free tier: 50K map loads/month — more than sufficient
  - Requires `VITE_MAPBOX_ACCESS_TOKEN` in env
- **Charts**: D3.js for custom financial charts (futures curves, spreads). Recharts acceptable for simpler charts (bar charts, line charts) but D3 preferred for anything that needs to look terminal-grade.
- **Data Grid**: TanStack Table (React Table v8) for all tabular views
- **Styling**: CSS Modules or vanilla CSS. No Tailwind. No component libraries (no MUI, no Chakra). Every component is hand-built to match the design system. This is non-negotiable — the visual identity IS the product.
- **State Management**: React Context + useReducer for global state (active layers, filters, selected asset). No Redux — overkill for this.
- **Data**: Static JSON/GeoJSON files live in `public/data/` and are fetched at runtime from `/data/...` URLs. No backend database. API calls to EIA/FIRMS are client-side fetches with caching.
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
│   └── common/        # Shared primitives (buttons, toggles, badges)
├── hooks/             # Custom hooks (useMapLayers, useFIRMS, useEIAData)
├── services/          # API clients (EIA, FIRMS, CME)
├── types/             # TypeScript interfaces for all data models
├── utils/             # Helpers (formatting, geo calculations, stats)
├── styles/            # Global CSS, design tokens, fonts
└── constants/         # Enums, config, layer definitions

public/
└── data/              # Runtime-served static JSON/GeoJSON datasets (fetched via /data/*)
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

### Map Styling

- Base map: Dark style (Mapbox Dark or custom style with black water, very dark land, `#333` borders, `#555` labels). Satellite mode as toggle.
- Refinery markers: Circles. Fill color by status (green=operational, orange=planned startup, red=unplanned incident, yellow=maintenance, gray=closed). Radius scaled by capacity (sqrt scale, not linear — otherwise the big ones eat the map). Stroke: 1px `#000`.
- Pipeline lines: Differentiated by hydrocarbon type — crude oil = `#FF5722` (deep orange-red), natural gas = `#FF8C00` (amber), NGL = `#FFB74D` (light amber), products = `#FFCC80` (pale amber). Width scaled by capacity. Opacity 0.7 default, 1.0 on hover.
- Fields: Diamond markers or small squares. Color by type: oil-weighted = orange, gas-weighted = blue-tinted amber, mixed = white. Size by reserves/production.
- FIRMS hotspots: When shown, use concentric pulsing circles. Normal = dim gray (almost invisible). Elevated = yellow pulse. Alert = red pulse with larger radius. This distinguishes them from infrastructure markers.
- Chokepoints: Rendered as dashed lines across straits (Hormuz, Bab el-Mandeb) with a label showing estimated daily transit volume.

---

## Data Sources & Refresh Cadence

**CRITICAL RULE**: Every piece of data displayed must show its source and last update timestamp. Never present data without attribution. Never hide staleness. Reference: `docs/DATA_SOURCES.md`

| Data | Source | Refresh | Format | Free? |
|------|--------|---------|--------|-------|
| Refineries, pipelines, fields, LNG, terminals | Global Energy Monitor trackers | Quarterly | CSV/XLSX download → JSON | Yes |
| FIRMS hotspots | NASA FIRMS API (VIIRS/MODIS) | Near real-time (every few hours) | CSV API | Yes |
| Crude oil prices (WTI, Brent) | EIA API v2 | Daily | JSON API | Yes (key required) |
| Petroleum product prices | EIA API v2 | Weekly/Monthly | JSON API | Yes |
| US crude inventories | EIA Weekly Petroleum Status Report | Weekly (Wed 10:30am ET) | JSON API | Yes |
| OPEC production by country | OPEC MOMR / JODI / EIA International | Monthly (lagged 1-2 months) | Curated JSON | Yes |
| Futures settlements (crude) | CME Group daily settlements | Daily (end of day) | Scraped/manual → JSON | Yes (public page) |
| Country profiles | Curated from EIA, OPEC, public sources | Manual updates | JSON | Yes |
| Chokepoint transit volumes | EIA analysis / public estimates | Periodic | Static JSON | Yes |
| Crude grade specifications | Industry reference data | Static | JSON | Yes |
| Outage events | Manually curated from news | As events occur | JSON event log | Yes |
| News headlines | Reuters/EIA RSS feeds | Near real-time | RSS/XML | Yes |

### API Keys Required
- `VITE_MAPBOX_ACCESS_TOKEN` — for map tiles (free tier)
- `VITE_EIA_API_KEY` — for EIA data (free, register at eia.gov)
- `VITE_FIRMS_MAP_KEY` — for NASA FIRMS API (free, register at firms.modaps.eosdis.nasa.gov)

---

## Feature Specification

Full specification in `docs/SPEC.md`. Summary of major features by priority:

### P0 — Core (must have for MVP)
1. Map engine with dark + satellite base layers
2. Infrastructure layers: refineries, pipelines, fields, terminals, ports (from GEM data)
3. Layer toggle controls with filters (country, operator, status, type, capacity)
4. Asset detail cards on click (Bloomberg MAP-style popups)
5. Data table view for every dataset (sortable, filterable, column-reorderable)
6. Design system fully implemented (terminal aesthetic)
7. Header bar with terminal ID, region selector, view toggles
8. Status bar with timestamps and connection status
9. Chokepoint layer (Hormuz, Bab el-Mandeb, Suez) with transit volume labels
10. Situation room / landing view (key indicators at a glance)

### P1 — High Priority
11. FIRMS integration with spatial filtering (geofenced to known assets only)
12. FIRMS confidence thresholding and temporal controls (24H/3D/7D)
13. FIRMS anomaly flagging (detection count anomalies, not FRP sigma — more robust)
14. WTI and Brent daily price charts (from EIA API)
15. WTI-Brent spread chart
16. Futures curve visualization (from CME daily settlements)
17. News feed panel (RSS from Reuters Energy, EIA, OPEC)
18. Country profiles panel (SA, Iran, Iraq, Kuwait, UAE, Qatar, Oman, Bahrain, Yemen)
19. Keyboard shortcuts (M=map, T=table, D=dashboard, 1-6=layer toggles)

### P2 — Important
20. OPEC production by country (historical charts)
21. Crack spread / refining margin approximation
22. US crude inventory chart (weekly EIA data)
23. Outage event log with map overlay
24. Crude grade reference table (API gravity, sulfur, producing countries)
25. Export capability (PNG screenshot of map, CSV of table data)
26. Supply flow visualization (major tanker routes as static lines)

### P3 — Stretch
27. Sanctions reference layer (country-level sanctions status)
28. Geopolitical context sidebar
29. OPEC+ quota compliance tracker
30. Floating storage headline numbers
31. Demand forecast comparison (IEA vs OPEC)

---

## Data Integrity Rules

1. **Never fabricate data.** If a field is unknown, show `--` or `N/A`, never a zero or estimate without labeling it.
2. **Always show source attribution.** Every chart, every table, every stat block must have a small source label (e.g., `Source: EIA | Updated: 2026-04-10`).
3. **Always show timestamps.** Last update for each data source. Use relative time for recent (`7m ago`) and absolute for older (`2026-03-15`).
4. **Distinguish between live, daily, monthly, and static data.** Use the status bar or small badges to indicate cadence.
5. **Never hide data staleness.** If OPEC data is 2 months old, say so. This is a feature, not a bug — it shows the user understands data latency.

---

## Coding Conventions

- **TypeScript strict mode.** No `any` types. Every data model has a proper interface in `src/types/`.
- **Named exports** for components. Default exports only for page-level components.
- **Functional components only.** No class components.
- **CSS Modules** for component styles. Global styles only in `src/styles/`.
- **No inline styles** except for truly dynamic values (e.g., computed widths, positions from data).
- **Descriptive variable names.** `refineryCapacityBpd` not `cap`. `pipelineLengthKm` not `len`.
- **Constants in UPPER_SNAKE_CASE** in `src/constants/`.
- **File naming**: Components in PascalCase (`MapContainer.tsx`), utilities in camelCase (`formatCapacity.ts`), types in PascalCase (`Refinery.ts`).
- **Comment why, not what.** Don't comment obvious code. Do comment business logic, data quirks, and workarounds.
- **No console.log in production code.** Use a logger utility if needed for dev.
- After you finish your work, it will be reviewed in Codex.

---

## FIRMS Implementation Notes

Reference: `docs/SPEC.md` section on FIRMS.

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

---

## Critical UX Principles

1. **Information density over whitespace.** Every pixel should earn its place. If there's empty space, either the layout is wrong or data is missing.
2. **Consistency over creativity.** Every panel, every card, every chart should use the same design tokens. No one-off styling.
3. **Data first, chrome second.** The user came for data. Borders, labels, and controls are infrastructure — necessary but not the point.
4. **Don't animate what doesn't move.** No loading spinners that are actually just decoration. No gratuitous transitions. The only things that should animate are: data refreshing (brief flash), FIRMS alert indicators (pulsing), and map transitions (fly-to on search).
5. **Terminal, not dashboard.** The difference is density and intent. A dashboard summarizes; a terminal lets you interrogate. Every view should support drill-down.

---

## Spec & Reference Docs

- `docs/SPEC.md` — Full feature specification with detailed requirements for every module
- `docs/DATA_SOURCES.md` — Detailed documentation on every data source, API endpoints, schemas, and parsing notes
- `docs/DESIGN_SYSTEM.md` — Complete design token reference, component specs, and visual examples
