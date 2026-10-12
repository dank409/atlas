# Atlas — Middle East Energy Infrastructure Map

An interactive map of oil and gas infrastructure in the Middle East, built from open datasets.

A student learning project.

## What it shows

| View | Contents |
|---|---|
| **Map** | Refineries, oil and gas pipelines, oil and gas fields and LNG terminals on a dark or satellite basemap. Click anything for its details. |
| **Table** | The same assets as sortable rows, one tab per layer, with a text filter. |
| **Reference** | Countries, operators, crude grades and a glossary, cross-linked to each other and to the map. |
| **About** | How to read the map, and the data sources. |

### Reading the map

- **Shape is the kind of asset:** diamond = refinery, triangle = LNG terminal (up for export, down for import),
  dot = field, line = pipeline.
- **Colour is the energy it handles:** crude oil, natural gas / LNG, NGL, or mixed oil and gas.
- **Size is capacity**, for refineries and LNG terminals.
- **Faded** means proposed, under construction, idle or retired.
- **Dashed** pipeline stretches join two places; the route between them is not mapped.

The left rail switches layers and energy types on and off, filters by country, operator or the largest assets
of each layer, and doubles as the key. It applies to both the map and the table.

## Data sources

| Layer | Source | Licence |
|---|---|---|
| Refineries | [EDF Oil and Gas Infrastructure Mapping (OGIM) v2.7](https://zenodo.org/records/15103476) | CC BY 4.0 |
| Pipelines | [Global Energy Monitor](https://globalenergymonitor.org/) Global Oil and Global Gas Infrastructure Trackers; routes from [OpenStreetMap](https://www.openstreetmap.org/copyright) | CC BY 4.0; routes ODbL |
| Fields | Global Energy Monitor Global Oil and Gas Extraction Tracker | CC BY 4.0 |
| LNG terminals | Global Energy Monitor Global Gas Infrastructure Tracker | CC BY 4.0 |

Basemaps: dark map © CARTO and © OpenStreetMap contributors; satellite imagery © Mapbox.

How each file was built and what it was checked against: [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

## Run it locally

You need Node 20+ and a free [Mapbox](https://mapbox.com) public access token.

```bash
npm install
echo 'VITE_MAPBOX_ACCESS_TOKEN=pk.YOUR_TOKEN_HERE' > .env.local
npm run dev
```

`.env.local` is gitignored. Without a token the app still runs, but the map panel shows a message instead of a map.

## Checks

A change is done when all three pass:

```bash
npx tsc -b        # type-check
npx vitest run    # tests
npm run build     # production build
```

## Stack

React 18 and TypeScript (strict), Vite, Mapbox GL JS, TanStack Table, Vitest. Styling is hand-written CSS Modules
with no UI library; the look is defined in [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

```
src/
├── components/
│   ├── common/     DetailCard, the one card for anything inspected in detail
│   ├── layout/     App shell, top nav, left rail, status bar
│   ├── map/        MapView, its layer style definitions and marker icons
│   ├── panels/     Asset card
│   └── tables/     Asset table, crude grade table
├── constants/      Layer catalog
├── hooks/          Data-loading hooks
├── pages/          Table, Reference (plus its detail cards in pages/reference), About
├── services/       Fetch + validate the files in public/data
├── types/          Data model interfaces
└── utils/          Pure helpers: filtering, energy type, the reference index, formatting

public/data/
├── infrastructure/ refineries, pipelines, fields, terminals (GeoJSON)
└── reference/      crude grades, country and operator notes, operator name map (hand-written JSON)

scripts/build_workspace_data.py   Rebuilds public/data/infrastructure from raw GEM / OGIM downloads
```

## Rebuilding the infrastructure data

`scripts/build_workspace_data.py` filters the raw GEM and OGIM downloads to the region and writes the four GeoJSON
files. The raw files are large and are not in the repo; download them from the source links above into `raw/`,
then:

```bash
pip install -r requirements.txt
npm run build:data
```
