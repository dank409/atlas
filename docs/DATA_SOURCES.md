# Data Sources — Energy Intelligence Terminal

This document details every data source used in the platform: where to get it, what format it comes in, how to parse it, and what its limitations are.

---

## 1. Global Energy Monitor (GEM) — Infrastructure Data

### Overview
GEM maintains several open-source trackers that form the backbone of our infrastructure layers. This is the SAME data Bloomberg uses in its MAP function — GEM is credited in Bloomberg's map attribution (visible in the screenshots: "Global Gas Infrastructure Tracker, Global Energy Monitor").

### Trackers We Use

#### Global Oil Infrastructure Tracker (GOIT)
- **URL**: https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/
- **Coverage**: Refineries, oil pipelines, oil storage, export terminals worldwide
- **Download**: Available as XLSX from the GEM website (free, may require account)
- **Refresh**: Updated quarterly (January, April, July, October)
- **Key fields for refineries**: Unit Name, Country, Subnational Unit, Owner, Operator, Status, Capacity (bbl/day), Latitude, Longitude, Start Year
- **Key fields for pipelines**: Pipeline Name, Segment Name, Country, Owner, Operator, Status, Hydrocarbon, Capacity (bbl/day or BOE/day), Diameter (inches), Length (km), Start Point, End Point, Cost (USD), Route Coordinates (GeoJSON where available)

#### Global Gas Infrastructure Tracker (GGIT)
- **URL**: https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/
- **Coverage**: Gas pipelines, LNG terminals, gas processing plants
- **Download**: XLSX from GEM website
- **Key fields**: Similar to GOIT but gas-specific. Capacity in BOE/D or BCM/year.

#### Global Oil & Gas Extraction Tracker
- **URL**: https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/
- **Coverage**: Oil and gas fields worldwide
- **Key fields**: Field Name, Country, Basin, Operator, Status, Field Type, Reserves (MMBOE), Production Rate, Discovery Year, Coordinates

### Data Processing Pipeline

1. Download XLSX files from GEM
2. Filter to Middle East countries: SA, IR, IQ, KW, AE, QA, OM, BH, YE (plus Egypt, Jordan, Syria, Turkey for pipeline transit routes)
3. Convert to JSON/GeoJSON format matching our TypeScript interfaces
4. For pipelines: extract route coordinates where available, create simplified start-end lines where not
5. Store as static files in `public/data/infrastructure/` (runtime fetch path: `/data/infrastructure/...`)
6. Document the GEM tracker version and download date in each file's metadata

### Limitations
- Data is updated quarterly, not real-time. Facility status (e.g., "unplanned incident") may be outdated.
- Route geometry is not available for all pipelines. Some only have start/end coordinates.
- Capacity figures may differ between sources. GEM uses reported/estimated values.
- Coordinate precision varies. Some facilities are placed at city-level, not exact facility coordinates. Cross-reference with satellite imagery (Google Maps/Earth) for major facilities.

### Important: Manual Enrichment
For key facilities (top 30 by capacity), we should manually verify and enrich:
- Exact coordinates (using satellite imagery)
- Correct FIRMS geofence radius (based on facility footprint visible in satellite)
- Any missing metadata
- Bloomberg ticker if available (for cross-reference)

---

## 2. NASA FIRMS — Thermal Anomaly Detection

### Overview
Fire Information for Resource Management System (FIRMS) provides near real-time active fire/thermal anomaly data from satellite-based sensors. We use this for disruption monitoring.

### API Details

**Base URL**: `https://firms.modaps.eosdis.nasa.gov/api/area/csv`

**Endpoint format**: `{BASE_URL}/{MAP_KEY}/{SENSOR}/{BOUNDING_BOX}/{TIME_RANGE}`

**Sensors**:
- `VIIRS_SNPP_NRT` — Suomi NPP satellite, VIIRS instrument. ~375m resolution. Preferred sensor.
- `VIIRS_NOAA20_NRT` — NOAA-20 satellite, same instrument. Complementary passes.
- `MODIS_NRT` — Older, ~1km resolution. Less precise but longer historical baseline.

**Bounding box for Middle East**: `30,12,65,40` (West, South, East, North)
- Covers: Arabian Peninsula, Iran, Iraq, Levant, Egypt (eastern), Oman, Yemen

**Time range**: `1` (last 24h), `2`, `3`, `7`, `10` days

**Full example**:
```
https://firms.modaps.eosdis.nasa.gov/api/area/csv/YOUR_MAP_KEY/VIIRS_SNPP_NRT/30,12,65,40/3
```

### API Key
- Register at: https://firms.modaps.eosdis.nasa.gov/api/area/
- Free tier: 500 requests per minute — more than sufficient
- Store as `VITE_FIRMS_MAP_KEY` environment variable

### Response Format (CSV)
```csv
latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
26.3217,50.1532,312.4,0.39,0.36,2026-04-10,0530,N,VIIRS,nominal,2.0NRT,289.3,2.4,N
```

**Key fields**:
- `latitude`, `longitude` — hotspot position
- `confidence` — VIIRS uses categorical: `low`, `nominal`, `high`. MODIS uses numeric 0-100.
- `frp` — Fire Radiative Power in MW. Higher = more intense. Gas flares typically 1-50 MW. Major fires can be 100+ MW.
- `bright_ti4` — Brightness temperature (Kelvin). Higher = hotter detection.
- `acq_date`, `acq_time` — Acquisition datetime (UTC)
- `daynight` — `D` or `N`. Night detections are generally more reliable (less solar interference).

### Processing Notes

**Confidence normalization (single cross-sensor rule)**:
- Normalize confidence into a `confidenceScore` (0-100) for all sensors:
  - VIIRS: `low` -> 40, `nominal` -> 75, `high` -> 95
  - MODIS: use numeric confidence directly (clamped 0-100)
- Default display threshold: `confidenceScore >= 80`
- User slider controls this normalized threshold, not raw per-sensor values.

**Gas flare identification**: Persistent hotspots at known facility locations (same lat/lon ± 0.01° across multiple days) with consistent FRP values are likely gas flares. These should be tagged as `normal` in our severity classification.

**Satellite pass timing**: VIIRS Suomi NPP crosses the equator at roughly 01:30 and 13:30 local solar time. Detections cluster around these times. This means "24H" data actually represents 2-3 satellite passes, not continuous monitoring. The user should understand this.

**False positives**: Desert regions have high ground temperatures that can register as low-confidence thermal anomalies. Our geofence filtering eliminates most of these. In summer months (June-August), false positive rates increase.

### Rate Limiting Strategy
- Cache FIRMS responses in browser localStorage with a TTL of 30 minutes
- Don't re-fetch on every layer toggle — only when time window changes or cache expires
- Show "last fetched" timestamp in the status bar

---

## 3. EIA (U.S. Energy Information Administration) — Prices & Inventory

### Overview
The EIA provides the most accessible free API for energy data. While it's US-centric, it includes global benchmark prices and international production data.

### API Details

**Base URL**: `https://api.eia.gov/v2/`

**API Key**: Register at https://www.eia.gov/opendata/register.php — free, instant.

**Authentication**: Pass as query parameter `api_key=YOUR_KEY`

### Endpoints We Use

#### Daily Crude Oil Spot Prices
```
GET https://api.eia.gov/v2/petroleum/pri/spt/data/
?api_key={KEY}
&frequency=daily
&data[0]=value
&facets[product][]= EPCBRENT (Brent) or EPCWTI (WTI)
&sort[0][column]=period
&sort[0][direction]=desc
&length=365
```

Returns daily Brent and WTI spot prices ($/barrel). This is our primary price data source.

#### Weekly US Crude Oil Inventories
```
GET https://api.eia.gov/v2/petroleum/stoc/wstk/data/
?api_key={KEY}
&frequency=weekly
&data[0]=value
&facets[product][]=EPC0
&sort[0][column]=period
&sort[0][direction]=desc
&length=260
```

Returns weekly US crude oil commercial inventories (thousand barrels). ~5 years of weekly data for the 5-year range band.

#### Petroleum Product Prices (for crack spreads)
```
GET https://api.eia.gov/v2/petroleum/pri/spt/data/
?api_key={KEY}
&frequency=daily
&data[0]=value
&facets[product][]=EPMRU (RBOB Gasoline) or EPDHK (No. 2 Heating Oil)
```

These combined with crude prices allow crack spread calculation.

#### International Crude Oil Production
```
GET https://api.eia.gov/v2/international/data/
?api_key={KEY}
&frequency=monthly
&data[0]=value
&facets[activityId][]=1  (production)
&facets[productId][]=57  (crude oil including condensate)
&facets[countryRegionId][]=SAU,IRN,IRQ,KWT,ARE,QAT,OMN,BHR,YEM
&sort[0][column]=period
&sort[0][direction]=desc
```

Monthly production by country. **Warning**: International data lags by 2-3 months.

### Rate Limits
- No strict rate limit published, but be respectful: cache all responses for at least 1 hour
- Daily price data only updates once per day (~6pm ET), so cache until next day
- Weekly inventory updates Wednesday at 10:30 AM ET

### Limitations
- EIA prices are US-centric spot prices, not the same as Platts assessments or OSPs (Official Selling Prices) that physical traders actually use. They're directionally accurate but not trading-grade.
- International production data lags 2-3 months
- No futures curve data — that requires CME (see below)
- No Middle East-specific refining margins — those need to be calculated from price differentials

---

## 4. CME Group — Futures Settlement Data

### Overview
CME publishes daily settlement prices for WTI crude oil futures (NYMEX) and Brent crude oil futures (ICE, but CME has Brent contracts too). This is needed for the futures forward curve and backwardation/contango analysis.

### Data Access
CME's daily settlement data is published on their website:
- **WTI (CL)**: https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.settlements.html
- **Brent (BZ)**: https://www.cmegroup.com/markets/energy/crude-oil/brent-crude-oil.settlements.html

**There is no free API.** The data must be either:
1. Manually downloaded and converted to JSON periodically
2. Scraped from the settlements page (check ToS — CME has restrictions on automated scraping)
3. Obtained through Nasdaq Data Link (formerly Quandl) which has some CME data on free tier

### Realistic Approach for v1
- Maintain a manually updated JSON file with current forward curve data
- Update it daily or weekly
- Clearly label the update date on the chart
- Long-term: explore free data sources that relay CME settlements

### Data Structure
```json
{
  "curve_date": "2026-04-10",
  "commodity": "WTI",
  "contracts": [
    {"month": "2026-05", "label": "M1", "settle": 72.45},
    {"month": "2026-06", "label": "M2", "settle": 72.10},
    {"month": "2026-07", "label": "M3", "settle": 71.85},
    ...
  ],
  "source": "CME Group Daily Settlements",
  "last_updated": "2026-04-10T22:00:00Z"
}
```

---

## 5. OPEC — Production & Policy Data

### Overview
OPEC publishes the Monthly Oil Market Report (MOMR) around the 12th-13th of each month. It contains production by country (based on secondary sources), demand forecasts, and supply estimates.

### Data Access
- **MOMR PDF**: https://www.opec.org/opec_web/en/publications/338.htm
- **Annual Statistical Bulletin**: https://www.opec.org/opec_web/en/publications/202.htm (historical data)

**There is no OPEC API.** Production data must be extracted from the MOMR PDF tables or from secondary sources that digitize it (EIA International data, JODI).

### Realistic Approach for v1
- Use EIA International data as primary source (API-accessible, see section 3)
- Supplement with manually curated data from MOMR for the most recent month (since EIA lags)
- Store in curated JSON files per country with monthly time series
- Clearly label which months come from which source

### OPEC+ Quotas
- OPEC+ quota allocations are announced in press releases after ministerial meetings
- These are curated manually into a JSON file
- Compare quota to actual production for compliance tracking

---

## 6. JODI (Joint Organisations Data Initiative)

### Overview
JODI provides monthly oil statistics submitted by governments. It includes production, refinery throughput, imports/exports, and demand for major countries.

### Data Access
- **JODI Oil World Database**: https://www.jodidata.org/oil/
- Free access with registration
- Download as CSV

### Key Data Points
- Crude oil production by country (monthly)
- Refinery input/output
- Crude and product imports/exports
- Demand (approximated through product deliveries)

### Limitations
- Submissions are voluntary and sometimes incomplete
- Data lags by 2-3 months
- Some countries (notably Iran) may not submit regularly
- Quality varies by reporting country

---

## 7. Country Profiles — Curated Data

### Overview
Country profiles are manually curated from multiple public sources. They are NOT auto-populated from any single API.

### Sources for Curation
- EIA Country Analysis Briefs (https://www.eia.gov/international/analysis/)
- OPEC Member Country profiles
- CIA World Factbook (energy sections)
- Industry references (ESAI, Platts, Argus — public summaries)
- News reports for current sanctions, disputes, and policy changes

### Update Cadence
- Review and update monthly or when significant events occur (production changes, sanctions changes, new infrastructure commissioning)
- Each profile JSON file has a `lastUpdated` field

---

## 8. News / RSS Feeds

### Available Feeds

| Source | URL | Notes |
|--------|-----|-------|
| EIA Today in Energy | https://www.eia.gov/todayinenergy/rss.xml | Reliable, 1-2 articles/day |
| OPEC Press Releases | Check opec.org for RSS availability | May not have RSS — fallback to checking website |
| Reuters Energy | Reuters limits free RSS access | May need alternative |

### Fallback Strategy
If RSS is unreliable, curate a set of bookmarked source links and display them as a reference panel rather than a fake live feed. Honesty about what is observed, curated, or stale is important.

Degraded-mode requirements (must be visible in UI):
- Keep the last successful fetch timestamp and label it as stale when outdated.
- Mark fallback entries with explicit cadence / provenance labels (for example: `CURATED`, `LAST KNOWN`, `EOD`, or `NRT SATELLITE`) so users can distinguish observed vs curated content.
- Never imply continuous connectivity for feeds that are EOD, weekly, or manual.

---

## 9. Chokepoint Transit Data — Static Reference

### Sources
- EIA analysis: "The Strait of Hormuz is the world's most important oil chokepoint" (regularly updated analysis page)
- EIA: "World Oil Transit Chokepoints" — provides estimated volumes for Hormuz, Bab el-Mandeb, Suez, Turkish Straits, Malacca

### Data Structure
```json
{
  "chokepoints": [
    {
      "name": "Strait of Hormuz",
      "transitVolume_mbpd": 20.5,
      "percentOfGlobalSeaborne": 21,
      "narrowestPoint_km": 33,
      "coordinates": [[56.0, 26.7], [56.5, 26.3]],
      "notes": "~20-21 million bpd of crude and products. Flows primarily to Asia (India, China, Japan, South Korea). Iran and Oman border the strait.",
      "source": "EIA World Oil Transit Chokepoints, 2023",
      "lastUpdated": "2025-06"
    }
  ]
}
```

---

## 10. File Organization

```
public/data/
├── infrastructure/
│   ├── refineries.geojson      # From GEM GOIT
│   ├── pipelines.geojson       # From GEM GOIT + GGIT
│   ├── fields.geojson          # From GEM Extraction Tracker
│   ├── terminals.geojson       # From GEM GOIT (terminals/ports)
│   └── metadata.json           # GEM tracker version, download date
├── reference/
│   ├── chokepoints.geojson     # Curated
│   ├── crude_grades.json       # Curated reference table
│   ├── countries.json          # Country profiles
│   ├── shipping_routes.geojson # Major tanker route lines
│   └── opec_quotas.json        # Current OPEC+ quota allocations
├── market/
│   ├── futures_curve.json      # Daily CME settlement data (manual update)
│   ├── production_history.json # Monthly production by country
│   └── outage_log.json         # Manually curated outage events
└── README.md                   # Data dictionary and update log
```

Runtime fetch paths mirror this tree at `/data/...` (for example, `/data/infrastructure/refineries.geojson`).

Each file should include a top-level metadata object. GeoJSON files must remain valid FeatureCollections:
```json
{
  "type": "FeatureCollection",
  "_metadata": {
    "source": "Global Energy Monitor - Global Oil Infrastructure Tracker v2024-Q4",
    "downloadDate": "2025-01-15",
    "filterCriteria": "Middle East region only",
    "recordCount": 27,
    "notes": "Coordinates verified for top 15 facilities via satellite imagery"
  },
  "features": [ ... ]
}
```

---

## 11. Automated data refresh pipeline

Atlas ships with a "Poor Man's API" nightly refresh pipeline that
rewrites a subset of the static JSON files against live upstream
endpoints. This is the answer to the *"isn't this just hardcoded
JSON?"* interview question: the JSON files ARE static, but a
GitHub Actions cron overwrites them every night at 05:17 UTC so
the terminal reflects yesterday's market close the moment you
load the page.

### Architecture

```
                    ┌──────────────────────────────┐
                    │  GitHub Actions (free tier)  │
                    │   cron: "17 5 * * *" UTC     │
                    └────────────┬─────────────────┘
                                 │ nightly
                                 ▼
     ┌─────────────────────────────────────────────────────┐
     │  scripts/update_market_data.ts  (Node 20 + tsx)     │
     │                                                     │
     │   leg 1: eia-spot    → public/data/market/          │
     │                         crude_prices_30d.json       │
     │   leg 2: brent-hist  → public/data/market/          │
     │                         brent_historical_5y.json    │
     │   leg 3: firms       → public/data/firms/           │
     │                         recent_detections.json      │
     └────────┬───────────────────────────────┬────────────┘
              │                               │
              ▼                               ▼
     ┌─────────────────┐             ┌─────────────────┐
     │  EIA v2 (key)   │             │  NASA FIRMS     │
     │   primary       │             │  (key required) │
     └────────┬────────┘             └─────────────────┘
              │ fallback
              ▼
     ┌─────────────────┐
     │  FRED CSV       │
     │  (keyless)      │
     └─────────────────┘
```

### What the pipeline overwrites nightly

| Target | Upstream | Fallback |
|---|---|---|
| `public/data/market/crude_prices_30d.json` | EIA v2 `/petroleum/pri/spt/data/` (Brent + WTI, 30d) | FRED `DCOILBRENTEU` + `DCOILWTICO` (keyless CSV) |
| `public/data/market/brent_historical_5y.json` | EIA v2 `/petroleum/pri/spt/data/` (Brent, ~1300 daily rows → weekly resample) | FRED `DCOILBRENTEU` 5y CSV |
| `public/data/firms/recent_detections.json` | NASA FIRMS `/api/country/csv/.../VIIRS_SNPP_NRT/{iso3}/3` per Middle East country | None — leg is skipped cleanly if `FIRMS_MAP_KEY` is unset |

### What the pipeline deliberately does NOT touch

These files stay human-curated because no free public endpoint
provides a reliable JSON feed. A bad auto-refresh would put wrong
numbers in front of a trader, which is worse than a stale file
labelled `CURATED`.

| File | Why it stays curated |
|---|---|
| `public/data/market/dme_oman_30d.json` | DME publishes settlements as a PDF behind an IP-whitelisted CDN. No JSON endpoint exists. |
| `public/data/market/murban_30d.json` | IFAD Murban settlements require a licensed ICE vendor subscription. |
| `public/data/market/ice_brent_settlements.json` | ICE forward strip (M1-M12 contract codes) requires scraping ICE's settlement page, which has anti-bot measures. |
| `public/data/events/outages.json` | Human severity classification — the whole point is the curator's judgement. |
| `public/data/infrastructure/*.geojson` | Global Energy Monitor quarterly drop. Built by `scripts/build_workspace_data.py`. |

### Environment variables

Both secrets are free to register and instant-issue. The pipeline
runs sensibly with zero secrets (FRED fallback covers market
data, FIRMS leg skips cleanly), but production deploys should
set both.

| Variable | Required? | Where to register | What happens if missing |
|---|---|---|---|
| `EIA_API_KEY` | Optional | https://www.eia.gov/opendata/register.php | EIA legs fall through to FRED CSV. No-op: you still get live Brent + WTI daily. |
| `FIRMS_MAP_KEY` | Required for FIRMS leg | https://firms.modaps.eosdis.nasa.gov/api/map_key/ | FIRMS leg is skipped. The other two legs still run. |

In GitHub Actions, set these as **Settings → Secrets and variables
→ Actions → New repository secret**.

### Running locally

```bash
# Run every leg (EIA/FRED market data + FIRMS)
npm run refresh:data

# Run individual legs
npm run refresh:data:eia          # crude_prices_30d.json only
npm run refresh:data:brent-hist   # brent_historical_5y.json only
npm run refresh:data:firms        # recent_detections.json only

# With explicit env vars
EIA_API_KEY=xxx FIRMS_MAP_KEY=yyy npm run refresh:data
```

### Exit-code contract

The script is engineered to NEVER leave a corrupt target file
on disk. Each leg writes atomically (temp file + rename) and
failed legs leave the existing file untouched. The exit code
tells the Actions workflow whether anything succeeded:

- `0` — at least one leg wrote data (or determined the upstream
  data is already fresh). The commit step fires only if the JSON
  actually changed.
- `1` — every leg failed. The workflow job goes red and the repo
  owner gets a notification.
- `2` — unknown subcommand argument.

A partial outage (say FIRMS momentarily down while EIA is fine)
commits the EIA refresh with yesterday's FIRMS snapshot still in
place. Graceful degradation is the entire point of this
architecture.

### Reference implementations

- Script: [`scripts/update_market_data.ts`](../scripts/update_market_data.ts)
- Workflow: [`.github/workflows/daily_data_refresh.yml`](../.github/workflows/daily_data_refresh.yml)
