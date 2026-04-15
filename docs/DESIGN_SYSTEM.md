# Design System — Energy Intelligence Terminal

This document defines every visual element of the terminal. Follow it exactly. Every deviation — a rounded corner, a wrong shade of gray, a sans-serif font — breaks the terminal aesthetic. When in doubt, reference the Bloomberg Terminal screenshots (orange on black, dense, monospace, zero decoration).

---

## 1. Design Tokens

### 1.1 Colors

```css
:root {
  /* Backgrounds */
  --bg-primary: #000000;       /* True black — main background */
  --bg-elevated: #0A0A0A;      /* Slightly lifted — header, status bar, panels */
  --bg-surface: #111111;       /* Cards, popups, modal backgrounds */
  --bg-hover: #1A1A1A;         /* Hover states on rows, buttons */
  --bg-selected: #1A1200;      /* Selected row/item — very subtle amber tint */

  /* Accent */
  --accent-primary: #FF8C00;   /* Amber — primary brand color, active states, links */
  --accent-bright: #FFA500;    /* Bright amber — hover states, emphasis */
  --accent-muted: #CC7000;     /* Muted amber — secondary labels, inactive tabs */
  --accent-dim: #8B5E00;       /* Dim amber — very subtle accents */

  /* Text */
  --text-primary: #E0E0E0;     /* Primary body text */
  --text-bright: #FFFFFF;      /* Headers, emphasized values, important numbers */
  --text-secondary: #999999;   /* Secondary info, timestamps */
  --text-tertiary: #666666;    /* Labels, captions, disabled text */
  --text-disabled: #444444;    /* Disabled elements */

  /* Semantic */
  --color-positive: #00C853;   /* Green — operational, price up, positive change */
  --color-negative: #FF1744;   /* Red — alert, price down, negative change, incidents */
  --color-warning: #FFD600;    /* Yellow — elevated, caution, maintenance */
  --color-info: #2196F3;       /* Blue — informational, construction, links */

  /* Borders */
  --border-subtle: #222222;    /* Barely visible dividers */
  --border-default: #333333;   /* Standard panel/cell borders */
  --border-strong: #555555;    /* Button borders, interactive elements */
  --border-accent: #FF8C00;    /* Active/selected element borders */

  /* Chart-specific */
  --chart-line-1: #FF8C00;     /* Primary series (Brent) */
  --chart-line-2: #FFB74D;     /* Secondary series (WTI) */
  --chart-line-3: #FF5722;     /* Tertiary series */
  --chart-grid: #1A1A1A;       /* Chart grid lines */
  --chart-axis: #444444;       /* Chart axis lines */
  --chart-label: #888888;      /* Chart axis labels */

  /* Infrastructure layer colors */
  --layer-refinery-operational: #00C853;
  --layer-refinery-startup: #FF8C00;
  --layer-refinery-incident: #FF1744;
  --layer-refinery-maintenance: #FFD600;
  --layer-refinery-closed: #555555;
  --layer-refinery-construction: #2196F3;

  --layer-pipe-crude: #FF5722;
  --layer-pipe-gas: #FF8C00;
  --layer-pipe-ngl: #FFB74D;
  --layer-pipe-products: #FFCC80;

  --layer-field-oil: #FF8C00;
  --layer-field-gas: #4FC3F7;
  --layer-field-condensate: #CE93D8;
  --layer-field-mixed: #FFFFFF;

  /* FIRMS severity */
  --firms-normal: #555555;
  --firms-elevated: #FFD600;
  --firms-alert: #FF1744;
}
```

### 1.2 Typography

```css
:root {
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', 'Consolas', 'Courier New', monospace;

  /* Scale */
  --text-xs: 10px;     /* Smallest labels, source attribution */
  --text-sm: 11px;     /* Table cells, secondary labels, status bar */
  --text-base: 12px;   /* Standard body text, panel content */
  --text-md: 13px;     /* Important text, card content */
  --text-lg: 14px;     /* Panel headers, key values */
  --text-xl: 16px;     /* Page titles, large stat values */
  --text-2xl: 20px;    /* Hero numbers (Brent price, etc.) */
  --text-3xl: 24px;    /* Terminal brand ID only */

  /* Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
}

/* ALL text in the application uses var(--font-mono). No exceptions. */
body, input, select, textarea, button, th, td {
  font-family: var(--font-mono);
}
```

**Header/label convention**: UPPERCASE, `letter-spacing: 0.08em`, `font-weight: 600`, color `var(--accent-primary)` for section headers or `var(--text-tertiary)` for field labels.

### 1.3 Spacing

```css
:root {
  --space-xs: 2px;
  --space-sm: 4px;
  --space-md: 8px;
  --space-lg: 12px;
  --space-xl: 16px;
  --space-2xl: 24px;
}
```

Default padding inside components: `var(--space-md)` (8px). The goal is DENSITY. If it looks spacious, add more data or reduce padding.

### 1.4 Borders & Corners

```css
:root {
  --radius: 0px;  /* ZERO. ALWAYS ZERO. NO ROUNDED CORNERS. */
  --border-width: 1px;
}
```

Every component: `border-radius: 0`. Every card: `border-radius: 0`. Every button: `border-radius: 0`. Every input: `border-radius: 0`. If you find yourself typing a non-zero border-radius, stop.

---

## 2. Component Specifications

### 2.1 Panel

A collapsible section in the sidebar. Used for layer controls, filters, detail cards, alert feeds.

```css
.panel {
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-default);
  border-radius: var(--radius);  /* 0 */
  padding: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  cursor: pointer;
  user-select: none;
  border-bottom: var(--border-width) solid var(--border-subtle);
}

.panel-header-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-primary);
}

.panel-header-badge {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.panel-header-toggle {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  /* Shows ▸ when collapsed, ▾ when expanded */
}

.panel-content {
  padding: var(--space-md) var(--space-lg);
}
```

### 2.2 Button

Buttons are minimal. Never filled by default. Fill only on active/selected state.

```css
.btn {
  background: transparent;
  border: var(--border-width) solid var(--border-strong);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  transition: color 150ms, border-color 150ms;
}

.btn:hover {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

.btn.active, .btn.selected {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #000000;
}
```

### 2.3 Tab / Toggle Group

Used for view modes (MAP | TABLE | DASH), time windows (24H | 3D | 7D), and dataset tabs.

```css
.tab-group {
  display: flex;
  gap: 0;
}

.tab {
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: color 150ms;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}
```

### 2.4 Stat Block

Used in the dashboard situation room for key indicators.

```
┌─────────────────────┐
│ BRENT CRUDE         │  ← label (tertiary, xs, uppercase)
│ $72.45              │  ← value (bright, 2xl)
│ ▲ +1.23 (+1.73%)    │  ← change (green, sm)
│ EIA · 2026-04-10    │  ← source (tertiary, xs)
└─────────────────────┘
```

```css
.stat-block {
  padding: var(--space-md) var(--space-lg);
  border: var(--border-width) solid var(--border-default);
}

.stat-label {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  margin-bottom: var(--space-xs);
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  color: var(--text-bright);
  margin-bottom: var(--space-xs);
}

.stat-change {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.stat-change.positive { color: var(--color-positive); }
.stat-change.negative { color: var(--color-negative); }

.stat-source {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-sm);
}
```

### 2.5 Data Table

Dense, professional, Bloomberg-style data grid.

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.data-table th {
  background: var(--bg-surface);
  color: var(--accent-primary);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: var(--text-xs);
  padding: var(--space-sm) var(--space-md);
  border: var(--border-width) solid var(--border-subtle);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table th .sort-indicator {
  color: var(--accent-muted);
  margin-left: var(--space-sm);
}

.data-table td {
  padding: var(--space-sm) var(--space-md);
  border: var(--border-width) solid var(--border-subtle);
  color: var(--text-primary);
  white-space: nowrap;
}

.data-table tr:nth-child(even) {
  background: var(--bg-primary);
}

.data-table tr:nth-child(odd) {
  background: var(--bg-elevated);
}

.data-table tr:hover {
  background: var(--bg-hover);
}

.data-table tr.selected {
  background: var(--bg-selected);
  border-left: 2px solid var(--accent-primary);
}

/* Numeric cells right-aligned */
.data-table td.numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Status cells with colored dots */
.data-table td .status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;  /* Yes, dots can be round. Only dots. */
  margin-right: var(--space-sm);
}

/* Row count footer */
.table-footer {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  padding: var(--space-sm) var(--space-md);
  border-top: var(--border-width) solid var(--border-default);
}
```

### 2.6 Detail Card (Right Sidebar)

```css
.detail-card {
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-default);
  padding: 0;
}

.detail-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  border-bottom: var(--border-width) solid var(--border-subtle);
}

.detail-card-type {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent-primary);
}

.detail-card-close {
  font-size: var(--text-lg);
  color: var(--text-tertiary);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  line-height: 1;
}

.detail-card-close:hover {
  color: var(--text-primary);
}

.detail-card-name {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--text-bright);
  padding: var(--space-md) var(--space-lg) var(--space-sm);
}

.detail-card-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-lg);
}

.detail-card-label {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.detail-card-value {
  font-size: var(--text-sm);
  color: var(--text-bright);
  text-align: right;
}

.detail-card-divider {
  border: none;
  border-top: var(--border-width) solid var(--border-subtle);
  margin: var(--space-md) var(--space-lg);
}

.detail-card-section-label {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  padding: var(--space-sm) var(--space-lg);
  text-align: center;
}
```

### 2.7 Alert Entry

```css
.alert-entry {
  padding: var(--space-md) var(--space-lg);
  border-bottom: var(--border-width) solid var(--border-subtle);
  cursor: pointer;
}

.alert-entry:hover {
  background: var(--bg-hover);
}

.alert-entry.severity-alert {
  border-left: 2px solid var(--color-negative);
}

.alert-entry.severity-elevated {
  border-left: 2px solid var(--color-warning);
}

.alert-timestamp {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.alert-severity {
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  text-transform: uppercase;
}

.alert-severity.alert { color: var(--color-negative); }
.alert-severity.elevated { color: var(--color-warning); }

.alert-facility {
  font-size: var(--text-sm);
  color: var(--text-bright);
  font-weight: var(--weight-semibold);
}

.alert-detail {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-xs);
}
```

### 2.8 Search Input

```css
.search-input {
  background: var(--bg-primary);
  border: var(--border-width) solid var(--border-default);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: var(--space-sm) var(--space-md);
  caret-color: var(--accent-primary);
  outline: none;
  width: 200px;
}

.search-input:focus {
  border-color: var(--accent-primary);
}

.search-input::placeholder {
  color: var(--text-disabled);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: var(--text-xs);
}

.search-results {
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-default);
  max-height: 320px;
  overflow-y: auto;
}

.search-result-item {
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.search-result-item:hover {
  background: var(--bg-hover);
}

.search-result-item.selected {
  background: var(--bg-selected);
}

.search-result-type {
  font-size: var(--text-xs);
  color: var(--accent-muted);
  text-transform: uppercase;
  width: 60px;
  flex-shrink: 0;
}

.search-result-name {
  font-size: var(--text-sm);
  color: var(--text-bright);
}

.search-result-country {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-left: auto;
}
```

### 2.9 Tooltip (Map Hover)

```css
.map-tooltip {
  background: var(--bg-surface);
  border: var(--border-width) solid var(--border-default);
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-primary);
  pointer-events: none;
  white-space: nowrap;
  max-width: 300px;
  /* NOTE: Mapbox tooltips need custom styling to override defaults */
}
```

### 2.10 Status Bar

```css
.status-bar {
  height: 28px;
  background: var(--bg-elevated);
  border-top: var(--border-width) solid var(--border-subtle);
  display: flex;
  align-items: center;
  padding: 0 var(--space-lg);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  gap: var(--space-lg);
}

.status-bar-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.status-bar-separator {
  color: var(--border-default);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.connected {
  background: var(--color-positive);
  animation: pulse 2s ease-in-out infinite;
}

.status-dot.degraded {
  background: var(--color-warning);
}

.status-dot.offline {
  background: var(--color-negative);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### 2.11 Header Bar

```css
.header-bar {
  height: 40px;
  background: var(--bg-elevated);
  border-top: 2px solid var(--accent-primary);  /* The amber top accent */
  border-bottom: var(--border-width) solid var(--border-subtle);
  display: flex;
  align-items: center;
  padding: 0 var(--space-lg);
  gap: var(--space-lg);
}

.header-brand {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--accent-primary);
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.header-separator {
  color: var(--border-default);
  font-size: var(--text-lg);
}

.header-clock {
  margin-left: auto;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
```

---

## 3. Chart Styling Guide

All charts follow these rules:

### Background
Transparent (inherits `--bg-primary` from container).

### Grid lines
Very subtle: `var(--chart-grid)` = `#1A1A1A`. Horizontal grid lines only. No vertical grid lines. Dashed pattern: `dasharray: 4 4`.

### Axis lines
`var(--chart-axis)` = `#444444`. Thin (1px).

### Axis labels
`var(--chart-label)` = `#888888`. Monospace. Size: `var(--text-xs)`.

### Data lines
Primary series: `var(--chart-line-1)` = `#FF8C00` (amber). Width: 1.5px. No dots on line (only on hover).
Secondary series: `var(--chart-line-2)` = `#FFB74D`. Width: 1px.

### Crosshair on hover
Thin vertical + horizontal lines in `#555555`. Tooltip showing value at crosshair intersection.

### Area fills
Semi-transparent: `opacity: 0.1-0.2` of the line color. Used for backwardation/contango shading and inventory 5-year range bands.

### No decorative elements
No chart titles in the chart SVG (title goes in the containing panel header). No legends inside the chart (legend in the panel if needed). No data point markers except on hover. No background gradient. No 3D effects. No chart borders (the panel border is sufficient).

---

## 4. Iconography

Minimal. No icon library. Use unicode characters and simple inline SVGs.

- Collapse: `▸` (collapsed) / `▾` (expanded)
- Sort ascending: `▲`
- Sort descending: `▼`
- Price up: `▲` in green
- Price down: `▼` in red
- Close: `×`
- Search: `⌕` or `/` hint text
- Separator: `·` or `|`
- Active connection: `●` (circle) in green, pulsing
- Layer visible: `◉` (filled circle)
- Layer hidden: `○` (empty circle)

For asset type icons in search results and table rows, use simple 2-letter codes in a small badge:
- `RF` = Refinery
- `PL` = Pipeline
- `FL` = Field
- `TM` = Terminal
- `PT` = Port
- `LG` = LNG

---

## 5. Responsive Breakpoints

| Width | Behavior |
|-------|----------|
| ≥1440px | Full layout: both sidebars available, all panels |
| 1200-1439px | Compact: both sidebars available but narrower (240px / 300px) |
| 1024-1199px | Single sidebar: only one sidebar at a time, toggle between |
| <1024px | Mobile: not a priority. Show simplified dashboard or map only |

---

## 6. Loading States

No spinners. No skeleton screens. Just:
- Data area shows `LOADING...` in `var(--text-disabled)`, centered, uppercase, monospace
- Once loaded, content appears immediately (no fade-in, no slide-in)
- Status bar shows real-time fetch status

## 7. Empty States

When no data matches current filters:
```
NO RESULTS
Adjust filters or broaden search criteria
```
Centered, uppercase first line in `var(--text-tertiary)`, second line in `var(--text-disabled)`.

---

## 8. Anti-Patterns — NEVER DO THESE

1. ❌ Rounded corners on any element (except status dots which are circles)
2. ❌ Box shadows or drop shadows
3. ❌ Gradients (linear, radial, or otherwise)
4. ❌ Sans-serif or serif fonts anywhere
5. ❌ Background colors lighter than `#1A1A1A` (except semantic colors on text/icons)
6. ❌ Padding greater than 16px on any element
7. ❌ Animations longer than 200ms
8. ❌ Bouncy or spring animations
9. ❌ Loading spinners
10. ❌ Skeleton loading screens
11. ❌ Emoji in UI elements (acceptable only in country profiles for flags)
12. ❌ Icons from icon libraries (Lucide, FontAwesome, etc.)
13. ❌ Card-style elevated surfaces with shadows
14. ❌ Hamburger menus
15. ❌ Modal overlays (use sidebar panels instead)
16. ❌ Tooltips with arrows/carets
17. ❌ Color backgrounds on buttons (default state)
18. ❌ Any shade of blue as a background
19. ❌ White backgrounds anywhere
20. ❌ Decorative dividers or ornamental lines
