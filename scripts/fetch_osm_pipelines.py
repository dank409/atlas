"""Download OpenStreetMap's pipelines for the region, for `snap_pipelines_to_osm.py`.

Asks the public Overpass API for every `man_made=pipeline` line between
Egypt and eastern Iran, a tile at a time, and writes them to
raw/osm/pipelines.json (about 30 MB; `raw/` is not committed).

    python scripts/fetch_osm_pipelines.py

OpenStreetMap data is © OpenStreetMap contributors, licensed under ODbL.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "raw" / "osm" / "pipelines.json"

# One request for the whole region is refused as too large, so it is split.
LATITUDES = [12, 24, 30, 42]
LONGITUDES = [25, 38, 48, 54, 63.5]

ATTEMPTS = 8


def fetch_tile(south: float, west: float, north: float, east: float) -> list[dict]:
    query = (
        "[out:json][timeout:120][maxsize:268435456];"
        f'way["man_made"="pipeline"]({south},{west},{north},{east});'
        "out body geom qt;"
    )
    request = urllib.request.Request(
        OVERPASS_URL,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "atlas-student-project/1.0 (pipeline route download)"},
    )

    for attempt in range(ATTEMPTS):
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                return [element for element in json.loads(response.read())["elements"] if element["type"] == "way"]
        except (urllib.error.URLError, TimeoutError) as error:
            # The public server is often busy or rate-limiting; wait and retry.
            print(f"  attempt {attempt + 1} failed ({error}); retrying")
            time.sleep(10 + attempt * 8)

    raise SystemExit("Overpass did not answer; try again later.")


def main() -> None:
    ways: dict[int, dict] = {}

    for south, north in zip(LATITUDES, LATITUDES[1:]):
        for west, east in zip(LONGITUDES, LONGITUDES[1:]):
            for way in fetch_tile(south, west, north, east):
                ways[way["id"]] = way
            print(f"{south}-{north}N {west}-{east}E: {len(ways)} lines so far")
            time.sleep(2)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps({"elements": list(ways.values())}), encoding="utf-8")
    print(f"Wrote {len(ways)} pipeline lines to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
