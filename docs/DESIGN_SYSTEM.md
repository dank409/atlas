# Design System — Atlas

This document defines the visual language of the app: a dense, monospace, amber-on-black terminal look. Follow it exactly. A rounded corner, a wrong shade of gray, or a sans-serif font breaks it.

The CSS below is a reference specification. The components do not import these custom properties; they use the same hex values directly in their CSS Modules.

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
  --color-positive: #00C853;   /* Green — reserved; not currently used */
  --color-negative: #FF1744;   /* Red — errors, e.g. a failed data load */
  --color-warning: #FFD600;    /* Yellow — elevated, caution, maintenance */
  --color-info: #2196F3;       /* Blue — informational, construction, links */

  /* Borders */
  --border-subtle: #222222;    /* Barely visible dividers */
  --border-default: #333333;   /* Standard panel/cell borders */
  --border-strong: #555555;    /* Button borders, interactive elements */
  --border-accent: #FF8C00;    /* Active/selected element borders */

  /* Energy types — the colour channel on the map, the left rail and the cards */
  --energy-oil: #FF8C00;    /* crude oil */
  --energy-gas: #42A5F5;    /* natural gas / LNG */
  --energy-ngl: #B388FF;    /* NGL: violet, so it cannot be mistaken for crude */
  --energy-mixed: #BDBDBD;  /* mixed oil and gas */

  /* Map selection: white, because amber is already the crude-oil colour */
  --map-selection: #FFFFFF;
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
  --text-2xl: 20px;    /* Hero numbers */
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

Dense data grid.

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

### 2.7 Search Input

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

### 2.8 Tooltip (Map Hover)

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

### 2.9 Status Bar

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
```

### 2.10 Header Bar

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
```

---

## 3. Iconography

Minimal. No icon library. Use unicode characters and simple inline SVGs.

- Collapse: `▸` (collapsed) / `▾` (expanded)
- Sort ascending: `▲`
- Sort descending: `▼`
- Close: `×`
- Search: `⌕` or `/` hint text
- Separator: `·` or `|`

Map markers carry meaning through shape, and the left rail's key draws the same shapes as small inline SVGs: diamond = refinery, triangle = LNG terminal (up for export, down for import), dot = field, line = pipeline, dashed line = route not mapped.

---

## 4. Responsive Breakpoints

| Width | Behavior |
|-------|----------|
| ≥1200px | Left rail 264px (collapsible). Detail column 340px, present only while something is selected |
| 900-1199px | Compact: 232px / 300px |
| <900px | Single scrolling column: header, map or table, detail card, controls, status bar |

---

## 5. Loading States

No spinners. No skeleton screens. Just:
- Data area shows `LOADING...` in `var(--text-disabled)`, centered, uppercase, monospace
- Once loaded, content appears immediately (no fade-in, no slide-in)
- Status bar shows `DATA: LOADING`, then `DATA: STATIC SNAPSHOT`

## 6. Empty States

When no data matches current filters:
```
NO RESULTS
Adjust filters or broaden search criteria
```
Centered, uppercase first line in `var(--text-tertiary)`, second line in `var(--text-disabled)`.

---

## 7. Anti-Patterns — NEVER DO THESE

1. ❌ Rounded corners on any element
2. ❌ Box shadows or drop shadows
3. ❌ Gradients (linear, radial, or otherwise)
4. ❌ Sans-serif or serif fonts anywhere
5. ❌ Background colors lighter than `#1A1A1A` (except semantic colors on text/icons)
6. ❌ Padding greater than 16px on any element
7. ❌ Animations longer than 200ms
8. ❌ Bouncy or spring animations
9. ❌ Loading spinners
10. ❌ Skeleton loading screens
11. ❌ Emoji in UI elements
12. ❌ Icons from icon libraries (Lucide, FontAwesome, etc.)
13. ❌ Card-style elevated surfaces with shadows
14. ❌ Hamburger menus
15. ❌ Modal overlays. Details open in the right column or beside their list
16. ❌ Tooltips with arrows/carets
17. ❌ Color backgrounds on buttons (default state)
18. ❌ Any shade of blue as a background
19. ❌ White backgrounds anywhere
20. ❌ Decorative dividers or ornamental lines
