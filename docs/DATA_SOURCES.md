# Data Sources — Atlas

Everything the app shows is a static file in `public/data/`. Nothing is fetched from a third-party API at
runtime except map tiles.

## Infrastructure layers

Each file is a GeoJSON `FeatureCollection` with a `_metadata` block (`source`, `downloadDate`, `recordCount`,
`license`, `sourceUrl`). The app reads attribution from that block, so update it whenever a file is rebuilt.

| File | Source | Downloaded | Records in file | Licence |
|---|---|---|---|---|
| `infrastructure/refineries.geojson` | EDF Oil and Gas Infrastructure Mapping (OGIM) v2.7, plus six sites from EIA and Wikipedia | 2025-03-28 | 57 | CC BY 4.0 |
| `infrastructure/pipelines.geojson` | Global Energy Monitor: Global Oil Infrastructure Tracker (2025-03) and Global Gas Infrastructure Tracker (2025-11); three Turkish pipelines from EIA; routes from OpenStreetMap (2026-10-11) | 2025-11 | 416 | CC BY 4.0; routes ODbL |
| `infrastructure/fields.geojson` | Global Energy Monitor: Global Oil and Gas Extraction Tracker | 2026-03 | 439 | CC BY 4.0 |
| `infrastructure/terminals.geojson` | Global Energy Monitor: Global Gas Infrastructure Tracker (LNG terminals, 2025-09) | 2025-09 | 29 | CC BY 4.0 |

Links:

- OGIM v2.7: https://zenodo.org/records/15103476
- GEM oil infrastructure: https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/download-data/
- GEM gas infrastructure: https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/download-data/
- GEM extraction: https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/download-data/
- OpenStreetMap (pipeline routes), © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright

### What the app does to the data at load time

- Drops GEM features whose status is `cancelled` or `shelved`. Those projects were never built. This leaves
  57 refineries, 400 pipelines, 437 fields and 21 LNG terminals.
- Assigns each asset an energy type for the map colour, read straight from a source field: a pipeline's
  hydrocarbon, a field's type. Refineries are all crude oil refineries and terminals are all LNG.
- Splits each pipeline into stretches that follow a route and straight joins of 30 km or more with no point
  along them (`src/utils/pipelineRoute.ts`). The joins are drawn dashed.

### Pipeline routes

GEM's geometry for this region is mostly schematic: 229 of the 397 built pipelines arrive as one straight line
between two end points, and many of the rest are a handful of points hundreds of kilometres apart. Two scripts
work on the published file after `build_workspace_data.py`:

1. **`scripts/pipeline_geometry.py`** removes stray pieces. Five GEM gas records (Shouibah-Khor Al-Zubair,
   Khormor-Jambur-Kirkuk, Khormor-Pirdawood, and two MGS III segments) carry a geometry collection that also
   contains the routes of an Egyptian and a Libyan pipeline. A piece is kept if it touches a country the
   pipeline is listed in, or connects to one that does; a leftover piece that is an exact copy of another
   pipeline's route and does not connect to the pipeline's own is dropped too.
2. **`scripts/snap_pipelines_to_osm.py`** replaces straight stretches with the real route from OpenStreetMap
   (`scripts/fetch_osm_pipelines.py` downloads the OSM pipelines first). For each straight stretch of 8 km or
   more on a built pipeline (operating, idle, mothballed or retired) it looks for a chain of OSM pipelines that
   - carries the same kind of product (OSM `substance`; untagged OSM pipelines count for any hydrocarbon unless
     another tag says water, sewage and so on),
   - starts and ends near the stretch's two ends (within 10% of its length, between 2 and 40 km), and
   - is at most 1.35 times as long as the straight line.

   When there is one, its route is used and the record gets `routeSource: "OpenStreetMap"`. Proposed and
   under-construction pipelines are never matched, since they have no route yet. On 2026-10-11 this gave 118
   pipelines an OSM route, about a third of the straight-line length. The rest stay as GEM drew them and show
   dashed. The match is by place and product, not by name, so a route can be a neighbouring pipeline in the same
   corridor rather than the exact pipe.

3. **`scripts/add_eia_pipelines.py`** fills in Turkey (see below).

Some GEM records join two places that the pipeline does not physically connect in one run. The Israel-Jordan gas
pipeline is listed as 65 km but drawn from the offshore Leviathan field to northern Jordan, 220 km away. Those
stay dashed.

### Turkey

GEM's trackers spell the country "Türkiye". The build script only knew "Turkey" when the published extract was
made, so every Turkish pipeline, field and LNG terminal was dropped and Turkey showed refineries only (those
come from OGIM). The script now accepts both spellings, so a rebuild from the raw GEM files will bring them
in. GEM's public map files were no longer downloadable on 2026-10-11, so until then:

- `scripts/add_eia_pipelines.py` adds Baku-Tbilisi-Ceyhan, TurkStream and Blue Stream from the pipeline tables
  in EIA's Türkiye brief (July 2023). Capacity and length are EIA's; gas capacity is converted from trillion
  cubic feet a year to barrels of oil equivalent a day at 6,000 cubic feet to the barrel. Each route is the set
  of OpenStreetMap lines carrying the pipeline's name. EIA names no owner, so that field is empty.
- The same script lists Turkey on four cross-border pipelines the extract already had under Iraq, Iran or Syria
  (Kirkuk-Ceyhan, Kurdistan, Tabriz-Ankara, Türkiye-Syria).
- TANAP is not added: OSM has only short named pieces of it. Turkey's LNG terminals and fields are still
  missing; EIA's brief has no table for either.

Nothing else is changed, estimated or filled in.

### Known limits

- **Refineries have no status.** OGIM does not carry operating status for refineries in the region, so the
  file has no `status` property and the app shows none. (An earlier version of the file had hand-entered
  statuses; they were removed because nothing backed them.)
- **Status on the other layers is GEM's.** It is what the tracker listed on the download date. The app uses it
  to fade non-operating assets.
- **Six refineries are not from OGIM.** Al Zour, Ruwais, SATORP, YASREF and Jazan take their owner and capacity
  from EIA country analysis briefs; Sitra's 380,000 b/d is from Wikipedia's Bahrain Petroleum Company article.
  Locations are from OpenStreetMap, except Ruwais (Wikipedia). Each record carries its own `source` and
  `sourceDate`, which the app shows in place of the layer's.
- **The refinery layer is still OGIM's vintage otherwise.** It lists Shuaiba in Kuwait, which EIA's 2023 brief
  does not.
- **Fields are points.** GEM gives one coordinate per field, not an outline. Production is reported for fewer
  than half of them.
- **Pipeline capacity is patchy.** About half of the pipelines have a capacity figure.
- **Coverage follows the sources.** A facility missing from GEM or OGIM is missing here.

### Rebuilding

`scripts/build_workspace_data.py` reads the raw downloads from `raw/` (gitignored; several GB), filters them to
the region and writes the four files. The two OSM steps then add the pipeline routes.

```bash
pip install -r requirements.txt
npm run build:data
python3 scripts/fetch_osm_pipelines.py
python3 scripts/snap_pipelines_to_osm.py
python3 scripts/add_eia_pipelines.py
```

Without the raw downloads, `python3 scripts/pipeline_geometry.py` and the two OSM steps can still be run on the
published pipeline file.

## Reference files

| File | Contents |
|---|---|
| `reference/countries.json` | A background note for each of the 13 countries on the map: summary, export routes, ports and terminals named |
| `reference/companies.json` | Background notes for three operators: Saudi Aramco, ADNOC, Kuwait Petroleum |
| `reference/crude_grades.json` | 22 crude grades: producer, API gravity, sulfur, a note, and the source of the two figures |
| `reference/operator_aliases.json` | Spellings of the same company's name, so the operator index can merge them |

The country and operator **entries** in the Reference view are not in these files. They are computed from the
infrastructure layers at load time (`src/utils/referenceIndex.ts`): asset counts, listed refining capacity,
pipeline length and asset lists all come from the map data. These files only add the prose.

Rules the files follow:

- Country notes do not restate figures the datasets also give, such as refining capacity, because the two
  would disagree.
- A grade's `producer` must match a country note's `name` exactly; that is how grades and countries link.
- Every country note, operator note and crude grade has a `source`, and the app shows it on the entry.
- A crude grade carries only API gravity and sulfur. Production volumes, pricing references and a
  light/medium/heavy class were removed on 2026-10-10: the first two had no source, and the class was a label
  from cut-offs of our own that contradicted the producers' own names (Arab Light came out as "medium").
- `operator_aliases.json` only groups spellings of one legal entity. Subsidiaries are not merged into parents.

### What the notes were checked against

The notes are written by hand. On 2026-10-10 each one was checked against a named source and rewritten to say
only what that source supports. The app shows each entry's source in a short form (publisher and year).

- **Country notes.** Eleven are checked against the EIA Country Analysis Brief for that country (plus EIA's
  World Oil Transit Chokepoints page for the Strait of Hormuz and Sumed). The briefs differ a lot in age:
  UAE July 2026, Qatar October 2025, Iraq July 2025, Saudi Arabia and Iran October 2024, Egypt August 2024,
  Kuwait and Türkiye July 2023, Yemen November 2020, Oman January 2019, Syria June 2015. EIA has no brief for
  Bahrain or Jordan; Bahrain's note rests on two news reports (MEED 2018, Reuters 2019) and Jordan's on
  Wikipedia's "Energy in Jordan".
- **Operator notes.** Checked against the EIA brief for the operator's country.
- **Crude grades.** No single open source publishes assays for all of them, so the source varies by grade and is
  recorded on each one:
  - the four UAE grades are from the table in EIA's UAE brief (which credits S&P Global Platts);
  - the three Basrah grades are the specification Iraq's SOMO set from 1 January 2021, as reported by S&P Global;
  - Oman Export is from a BP crude assay (sample of 10 October 2020);
  - the other fourteen are from Wikipedia's "List of crude oil products", which cites no source for its
    figures. Treat those as typical values only. For the five Saudi grades the note also gives the band Saudi
    Aramco publishes (from EIA's Saudi Arabia brief), which the Wikipedia figures can be compared against.
- **Not opened directly.** The S&P Global and BP pages refuse automated access, so those figures were taken
  from search-engine summaries of the pages rather than from the pages themselves.
- **Events.** The notes describe normal export routes as their sources did. They do not follow events,
  including the closure of the Strait of Hormuz that EIA's July 2026 UAE brief reports from March 2026.

### Field production unit

GEM reports field production in mixed units. The build script adds oil and gas together for the latest data
year, so the `production_bpd` property is barrels of oil **equivalent** per day despite its name. The app
labels it `BOE/D`.

## Basemaps

| Basemap | Provider | Notes |
|---|---|---|
| Dark | CARTO Dark Matter (© CARTO, © OpenStreetMap contributors) | Loaded as a style URL through Mapbox GL JS |
| Satellite | Mapbox Satellite (© Mapbox) | Uses the Mapbox access token |

Mapbox GL JS needs an access token for both. Map labels use the font `Open Sans Regular` because it is the one
font both providers serve glyphs for.
