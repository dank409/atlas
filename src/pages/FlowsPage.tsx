import { PagePlaceholder } from "./PagePlaceholder";

/**
 * Flows (Sankey) view. Requires a curated EIA bilateral crude-flow
 * dataset that we haven't shipped yet. Placeholder until the data
 * file lands — no fabricated ribbons.
 */
export function FlowsPage() {
  return (
    <PagePlaceholder
      phase="VIEW · FLOWS"
      title="CRUDE FLOWS"
      statusLine="EIA BILATERAL FLOWS · CURATED SNAPSHOT — NOT WIRED"
      summary="Sankey of origin country → chokepoint → destination region, updated monthly from EIA and OPEC MOMR. Ribbon width is monthly average mbpd. The dataset is curated and small (≈15 × 4 × 7 = 420 rows/month), but we haven't shipped the JSON yet."
      dependencies={[
        "public/data/flows/crude_bilateral_monthly.json (curated)",
        "Sankey renderer (d3-sankey or custom path tool)",
        "Tanker movements table (optional, blocked by AIS feed)"
      ]}
      note="When live, this view also shows a chokepoint board (7-day transits, tonnage utilisation, narrow width) and a destination mix stacked bar."
    />
  );
}
