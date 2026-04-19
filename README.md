# Atlas — Middle East Energy Intelligence Terminal

A Bloomberg-MAP-meets-FIRMS-meets-quant-disruption-model terminal for
Middle Eastern oil & gas infrastructure. Built as a single-page React
app that runs on free static hosting and refreshes its data from live
upstreams every night via GitHub Actions.

> **The Connecting Thread** — the one question this tool was built to answer:
>
> *Given a disruption at chokepoint or asset X, what breaks in the
> physical supply chain, for how long, which refineries lose
> feedstock, and does the forward curve already know?*

Atlas is not a dashboard. It is a **terminal**: dense, monospace,
zero-radius, keyboard-driven. Every tile on screen either moves
when a user drags the Hormuz disruption slider, or supplies an
input the scenario modeler consumes. Anything else was cut.

---

## What's inside

| Surface | What it does |
|---|---|
| **Map workspace** (`M`) | Mapbox GL dark / satellite / FIRMS basemaps. Layered refineries, pipelines, oil & gas fields, LNG/export terminals, chokepoints. Click any asset → full-detail overlay with drill-down to operator and country profiles. |
| **Asset grid** (`T`) | Dense Bloomberg-DES-style tabular view, one row per asset, 4-column scan-at-a-glance layout. Row click → detail overlay (same component the map uses). |
| **Situation room** (`D`) | Seven-tile dashboard: BYPASS SCENARIO output, ICE Brent FORWARD CURVE, BRENT HISTORICAL with outage event overlay, FIRMS ALERT FEED, CHOKEPOINT WATCH, MARKET BRIEF, FIRMS CONTROLS. Every tile is click-to-expand into a full-screen overlay. |
| **Crude grade reference** (`G`) | Sortable table of regional crude benchmarks with API gravity, sulfur, classification, production, pricing reference. Row click → grade detail overlay. |
| **Command bar** (`/`) | Free-text command line resolves to a view switch, dataset toggle, asset selection, or direct overlay open. Everything has a shortcut. |

---

## The analytical core

The whole project is built around a single pure quantitative module:
[`src/utils/bypassModel.ts`](src/utils/bypassModel.ts). It takes a
Hormuz disruption percentage (0–100%), the curated physical inputs
(Hormuz baseline flow, Saudi East-West pipeline capacity, UAE ADCOP
capacity, OECD inventory baseline, daily draw rate) and outputs:

- `netDailyDeficitMbpd` — how many million barrels per day the
  disruption exceeds total available bypass capacity
- `daysToOperationalMinimum` — days until OECD inventories reach
  their operational minimum floor
- `state` — one of `EQUILIBRIUM`, `DRAWING`, `CRITICAL`, `REPLENISHING`

Every tile in the situation room reads from the same result object.
Dragging the disruption slider in the left-rail SCENARIOS panel
updates the BYPASS SCENARIO tile, the FORWARD CURVE
([`futuresCurveModel.ts`](src/utils/futuresCurveModel.ts) transforms
the model result into a backwardation/contango regime and a 12-month
strip), and the map's refinery feedstock-risk overlay simultaneously
— one state, one render pass, one source of truth.

Pure TypeScript, fully unit-tested, no React dependency. The UI is
the viewport; the math is the instrument.

---

## Data sources — live vs. curated

Atlas reads static JSON files from `public/data/` at runtime. Live
feeds are fetched directly from the browser on page load; everything
else is a curated snapshot checked into the repo.

| File | Mode | Upstream |
|---|---|---|
| `market/crude_prices_30d.json` | **Client-side live** when `VITE_EIA_API_KEY` is set; static snapshot fallback otherwise | EIA v2 `/petroleum/pri/spt/` (Brent + WTI daily spot, 30 days) |
| `market/brent_historical_5y.json` | Static snapshot | Curated from EIA / FRED historical |
| `firms/recent_detections.json` | **Client-side live** when `VITE_FIRMS_MAP_KEY` is set; static snapshot fallback otherwise | NASA FIRMS `/api/area/csv/` with a Middle East bounding box, 72-hour window, VIIRS_SNPP_NRT |
| `market/dme_oman_30d.json` | Curated static | DME Oman settlements (no free JSON endpoint) |
| `market/murban_30d.json` | Curated static | IFAD Murban settlements (vendor-licensed) |
| `market/ice_brent_settlements.json` | Curated static | ICE forward-strip settlement page |
| `market/refinery_margins.json` | Curated static | Platts / OilPrice / NYMEX / ICE public disclosures |
| `rigs/baker_hughes.json` | Curated static | Baker Hughes weekly NA + monthly international |
| `warrisk/jwc_listings.json` | Curated static | Lloyd's JWC public listed-areas document |
| `flows/crude_bilateral_monthly.json` | Curated static | EIA International / OPEC MOMR |
| `events/outages.json` | Curated static | Human-classified event log |
| `infrastructure/*.geojson` | Curated static | Global Energy Monitor (rebuilt via `scripts/build_workspace_data.py`) |
| AIS WATCH (runtime only) | **Live WebSocket** when `VITE_AISSTREAM_API_KEY` is set | AISStream.io free tier, MENA bounding box |

Curated snapshots update when the repo maintainer edits them and
commits — there is intentionally no auto-pipeline for the market
tape JSON. See [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) for
endpoint notes, normalisation rules, and the fallback chain.

**Every surface in the app labels its provenance.** The status bar,
market tape, and overlays show `SOURCE`, `AS OF`, `CADENCE`, and
whether a number is `OBSERVED`, `CURATED`, or `MODELED`. Staleness
is never hidden.

---

## Quick start

**Prerequisites:** Node 20+, a free Mapbox access token (register
at https://mapbox.com, copy the default public token).

```bash
# Clone and install
git clone https://github.com/dank409/atlas.git
cd atlas
npm install

# Create .env.local with your Mapbox token (gitignored)
echo 'VITE_MAPBOX_ACCESS_TOKEN=pk.YOUR_TOKEN_HERE' > .env.local

# Optional: live upstream API keys. The app works without these by
# reading the checked-in static JSON fallbacks; set them to upgrade
# those surfaces to live-fetch mode.
#
#   VITE_EIA_API_KEY       free, https://www.eia.gov/opendata/register.php
#   VITE_FIRMS_MAP_KEY     free, https://firms.modaps.eosdis.nasa.gov/api/map_key/
#   VITE_AISSTREAM_API_KEY free, https://aisstream.io  (AIS WATCH live positions)
echo 'VITE_EIA_API_KEY=your_eia_key' >> .env.local
echo 'VITE_FIRMS_MAP_KEY=your_firms_key' >> .env.local
echo 'VITE_AISSTREAM_API_KEY=your_aisstream_key' >> .env.local

# Run the dev server
npm run dev
```

### Verify everything works (three-gate build)

```bash
npx tsc -b          # full project type-check
npx vitest run      # full test suite (431+)
npm run build       # production Vite build
```

All three gates should exit clean. The repo's policy is that a
change is not complete until these three commands are green.

---

## Architecture

**Stack:** React 18 + TypeScript strict mode, Vite 8, Mapbox GL v3,
TanStack Table v8, Vitest 4. No UI libraries (no MUI, no Chakra, no
Tailwind — CSS Modules only, hand-built to match the terminal
aesthetic). No state management library (React Context +
`useReducer` is enough). No router (view state is a discriminated
union in the top-level reducer, which turns out to be plenty for a
four-view SPA).

```
src/
├── components/
│   ├── map/              Map container, layers, overlays (Mapbox GL)
│   ├── layout/           AppShell, header, status bar, dashboard, panels
│   ├── panels/           Context rail (structural, observed, dependency, exposure)
│   ├── tables/           Asset grid + crude grade table + detail overlays
│   ├── charts/           Forward curve, Brent historical (hand-rolled SVG)
│   ├── market/           Market tape, Brent sparkline
│   ├── news/             News ticker (deferred to P3)
│   ├── common/           Panel primitive (click-to-expand support)
│   └── model/            Scenario slider, bypass control panel
├── hooks/                useFirms, useCrudePrices, useOutageEvents, etc.
├── services/             Loaders for every JSON file plus cadence /
│                          provenance metadata and fallback handling
├── utils/                bypassModel, futuresCurveModel, firms anomaly
│                          scoring — pure functions, unit-tested
├── types/                Every data model as a TypeScript interface
└── styles/               Global tokens, fonts
public/data/              Static JSON / GeoJSON served at /data/*
scripts/
  build_workspace_data.py   Quarterly GEM infrastructure builder
docs/
  DATA_SOURCES.md            Upstream catalog
  DESIGN_SYSTEM.md           Terminal aesthetic tokens
  SPEC.md                    Feature specification
```

### Design rules (non-negotiable, per `docs/DESIGN_SYSTEM.md`)

- Background: `#000000` (true black, not `#1a1a1a`)
- Primary accent: amber `#FF8C00` (Bloomberg DNA)
- Font: `JetBrains Mono`, fallback to `IBM Plex Mono`, then
  `Consolas`. **Monospace everywhere.** No sans-serif, no variable
  fonts.
- Border radius: **`0px`**. Everywhere. Never.
- Shadows: **none**. Depth is communicated through borders and
  background color steps (`#000` → `#0A0A0A` → `#111` → `#1A1A1A`).
- Information density over whitespace. 8px default padding.
- Animations: minimal. 150ms opacity transitions for hover states.
  Nothing else moves unless it's data refreshing or a FIRMS alert
  pulsing.

---

## Environment variables

All variables are optional except `VITE_MAPBOX_ACCESS_TOKEN`.

| Variable | Required? | What it unlocks | Source |
|---|---|---|---|
| `VITE_MAPBOX_ACCESS_TOKEN` | **Yes** — map won't render without it | Mapbox base tiles | https://mapbox.com (free, 50K loads/month) |
| `VITE_EIA_API_KEY` | Optional | Live EIA Brent + WTI spot prices instead of static snapshot | https://www.eia.gov/opendata/register.php |
| `VITE_FIRMS_MAP_KEY` | Optional | Live NASA FIRMS thermal anomaly detections | https://firms.modaps.eosdis.nasa.gov/api/map_key/ |
| `VITE_AISSTREAM_API_KEY` | Optional | Live AIS vessel positions in the AIS WATCH view | https://aisstream.io (free) |

The `VITE_` prefix is required for client-side injection — Vite
only exposes variables starting with that prefix to client code.

---

## Testing

```bash
npx vitest run          # full test suite (431+)
npx vitest run --watch  # re-run on save
```

Tests cover:
- Every pure utility in `src/utils/**` with full branch coverage
  (bypass model, futures curve, FIRMS anomaly scoring, formatters)
- Every service loader with fixture + fallback paths
- Every React component that has meaningful logic (overlays,
  asset grid, dashboard tiles, panel click-to-expand)
- Integration flows in `App.integration.test.tsx` — click grid row
  → inspect overlay → VIEW ON MAP → right-rail selection, click
  COUNTRY cell inside asset overlay → country detail overlay
  pushed onto stack, click BACK → restored

---

## Deploying

**Vercel** (recommended for this project):

1. Import the repo in the Vercel dashboard (auto-detects Vite)
2. Add `VITE_MAPBOX_ACCESS_TOKEN` to Environment Variables
3. (optional) Add `VITE_EIA_API_KEY`, `VITE_FIRMS_MAP_KEY`, and
   `VITE_AISSTREAM_API_KEY` to upgrade those surfaces from static
   snapshots to live fetches
4. Deploy — Vercel picks up the `vercel.json` at the repo root for
   cache-header configuration

The site is a static SPA. To refresh a curated snapshot, edit the
JSON under `public/data/`, commit, and push — Vercel rebuilds
automatically.

---

## Project status

All P0 features from `docs/SPEC.md` are shipped:

- [x] Map engine with dark + satellite + FIRMS basemaps
- [x] Infrastructure layers (refineries, pipelines, fields,
      terminals, chokepoints) from GEM
- [x] Asset detail overlays with drill-down to operator + country
      profiles, full navigation stack with BACK button
- [x] Situation room dashboard with scenario-driven tiles
- [x] Hormuz Bypass Modeler — slider, pure math utility,
      cross-panel visual updates
- [x] FIRMS pipeline with geofencing + confidence normalisation +
      detection-count anomaly scoring
- [x] Crude grade reference table
- [x] Refinery feedstock dependency map (drives scenario highlighting)
- [x] Middle East benchmarks (Brent, DME Oman, Murban)
- [x] Brent historical chart with outage event overlay
- [x] Outage event log
- [x] Asset grid with filter controls
- [x] Layer toggle controls with per-dataset filters

P1 features in progress:

- [x] Country profiles (9 Middle East countries curated)
- [x] Futures curve visualization with ICE observed strip overlay
- [ ] Brent–DME Oman spread historical chart
- [ ] OPEC quota compliance tracker
- [ ] US crude inventory chart with 5y average band
- [ ] Sanctions reference layer
- [ ] Crack spread / refining margin approximation

---

## License

Personal / educational project. Not licensed for production trading use.
Data sources retain their original licenses — see `docs/DATA_SOURCES.md`.
