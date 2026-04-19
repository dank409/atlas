import { PagePlaceholder } from "./PagePlaceholder";

/**
 * AIS live vessel tracking page. Intentionally a placeholder until
 * the AISStream.io free-tier integration ships — the source feed is
 * real and free but requires a WebSocket client + API key + a fan-out
 * service to turn raw AIS pings into the vessel rows the mockup
 * shows. No fabricated vessel positions.
 */
export function AisPage() {
  return (
    <PagePlaceholder
      phase="VIEW · AIS"
      title="AIS WATCH"
      statusLine="LIVE · AISSTREAM.IO — NOT WIRED"
      summary="Live vessel tracking over the region: positions, STS (ship-to-ship) candidates, AIS gaps, and load/discharge inference. Planned integration is AISStream.io's free tier. Until the WebSocket feed is wired we will not fabricate vessel data — the panel stays empty by design."
      dependencies={[
        "AISStream.io API key + WebSocket client",
        "Geofence matcher (reuse FIRMS geofence pattern)",
        "Rolling-window STS candidate detector",
        "AIS-gap detector (>12h silence = active gap)"
      ]}
      note="When the feed is wired this page will carry: live positions table, STS candidate list, anchorage cluster map (Fujairah OPL / Ras Tanura Roads / Kharg Anchorage)."
    />
  );
}
