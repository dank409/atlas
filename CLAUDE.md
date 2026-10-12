# CLAUDE.md — Atlas

## What this project is

Atlas is a **map of Middle East oil and gas infrastructure built from open datasets**. It is a student learning
project. It visualises where refineries, pipelines, fields and LNG terminals are and what the source data says
about them.

It makes no original claims. Keep it that way.

## Scope — read before adding anything

**In scope**

- The four infrastructure layers (refineries, pipelines, fields, LNG terminals), on the map and in the table.
- Finding and reading that data: layer toggles, energy-type toggles, three filters (country, operator,
  largest per layer), search, the map key, the detail card.
- The Reference tab: countries, operators, crude grades, glossary. Countries and operators are grouped from the
  map data; the grade table, background notes and glossary are short files kept in the repo.
- The About page: one line on what the project is, how to read the map, and the data sources table.

**Out of scope — do not add, and do not re-add**

An earlier version of this project tried to be a trading terminal. All of the following were removed on purpose:

- Prices, spreads, futures curves, market tapes, crack spreads, rig counts, inventories.
- Scenario or disruption models, bypass calculations, "exposure" or "dependency" scores, any derived metric.
- Chokepoint layers, trade flows, war-risk listings.
- Live feeds of any kind: NASA FIRMS, AIS vessel tracking, news, outage events.
- Activity logs, command bars, clocks, session indicators and other terminal chrome.
- Region chips, per-layer filter panels, marker-size and colour-mode controls. They were tried and cut as clutter.
  The left rail's three filters (country, operator, largest per layer) were added at the user's request on
  2026-10-11 and are the whole filter set. Ask before adding another.

If a request seems to need one of these, stop and ask first.

**No claims of our own.** Presenting source values is fine (counts, sorting, a sum of a column). Scores,
estimates, forecasts and modelled numbers are not.

**Justify every element.** Before adding anything to a screen, be able to say what a reader learns from it and
where the data behind it comes from. If the honest answer is "it fills space" or "it looks like a terminal",
leave it out. In particular:

- **Status is not a headline.** Refineries have no status at all, because their source (OGIM) does not publish
  one; never show or invent one. For the GEM layers, status is a plain `Status` field on the card and table and
  the faded-marker cue. Never colour by it, and never filter, group or rank by it: the user has rejected that
  twice (a status filter was built on 2026-10-11 and removed the same day).
- **Encode only what the data supports.** Marker size follows capacity for refineries and LNG terminals, where
  nearly every record has a figure. Fields and pipelines are a fixed size because about half have none, and a
  missing value must not look like a small one.

## Voice: say it once, plainly

The user's rule (2026-10-11): the site must read like a normal, confident website, not one that keeps
apologising for itself. This overrides the urge to caveat.

- **Credit a source in a few words and stop.** `SOURCE: Wikipedia: List of crude oil products`. No "which cites
  no source", no "read on <date>", no "figures are nominal".
- **No disclaimers, caveats or self-description in the UI.** No "static snapshot", "hand-written", "not a
  dataset", "per the source", "known limits", "as of the source each one names", "used for this map". No
  sentence that explains why something is missing or how far to trust the page.
- **Notes state facts about the world**, not about the app or its data. "Its refinery is at Zarqa", not "the
  refinery dataset used here lists one refinery".
- **Honesty is done by what is shown, not by commentary.** If a value has no source, leave the value out; do
  not show it with a warning. A route that is not mapped is drawn dashed; the map key says why in one sentence
  (the user asked for that sentence) and has the switch that hides those stretches.
- Detail about method and limits belongs in `docs/DATA_SOURCES.md`, not on screen.

## Tech stack

- React 18 + TypeScript strict mode, built with Vite.
- Mapbox GL JS for the map. Needs `VITE_MAPBOX_ACCESS_TOKEN` in `.env.local`; without it the map panel shows a
  message. The dark basemap is CARTO Dark Matter, the satellite basemap is Mapbox Satellite.
- TanStack Table for tables.
- CSS Modules, hand-written. No Tailwind, no component libraries.
- React state + `useReducer` in `App.tsx`. No Redux, no router: the active view is a state value, and
  `utils/urlState.ts` mirrors it into the query string (`?view=reference&tab=countries&id=SA`,
  `?asset=<id>`) so links can be shared and back/forward work. Layer and energy toggles are not in the URL.
- Data is static JSON / GeoJSON in `public/data/`, fetched at runtime. No backend, no API keys besides Mapbox.

### Structure

```
src/
├── components/
│   ├── common/     DetailCard (the one card for anything inspected in detail), FilterSelect (the drop-down)
│   ├── layout/     AppShellLayout, TopNav, LeftRail, StatusBar
│   ├── map/        MapView, mapLayerStyles, markerIcons, mapRegion
│   ├── panels/     AssetCard
│   └── tables/     AssetTable, CrudeGradeTable
├── constants/      datasetCatalog
├── hooks/          useMapWorkspaceData, useCrudeGrades
├── pages/          TablePage, ReferencePage, AboutPage
│   └── reference/  CountryDetail, OperatorDetail, GradeDetail, GlossaryPanel, ReferenceTable, referenceParts
├── services/       workspaceData, crudeGrades
├── test/           setup, fixtures
├── types/
└── utils/          infrastructure, assetEnergy, assetFilters, referenceIndex, search, pipelineRoute, urlState,
                    formatters
public/data/        infrastructure/*.geojson, reference/*.json
scripts/            build_workspace_data.py   rebuilds the four layers from raw downloads
                    pipeline_geometry.py      drops stray pieces GEM attaches to some pipelines
                    fetch_osm_pipelines.py    downloads OpenStreetMap's pipelines for the region
                    snap_pipelines_to_osm.py  swaps GEM's straight lines for the real OSM route
                    add_eia_pipelines.py      adds Turkey's transit pipelines from EIA, routed along OSM
```

### How the pieces fit

- `services/workspaceData.ts` loads the four GeoJSON files and the two profile files, drops never-built GEM
  projects (`cancelled`, `shelved`), and builds the layer catalog from each file's `_metadata`.
- `App.tsx` owns all state. One filtered asset list (`visibleAssets` = the three filters, then active layers ×
  active energy types) feeds both the MAP and TABLE views, which share the left rail. The counts beside the
  toggles follow the filters, and each filter's choices are counted within the others. `utils/assetFilters.ts`
  holds the rules: "largest" ranks by each layer's headline figure within what country and operator leave.
- Picking a country or operator moves the map to frame it (`getAssetsBounds`, by its sites rather than its
  pipelines). "SHOW ON MAP" on a country or operator card sets that filter and opens the map.
- `utils/assetEnergy.ts` decides each asset's energy type and holds the colour palette. The map, the left rail
  and the cards all read it, so a colour always means the same thing.
- `components/map/mapLayerStyles.ts` defines every map layer as plain data; `markerIcons.ts` rasterises the
  marker shapes. `MapView.tsx` only wires them to Mapbox.
- `components/map/mapRegion.ts` keeps the map on the Middle East: it opens fitted to the region and
  `getMaxBounds` stops zooming out or panning much past it, at any panel size.
- **Pipeline routes.** GEM gives most pipelines here as a straight line between two end points. The scripts
  replace those with the real route from OpenStreetMap where OSM has a pipeline for the same product between
  the same places (built pipelines only). `utils/pipelineRoute.ts` then splits each pipeline into stretches
  that follow a route (solid) and long straight joins that do not (dashed). Do not smooth, curve or otherwise
  invent a route for the joins.
- `utils/referenceIndex.ts` builds the Reference view from the same assets: it groups them by country and by
  operator, and finds the assets a background note names. Counts in Reference therefore cannot disagree with
  the map.
- The map stays mounted while other views are open (hidden with CSS) so its camera and tiles survive a tab
  switch. It holds camera moves until it is visible again.

## Layout

- **Header**: boxed `ATLAS` mark, a divider, the view tabs, search on the right. Search finds assets,
  countries, operators and crude grades (`utils/search.ts`): an asset opens on the map, the rest in Reference.
  Up and down arrows move through the results; Enter opens the highlighted one.
- **Left rail** (MAP and TABLE only): layer toggles, energy-type toggles, the filters, map key. It doubles
  as the legend, so nothing explaining the map lives anywhere else. The key's dashed row is also a switch that
  hides the unmapped pipeline stretches (a selected pipeline still shows whole). The rail must fit a laptop
  screen without scrolling (about 555px of content); sources are on the About page, not here.
- **Main**: the map or the table, full height. One job per view; the table is not stacked under the map.
- **Right column**: exists only while an asset is selected, and shows its `AssetCard`. No empty-state panels.
- **Reference**: list on the left, the selected entry on the right. No modal overlays anywhere.
- **Status bar**: what the app is, how many assets are showing, and whose data it is.

## Reference view

The Reference view is where everything links together. Keep it that way:

- **Complete.** Every country on the map has an entry, and every operator named in the map data has one.
  `tests/workspaceData.static.test.ts` fails if a country on the map has no background note. A pipeline is
  listed under every country it runs through, not only its first.
- **Records from outside a layer's dataset name their own source.** Six refineries OGIM lacks and Turkey's
  three transit pipelines come from EIA (and Wikipedia for Sitra); each carries `source` and `sourceDate`, which
  its card shows instead of the layer's. Add any further such record the same way, never unsourced.
- **One source for each number.** Counts, capacities and asset lists are computed from the map data. Background
  notes must not restate figures the datasets also give (refining capacity, asset counts), because the two will
  disagree. A country's crude grades come from the grade table, not from a list in its note.
- **Operators are grouped by name only.** `normalizeOperatorName` merges spelling variants mechanically, and
  `operator_aliases.json` merges brand variants of one company (Saudi Aramco / Saudi Arabian Oil). Do not roll
  subsidiaries up into parents: that is a claim about ownership the data does not make.
- **Link in both directions.** Asset card → its country and operator. Country → its grades, operators and
  assets. Operator → its countries and assets. Grade → its country, sibling grades, glossary terms, and the map
  assets its note names. Glossary term → where the term is used. A new entry type should link the same way.
- **Every note and grade has a source.** Each country note, operator note and crude grade has a short `source`
  (publisher and year) shown in its card's footer, and says only what that source supports.
  `docs/DATA_SOURCES.md` records what each was checked against.
- **A crude grade carries only API gravity and sulfur.** Production volumes, pricing references and a
  light/sour class were removed: the first two had no source, and the class was a label of our own. Do not
  re-add them. `tests/workspaceData.static.test.ts` enforces this and the `source` rule.

## Design system

Full reference: `docs/DESIGN_SYSTEM.md`. The non-negotiables:

- **Background** `#000000`. Depth comes from borders and steps (`#0A0A0A`, `#111111`, `#1A1A1A`), never shadows.
- **Accent** amber `#FF8C00`. Text `#E0E0E0` body, `#FFFFFF` emphasis, `#666666` tertiary.
- **Semantic colours** only for meaning: red `#FF1744` error, blue `#2196F3` links.
- **Font** JetBrains Mono everywhere, loaded in `index.html`. No sans-serif.
- **Labels** uppercase, letter-spacing 0.05–0.1em.
- **Borders** 1px. **Border radius** 0.
- **No** box-shadows, gradients, spinners or decorative animation.
- **No native form widgets that bring the browser's look with them.** Drop-downs use
  `components/common/FilterSelect` (themed list, type-to-narrow, keyboard support), never `<select>`.
- **Dense**: 8px standard padding, 12px for panel content, never more than 16px.

Map encoding (the left rail's key must always match it):

| Channel | Means | Values |
|---|---|---|
| Shape | Kind of asset | diamond = refinery, triangle = LNG terminal (up = export, down = import), dot = field, line = pipeline |
| Colour | Energy type | amber `#FF8C00` crude oil, blue `#42A5F5` natural gas / LNG, violet `#B388FF` NGL, grey `#BDBDBD` mixed oil and gas |
| Size | Capacity | refineries and LNG terminals only, square-root scale |
| Opacity | Faded = not operating | never applied to refineries |
| Dash | Route not mapped | a straight join between two places, 30 km or longer |

Selection is a white ring or white line, not amber, because amber is the crude-oil colour.

## Data integrity rules

1. **Never fabricate data.** Unknown values render as `--`, never as zero or a guess.
2. **Always show the source.** Every table and detail card ends with one short source line (publisher and
   date). See "Voice" above for how short.
3. **Attribution comes from the data files.** Source, licence and download date are read from each file's
   `_metadata`; a record that is not from its layer's dataset carries its own `source`.

## Coding conventions

- TypeScript strict. No `any`. Data models live in `src/types/`.
- Functional components, named exports.
- Colocated triplet: `Foo.tsx` + `Foo.module.css` + `Foo.test.tsx` in the same directory. Utilities:
  `foo.ts` + `foo.test.ts`.
- Logic that drives the UI (filtering, formatting, energy type, map style expressions, icon pixels) lives in
  pure functions with tests. Components consume the result.
- No inline styles except truly dynamic values.
- Descriptive names: `refiningCapacityBpd`, not `cap`.
- Comment why, not what. No `console.log`.
- Shared test data builders are in `src/test/fixtures.ts`.
- After you finish your work, it will be reviewed in Codex.

### Definition of done

A change is not done until all three exit clean, in this order:

```bash
npx tsc -b          # full project type-check
npx vitest run      # full test suite
npm run build       # production build
```

- New pure utilities need tests in the same change.
- If you change a component's props, update every test that renders it.
- For anything visible, also run `npm run dev` and look at it, at desktop and phone width.
