# Feature Specification — Energy Intelligence Terminal

This document is the detailed spec for every feature. Each section defines what to build, how it should behave, and where the data comes from. Read this before implementing any feature.

---

## 0. Implementation Scope & Data Contract

### 0.1 Iteration 1 (P0 Slice)

Iteration 1 is explicitly scoped to a narrow P0 slice so implementation can start without guesswork:
- Fixed shell layout (header, left sidebar, main viewport, right sidebar, status bar)
- Map view with dark + satellite base styles
- Refineries infrastructure layer (load, style, hover, click)
- Right-sidebar asset detail card behavior
- Table view for infrastructure datasets with sort/filter baseline
- Header/status bars with source attribution and update timestamps shown in visible panels

All other features in this document remain valid roadmap requirements, but are intentionally deferred to later iterations.

### 0.2 Canonical Runtime Data Contract

- Canonical source-of-truth location in repo: `public/data/`
- Canonical runtime fetch path in app: `/data/...`
- Infrastructure map sources must be valid GeoJSON `FeatureCollection` documents.

GeoJSON contract (required shape):

```json
{
  "type": "FeatureCollection",
  "_metadata": {
    "source": "Global Energy Monitor - Global Oil Infrastructure Tracker",
    "downloadDate": "2026-04-13",
    "recordCount": 0
  },
  "features": []
}
```

`_metadata` is required for attribution/staleness display. Additional keys are allowed, but `type` and `features` must remain strict GeoJSON-compatible fields.

---

## 1. Layout Shell

### 1.1 Overall Structure

The application uses a fixed viewport layout (100vw × 100vh, no scrolling on the outer shell). Content scrolls within panels.

```
┌──────────────────────────────────────────────────────────┐
│ HEADER BAR (40px)                                        │
├────────┬─────────────────────────────────────┬───────────┤
│ LEFT   │                                     │  RIGHT    │
│ SIDEBAR│         MAIN VIEWPORT               │  SIDEBAR  │
│ (280px)│    (map / table / dashboard)        │  (360px)  │
│        │                                     │           │
│ layers │                                     │  detail   │
│ filters│                                     │  card     │
│ legend │                                     │  alerts   │
│        │                                     │  news     │
├────────┴─────────────────────────────────────┴───────────┤
│ STATUS BAR (28px)                                        │
└──────────────────────────────────────────────────────────┘
```

- **Left sidebar**: Collapsible (toggle with `[` key). Contains layer controls, filters, and map legend. Width: 280px when open.
- **Right sidebar**: Collapsible (toggle with `]` key). Contains detail cards, alert feed, news feed. Width: 360px when open. Opens automatically when an asset is clicked.
- **Main viewport**: Fills remaining space. Contains the active view (Map, Table, or Dashboard).
- Both sidebars can be open simultaneously. On narrow viewports (<1200px), only one sidebar at a time.

### 1.2 Header Bar

Height: 40px. Background: `#0A0A0A`. Top border: 2px solid `#FF8C00`.

Contents (left to right):
- **Terminal ID**: `ATLAS` (or chosen name) in amber, bold, 14px uppercase. This is the brand mark.
- **Separator**: `|` in `#333`
- **Region selector**: Dropdown showing current region. Default: `MIDDLE EAST`. Future: other regions. Styled as terminal dropdown (no native select, custom component with `#333` border, `#000` background, amber text for selected).
- **Separator**
- **Time window toggles**: `24H` `3D` `7D` `30D` — only applicable when FIRMS layer is active. Otherwise hidden or grayed.
- **Separator**
- **View mode switches**: `MAP` `TABLE` `DASH` — tab-style toggles. Active = amber text + 2px bottom border. Inactive = `#666` text.
- **Right side**: Current time (HH:MM:SS, updating every second, monospace), timezone label.

### 1.3 Status Bar

Height: 28px. Background: `#0A0A0A`. Top border: 1px solid `#222`.

Contents (left to right):
- **Connection indicator**: Small circle (8px). Green pulsing = data sources reachable. Yellow = some sources degraded. Red = offline. Followed by text: `CONNECTED` / `DEGRADED` / `OFFLINE`.
- **Separator**: `·`
- **FIRMS status**: `FIRMS: [N] detections · [timestamp]` — shows last FIRMS fetch time and count of displayed detections.
- **Separator**
- **EIA status**: `EIA: BRENT $XX.XX · [date]` — latest Brent price as a quick reference.
- **Separator**
- **Region**: `REGION: MIDDLE EAST`
- **Right side**: `SOURCES: [N]/[M] ACTIVE` — how many data sources are responding out of total configured.

### 1.4 Keyboard Shortcuts

Global shortcuts (work regardless of focus):

| Key | Action |
|-----|--------|
| `M` | Switch to Map view |
| `T` | Switch to Table view |
| `D` | Switch to Dashboard view |
| `[` | Toggle left sidebar |
| `]` | Toggle right sidebar |
| `1` | Toggle Refineries layer |
| `2` | Toggle Pipelines layer |
| `3` | Toggle Fields layer |
| `4` | Toggle Terminals layer |
| `5` | Toggle FIRMS layer |
| `6` | Toggle Chokepoints layer |
| `/` | Focus search bar |
| `Esc` | Close detail card / deselect |

Display a small shortcuts reference overlay with `?` key.

---

## 2. Map View

### 2.1 Base Map

Use Mapbox GL JS with two base styles:

1. **Dark**: Custom Mapbox style or `mapbox://styles/mapbox/dark-v11` customized:
   - Water: `#000000` (pure black)
   - Land: `#0A0A0A` (near black)
   - Country borders: `#333333`, 1px
   - Labels: `#555555`, monospace font if possible
   - Roads: hidden at low zoom, `#222` at high zoom
   
2. **Satellite**: `mapbox://styles/mapbox/satellite-v9` or `satellite-streets-v12` (with labels)

Toggle between them with a small control in the bottom-left or top-right of the map.

### 2.2 Default View

- Center: `[50.5, 26.5]` (middle of Persian Gulf)
- Zoom: `5` (shows full Middle East from Egypt to Pakistan)
- Pitch: 0 (flat, not 3D)
- Bearing: 0 (north up)

### 2.3 Infrastructure Layers

Each layer is a Mapbox source + layer pair. Data loaded from runtime-served static GeoJSON files at `/data/...` (backed by files in `public/data/`).

#### 2.3.1 Refineries

**Source data**: Global Energy Monitor — Global Oil Infrastructure Tracker (Refineries tab)

**GeoJSON features**: Point geometry for each refinery.

**Properties per feature**:
```typescript
interface Refinery {
  id: string;
  name: string;
  country: string;        // ISO 2-letter code
  countryName: string;     // Full name
  owner: string;
  operator: string;
  status: 'operational' | 'planned_startup' | 'unplanned_incident' | 'planned_maintenance' | 'permanent_closure' | 'construction' | 'proposed';
  capacity_bpd: number;   // barrels per day
  capacityUnit: string;   // always 'bpd'
  type: 'refinery' | 'gas_processing' | 'terminal' | 'storage' | 'lng_plant';
  lat: number;
  lon: number;
  firmsRadius_km: number; // geofence radius for FIRMS
  ticker?: string;        // Bloomberg ticker if known
  notes?: string;
}
```

**Visual encoding**:
- Shape: Circle
- Fill color: by status
  - `operational` → `#00C853` (green)
  - `planned_startup` → `#FF8C00` (amber)
  - `unplanned_incident` → `#FF1744` (red)
  - `planned_maintenance` → `#FFD600` (yellow)
  - `permanent_closure` → `#555555` (gray)
  - `construction` → `#2196F3` (blue)
  - `proposed` → `#333333` (dark gray, barely visible)
- Radius: Scaled by `capacity_bpd`. Use `sqrt` scaling:
  - `radius = 4 + sqrt(capacity_bpd / 10000) * 1.5` (approximate — tune so largest refineries are ~20px and smallest are ~5px)
- Stroke: 1px `#000000`
- Opacity: 0.85

**Interaction**:
- Hover: Show tooltip — `"[name] — [capacity_bpd] bpd — [status]"`
- Click: Open detail card in right sidebar with all properties

#### 2.3.2 Pipelines

**Source data**: Global Energy Monitor — Global Gas Infrastructure Tracker + Global Oil Infrastructure Tracker (Pipelines tabs)

**GeoJSON features**: LineString geometry where route data is available. For pipelines without route geometry, create a simplified line from known start/end coordinates or waypoints.

**Properties per feature**:
```typescript
interface Pipeline {
  id: string;
  name: string;
  segmentName?: string;
  owner: string;
  operator?: string;
  hydrocarbon: 'crude_oil' | 'natural_gas' | 'ngl' | 'products' | 'mixed';
  status: 'operating' | 'construction' | 'proposed' | 'mothballed' | 'decommissioned';
  capacity_boed: number;  // BOE per day
  diameter_inches: number;
  length_km: number;
  cost_usd?: number;
  country: string;
  countries?: string[];   // if crosses borders
  startPoint?: string;
  endPoint?: string;
  ticker?: string;
}
```

**Visual encoding**:
- Line color by hydrocarbon:
  - `crude_oil` → `#FF5722` (deep orange-red)
  - `natural_gas` → `#FF8C00` (amber)
  - `ngl` → `#FFB74D` (light amber)
  - `products` → `#FFCC80` (pale amber)
  - `mixed` → `#FFFFFF` (white, rare)
- Line width: Scaled by capacity. `width = 1 + log10(capacity_boed / 1000) * 0.8` (range roughly 1-5px)
- Line dash: Solid for `operating`, dashed for `construction`/`proposed`, dotted for `mothballed`/`decommissioned`
- Opacity: 0.6 default, 1.0 on hover

**Interaction**:
- Hover: Highlight line (full opacity + slight width increase). Tooltip with name and hydrocarbon type.
- Click: Open detail card.

#### 2.3.3 Oil & Gas Fields

**Source data**: Global Energy Monitor — Global Oil & Gas Extraction Tracker or public field databases.

**Properties**:
```typescript
interface Field {
  id: string;
  name: string;
  country: string;
  basin: string;
  operator: string;
  fieldType: 'oil' | 'gas' | 'condensate' | 'mixed';
  status: 'producing' | 'discovered' | 'under_development' | 'exploration' | 'abandoned' | 'depleted';
  reserves_mmboe?: number;  // million barrels oil equivalent
  production_bpd?: number;  // current production rate
  discoveryYear?: number;
  apiGravity?: number;      // for oil fields
  sulfurContent?: number;   // percent
  lat: number;
  lon: number;
}
```

**Visual encoding**:
- Shape: Diamond (rotated square) — to visually distinguish from refinery circles
- Color by type: oil = `#FF8C00`, gas = `#4FC3F7`, condensate = `#CE93D8`, mixed = `#FFFFFF`
- Size by reserves or production (whichever is available)
- Opacity by status: producing = 0.9, under_development = 0.7, discovered = 0.5, exploration = 0.3, abandoned = 0.2

#### 2.3.4 Export Terminals & Ports

**Properties**:
```typescript
interface Terminal {
  id: string;
  name: string;
  country: string;
  type: 'export_terminal' | 'import_terminal' | 'port' | 'storage_terminal' | 'lng_terminal';
  owner: string;
  operator: string;
  capacity_bpd?: number;
  storageCap_mmbbl?: number;
  status: string;
  lat: number;
  lon: number;
  notes?: string;
}
```

**Visual encoding**:
- Shape: Square marker
- Color: Amber for export terminals, blue-tinted for import/LNG, white for general ports
- Size by capacity

#### 2.3.5 Chokepoints

Not loaded from an external dataset — these are curated static features.

**Features to include**:
1. **Strait of Hormuz**: Dashed line across the strait (~26.5°N, 56.3°E). Label: `STRAIT OF HORMUZ — ~21M bpd transit`. This is the single most important feature in Middle Eastern energy geography.
2. **Bab el-Mandeb**: Dashed line (~12.6°N, 43.3°E). Label: `BAB EL-MANDEB — ~5M bpd transit`.
3. **Suez Canal / SUMED Pipeline**: Marker at Suez (~30°N, 32.5°E). Label with combined capacity.
4. **Turkish Straits (Bosphorus)**: If within map bounds. Label with transit volume.

**Visual**: Dashed line in `#FF1744` (red), label in white with amber background badge. These should be visually prominent — they're the reason the region matters.

### 2.4 Map Controls

**Bottom-left**: Base layer toggle (Dark / Satellite), scale bar, zoom level.

**Top-right**: Search bar (see spec below).

**Bottom-right**: Attribution (Mapbox, data sources).

### 2.5 Search

Input field in header or top-right of map. Styled as terminal input: `#0A0A0A` background, 1px `#333` border, amber caret, monospace text.

Searches across all loaded asset names, pipeline names, country names, city names. Uses fuzzy matching (e.g., `ras tan` matches "Ras Tanura Refinery"). Results displayed in a dropdown below the input, max 8 results, each showing: icon (by asset type), name, type label, country.

Selecting a result: map flies to the asset coordinates (zoom level appropriate to asset type — refineries zoom to ~10, pipelines to ~7, countries to ~5), and opens the detail card.

---

## 3. Detail Cards

When an asset is clicked, a detail card appears in the right sidebar. The card structure depends on asset type.

### 3.1 Refinery Detail Card

```
┌─────────────────────────────────┐
│ REFINERY                    [×] │
├─────────────────────────────────┤
│ Ras Tanura Refinery             │
│                                 │
│ Owner      Saudi Arabian Oil Co │
│ Operator   Saudi Arabian Oil Co │
│ Status     ● Operational        │
│ Capacity   550,000 bpd         │
│ Outage     0 bpd               │
│ Country    SA (Saudi Arabia)    │
│ Type       Refinery              │
│                                 │
│ ─── FIRMS ACTIVITY ───          │
│ 24H: 3 detections (normal)     │
│ 7D:  22 detections (normal)    │
│ Baseline: ~3/day               │
│                                 │
│ ─── LINKED DATA ───             │
│ Ticker: ARAMCO AB Equity       │
│ Source: Global Energy Monitor   │
│ Updated: 2026-01-15            │
└─────────────────────────────────┘
```

All labels left-aligned in `#888`, all values right-aligned in `#FFF`. Status includes a colored dot matching the map marker. If FIRMS layer is active and this facility has detections, show the FIRMS activity section.

### 3.2 Pipeline Detail Card

Similar structure. Additional fields: hydrocarbon type, diameter, length, start/end points, segment name, cost if known. If pipeline has multiple segments, list them.

### 3.3 Country Profile Card

Triggered when the user selects a country from a country list or searches for a country name. Shows:

- Country name and flag emoji
- Current estimated crude production (with source and date)
- Production capacity
- Spare capacity (production capacity minus current production)
- OPEC quota (if OPEC member)
- OPEC compliance percentage
- Number of refineries (with total capacity)
- Number of pipelines
- Key export terminals
- Primary crude grades produced (with API gravity and sulfur)
- Key chokepoint dependencies (e.g., "Hormuz-dependent: 90% of exports" vs "Has bypass: East-West pipeline to Yanbu")
- Sanctions status (if applicable)

This is a one-page brief. The data is curated in a static JSON file and updated manually.

---

## 4. FIRMS Intelligence Layer

### 4.1 Data Flow

1. Fetch from NASA FIRMS API: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{bounding_box}/{time_range}`
   - Bounding box for Middle East: approximately `30,12,65,40` (W,S,E,N)
   - Time range: `1` (last 24h), `3`, `7` days
2. Parse CSV response into array of hotspot objects.
3. Normalize `confidence` into a `confidenceScore` (0-100) across sensors.
4. For each hotspot, calculate distance to every known infrastructure asset (use Haversine formula).
5. Keep only hotspots within `firmsRadius_km` of at least one asset.
6. Group remaining hotspots by nearest asset.
7. For each asset, calculate detection count and compare to historical baseline.
8. Render on map with appropriate visual severity.
9. Generate alert entries for anomalous facilities.

### 4.2 Hotspot Data Model

```typescript
interface FIRMSHotspot {
  latitude: number;
  longitude: number;
  brightness: number;       // Kelvin
  scan: number;
  track: number;
  acq_date: string;         // YYYY-MM-DD
  acq_time: string;         // HHMM
  satellite: string;        // 'N' for Suomi NPP, '1' for NOAA-20
  instrument: string;       // 'VIIRS'
  confidenceRaw: 'low' | 'nominal' | 'high' | number;
  confidenceScore: number;  // normalized 0-100 score across sensors
  version: string;
  bright_ti4: number;
  bright_ti5: number;
  frp: number;              // Fire Radiative Power (MW)
  daynight: 'D' | 'N';
  // Computed fields:
  nearestAsset?: string;    // ID of nearest infrastructure asset
  distanceKm?: number;      // distance to nearest asset
  severity?: 'normal' | 'elevated' | 'alert';
}
```

### 4.2.1 Confidence Normalization Rule (Single Rule Across Sensors)

- Normalize all sensor confidence values into `confidenceScore` (0-100):
  - VIIRS categorical mapping: `low` -> 40, `nominal` -> 75, `high` -> 95
  - MODIS numeric mapping: use provided numeric confidence directly (clamped to 0-100)
- Default display threshold: `confidenceScore >= 80`
- User confidence slider controls this normalized threshold (not sensor-specific raw values)

### 4.3 Baseline Calculation

For each facility, maintain a rolling count: average detections per day over the past 30 days (fetched once per session or cached). This can be approximated by fetching the 7D data and extrapolating, or by storing historical counts in localStorage.

**Severity thresholds**:
- `normal`: current window detection count ≤ 1.5× average for that window
- `elevated`: 1.5× to 3× average
- `alert`: > 3× average OR sudden appearance at a facility with typically 0 detections

### 4.4 Alert Feed

Displayed in the right sidebar when FIRMS layer is active. Each alert is a structured entry:

```
[HH:MM] ▲ ELEVATED — Ras Tanura Refinery
8 detections in 24H (avg: 3/day)
Saudi Aramco · 550,000 bpd
```

Alerts sorted by severity (alert > elevated), then by time. Color-coded: red background tint for alert, yellow for elevated.

---

## 5. Data Table View

When the user switches to Table view (`T` key), the main viewport shows a full-width data table.

### 5.1 Table Features

- **Dataset tabs**: Along the top — `INFRASTRUCTURE` | `PIPELINES` | `FIELDS` | `TERMINALS` | `FIRMS` | `OUTAGES`
- **Columns**: All properties of the selected dataset type. Sortable by clicking column headers (ascending/descending toggle). Current sort indicated by `▲` / `▼` arrow.
- **Filtering**: Inline filter row below headers. Text input for string columns, range slider or min/max for numeric columns.
- **Row count**: Bottom-left shows `"[N] row(s) in the table"` like Bloomberg.
- **Row selection**: Click a row to highlight it and open its detail card in the right sidebar. Double-click to fly the map to that asset (switch to Map view).
- **Column resizing**: Drag column borders to resize.
- **Styling**: Alternating row backgrounds (`#000` and `#0A0A0A`). Header row: `#111` background, amber text, uppercase. Selected row: 1px amber left border, `#1A1200` background tint.

### 5.2 Export

Button in table header: `EXPORT CSV`. Downloads the current filtered/sorted view as a CSV file.

---

## 6. Dashboard View (Situation Room)

The landing page. When the user opens the terminal or switches to Dashboard view (`D` key), they see a grid of key indicators designed to answer: **"Is anything happening right now?"**

### 6.1 Layout

```
┌────────────────────────────────────────────────────────┐
│  KEY INDICATORS (top strip)                            │
│  BRENT: $XX.XX ▲X.X%  |  WTI: $XX.XX ▼X.X%  |       │
│  SPREAD: $X.XX  |  ME PRODUCTION: XX.X Mbpd  |        │
│  ACTIVE OUTAGES: N (XXXk bpd offline)  |              │
│  FIRMS ALERTS: N facilities                            │
├──────────────────────┬─────────────────────────────────┤
│  PRICE CHART         │  ALERTS & EVENTS               │
│  (Brent 30D line)    │  [alert entries]               │
│                      │  [outage events]               │
│                      │  [recent FIRMS flags]          │
├──────────────────────┼─────────────────────────────────┤
│  FUTURES CURVE       │  NEWS FEED                     │
│  (current fwd curve) │  [RSS headlines]               │
│                      │  [timestamped]                 │
├──────────────────────┴─────────────────────────────────┤
│  MINI MAP — alert/outage overlay only (clickable to   │
│  switch to full map view)                              │
└────────────────────────────────────────────────────────┘
```

### 6.2 Key Indicators Strip

Horizontal bar of stat blocks. Each block:
```
BRENT CRUDE
$72.45   ▲ +1.23 (+1.73%)
Source: EIA · 2026-04-10
```

Blocks (left to right):
1. Brent crude price + daily change (green/red)
2. WTI crude price + daily change
3. WTI-Brent spread (negative = Brent premium, which is normal)
4. Total Middle East production estimate (from latest OPEC data, with date)
5. Active outages: count of facilities with known unplanned outages, total offline capacity
6. FIRMS alerts: count of facilities with elevated/alert thermal activity

### 6.3 Price Chart

Simple 30-day line chart of Brent crude daily close. Styled: amber line on black, no grid lines (or very subtle `#111` grid), axis labels in `#666`, data labels in `#CCC`. On hover, show crosshair with date and price.

Below the chart: WTI-Brent spread as a small area chart (same 30D window). Positive spread area = green tint, negative = red tint.

### 6.4 Futures Curve

Plot of crude oil futures prices from front month through M12 (or however far out data is available). X-axis = contract month, Y-axis = settlement price. If curve slopes down = backwardation (label in amber), slopes up = contango (label in blue).

Show M1-M2 spread explicitly as a stat: `M1-M2 SPREAD: -$0.45 (BACKWARDATION)`

### 6.5 Alerts & Events Panel

Merged feed of:
- FIRMS alerts (from section 4.4)
- Outage events (from manually curated event log)
- Any flagged data changes

Sorted chronologically, most recent first. Each entry color-coded by type/severity.

### 6.6 News Feed

RSS headlines from:
- EIA This Week in Petroleum
- EIA Short-Term Energy Outlook (when published)
- Reuters Energy (public RSS if available)
- OPEC press releases

Each headline: timestamp + source tag + headline text. Clickable to open in new tab.

---

## 7. Market Data Charts

Accessible from Dashboard view or as expandable panels.

### 7.1 Price History

Full-featured price chart for Brent and WTI.

**Features**:
- Time range selector: 1M, 3M, 6M, 1Y, 5Y, MAX
- Toggle between Brent, WTI, or both overlaid
- Optional volume bars at bottom (if data available)
- Crosshair on hover showing date, price, volume
- Styled: amber/orange lines on black, axis in `#444`, labels in `#888`

**Data source**: EIA API — Petroleum > Prices > Spot Prices > Daily

### 7.2 WTI-Brent Spread

Dedicated chart showing the daily spread (WTI minus Brent).

- Area chart: shade green when positive (WTI premium), red when negative (Brent premium)
- Show average spread as a dashed `#555` line
- Historical context: when the spread widened, why (annotate major events if possible)

### 7.3 Futures Forward Curve

Plot monthly contract settlements from M1 through M12+.

- Each data point = one contract month's settlement price
- Line with dot markers
- Show backwardation/contango state prominently
- If possible, overlay previous day's curve as a faded line to show day-over-day shift

**Data source**: CME Group daily settlement data (requires scraping or manual update).

### 7.4 Production Charts

Country-level production history.

- Bar chart or stacked area chart
- Countries: Saudi Arabia, Iran, Iraq, Kuwait, UAE, Qatar, Oman, Others
- Monthly data, show last 24 months minimum
- OPEC total as a separate line overlay

**Data source**: EIA International Energy Statistics API or curated from OPEC MOMR.

### 7.5 Crack Spreads / Refining Margins

Approximated refining margins:
- Simple crack spread: gasoline price minus crude price (EIA has gasoline spot prices)
- 3-2-1 crack spread: (2 × gasoline + 1 × heating oil − 3 × crude) / 3

Chart over time, show current value prominently.

### 7.6 US Crude Inventories

Weekly EIA data. Bar chart showing inventory level (million barrels) over time. Overlay the 5-year average range as a shaded band. Current level vs 5-year average = immediate read on whether markets are tight or loose.

**Data source**: EIA Weekly Petroleum Status Report API.

---

## 8. Country Profiles

Accessible from search, from clicking a country on the map, or from a dedicated country selector.

### 8.1 Data Structure

```typescript
interface CountryProfile {
  code: string;           // ISO 3166-1 alpha-2
  name: string;
  flag: string;           // emoji
  opecMember: boolean;
  opecPlusMember: boolean;
  
  // Production
  currentProduction_kbpd: number;
  productionCapacity_kbpd: number;
  spareCapacity_kbpd: number;
  opecQuota_kbpd?: number;
  quotaCompliance_pct?: number;
  productionSource: string;
  productionDate: string;
  
  // Infrastructure counts
  refineryCount: number;
  totalRefiningCapacity_bpd: number;
  pipelineCount: number;
  exportTerminalCount: number;
  
  // Exports
  crudeExports_kbpd?: number;
  primaryExportDestinations?: string[];
  
  // Crude grades
  crudeGrades: {
    name: string;
    apiGravity: number;
    sulfurPct: number;
    classification: 'light_sweet' | 'light_sour' | 'medium_sour' | 'heavy_sour';
  }[];
  
  // Chokepoint dependency
  hormuzDependent_pct: number;    // % of exports through Hormuz
  bypassCapacity_bpd?: number;    // capacity of bypass routes
  bypassRoutes?: string[];        // names of bypass pipelines
  
  // Sanctions
  sanctionsStatus: 'none' | 'partial' | 'comprehensive';
  sanctionsNotes?: string;
  
  // Narrative
  summary: string;                // 2-3 paragraph overview
  lastUpdated: string;
}
```

### 8.2 Countries to Include (v1)

1. **Saudi Arabia** — Largest OPEC producer. East-West pipeline as Hormuz hedge. Key grades: Arab Light (33° API, 1.8% S), Arab Heavy (27° API, 2.8% S). Ras Tanura, Yanbu, Jubail as major terminals.
2. **Iran** — Under sanctions, production constrained. Major IGAT gas pipeline network. Key grades: Iran Heavy (30° API, 1.7% S), Iran Light (33.4° API, 1.4% S).
3. **Iraq** — Second largest OPEC producer. Southern exports via Basra (Hormuz-dependent). Northern exports via Kirkuk-Ceyhan pipeline to Turkey. Key grades: Basra Light, Basra Heavy.
4. **UAE** — ADNOC dominant. Habshan-Fujairah pipeline bypasses Hormuz. Key grade: Murban (39° API, 0.8% S — notably light and low-sulfur).
5. **Kuwait** — KNPC refineries. Fully Hormuz-dependent. Key grade: Kuwait Export Blend (31° API, 2.5% S).
6. **Qatar** — World's largest LNG exporter. Ras Laffan is critical. North Field is the world's largest gas field. Limited crude production but massive gas.
7. **Oman** — Non-OPEC. Exports from Muscat/Sohar. Key grade: Oman Crude (33° API, 2% S). Oman futures traded on DME.
8. **Bahrain** — Small producer. Bahrain Field (1932, one of the oldest in the Gulf). Bapco refinery. Linked to Saudi Arabia by pipeline.
9. **Yemen** — Disrupted by conflict. Minimal production. Bab el-Mandeb strait location is geopolitically critical.

---

## 9. Outage Event Log

### 9.1 Data Structure

```typescript
interface OutageEvent {
  id: string;
  timestamp: string;       // ISO 8601
  facility: string;        // name of affected facility
  facilityId: string;      // links to infrastructure asset
  country: string;
  type: 'unplanned_outage' | 'planned_maintenance' | 'force_majeure' | 'attack' | 'weather' | 'sanctions' | 'other';
  capacityOffline_bpd: number;
  estimatedDuration?: string;  // e.g., "2-3 weeks"
  resolved: boolean;
  resolvedDate?: string;
  source: string;          // news source
  description: string;
  severity: 'minor' | 'moderate' | 'major';  // <50k bpd = minor, 50-200k = moderate, >200k = major
}
```

### 9.2 Display

- In the right sidebar alert feed (interleaved with FIRMS alerts)
- As markers on the map (optional layer — incident icon overlaid on affected facility)
- On the Dashboard situation room (count + total bpd offline)
- Optionally overlaid on price charts (vertical event lines)

---

## 10. Crude Grade Reference

A reference table accessible from a panel or dedicated view. Helps users understand what types of crude are produced where.

| Grade | Country | API Gravity | Sulfur % | Classification | Benchmark |
|-------|---------|-------------|----------|----------------|-----------|
| Arab Light | Saudi Arabia | 33.0 | 1.77 | Medium Sour | — |
| Arab Heavy | Saudi Arabia | 27.0 | 2.80 | Heavy Sour | — |
| Arab Extra Light | Saudi Arabia | 38.5 | 1.15 | Light Sour | — |
| Murban | UAE | 39.0 | 0.80 | Light Sweet | DME Murban |
| Basra Light | Iraq | 33.0 | 2.00 | Medium Sour | — |
| Basra Heavy | Iraq | 24.0 | 3.80 | Heavy Sour | — |
| Iran Heavy | Iran | 30.0 | 1.70 | Medium Sour | — |
| Iran Light | Iran | 33.4 | 1.40 | Light Sour | — |
| Kuwait Export | Kuwait | 31.0 | 2.50 | Medium Sour | — |
| Oman Crude | Oman | 33.0 | 2.00 | Medium Sour | DME Oman |
| Qatar Marine | Qatar | 36.0 | 1.42 | Light Sour | — |
| Bahrain | Bahrain | 32.0 | 1.50 | Medium Sour | — |

This table should be static, styled in terminal fashion, and have a brief explanatory note:
> API gravity measures crude density (higher = lighter). Sulfur content determines "sweet" (<0.5%) vs "sour" (>0.5%). Light sweet crudes command premiums because they yield more gasoline and diesel with simpler refining.

---

## 11. News Feed

### 11.1 RSS Sources

- EIA "Today in Energy": `https://www.eia.gov/todayinenergy/rss.xml` (if available)
- OPEC News: check for public RSS
- Reuters Energy: limited public availability — may need to use alternative

Fallback: Manually curate a list of bookmarked sources as links rather than live RSS if APIs prove unreliable.

### 11.2 Display

Panel in right sidebar (below detail card area). Each entry:

```
[12:45] EIA — US crude inventories fell by 2.3M barrels...
[09:30] OPEC — April MOMR: production cut compliance at 97%...
[08:15] RTRS — Iran crude exports hit 6-month low amid...
```

Source tag in amber. Timestamp in `#666`. Headline in `#CCC`. Click to open source URL in new tab.

Max 20 entries shown. Auto-refresh every 15 minutes.

---

## 12. Supply Flow Visualization

Static overlay on the map showing major tanker routes.

**Routes to include**:
1. Persian Gulf → Strait of Hormuz → Fujairah anchorage → eastward (to India, China, Japan, Korea)
2. Persian Gulf → Strait of Hormuz → westward → Bab el-Mandeb → Suez Canal → Mediterranean → Europe
3. Persian Gulf → Hormuz → westward → around Cape of Good Hope (when Suez is disrupted/expensive)
4. Iraq (Basra) → Hormuz → same splits
5. Iraq (Kirkuk) → overland pipeline → Ceyhan, Turkey → Mediterranean tanker loading
6. Saudi Arabia → East-West pipeline → Yanbu → Red Sea → direct to Mediterranean (bypasses Hormuz)
7. UAE → Habshan-Fujairah pipeline → Fujairah → direct to Indian Ocean (bypasses Hormuz)

**Visual**: Thin dashed lines in `#444` with small directional arrows. Labeled at key points. This is a reference layer, not primary — it contextualizes the infrastructure.

---

## 13. Responsive Behavior

The terminal is designed for desktop (1440px+ width). On tablets (1024-1439px): collapse both sidebars by default, show one at a time. On mobile (<1024px): simplified view — either map-only or dashboard-only, no split panels. Mobile is NOT a priority for v1 — this is a professional tool used at a desk.

---

## 14. Performance Targets

- Initial load: <3 seconds on broadband
- Map interaction (pan/zoom): 60fps
- Layer toggle: <200ms to show/hide
- Table rendering: <500ms for 1000 rows
- FIRMS fetch + process: <2 seconds
- Chart rendering: <300ms
