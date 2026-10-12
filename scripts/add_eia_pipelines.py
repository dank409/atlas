"""Add the transit pipelines the published GEM extract lacks for Turkey.

GEM's trackers spell the country "Türkiye", which the build script did not
recognise when the extract was made, so no pipeline was listed under
Turkey. Until the raw GEM files are downloaded again, this fills the gap
from the pipeline tables in EIA's Türkiye country analysis brief (2023):

- adds Baku-Tbilisi-Ceyhan, TurkStream and Blue Stream, each drawn along
  the OpenStreetMap lines that carry its name;
- lists Turkey on the cross-border pipelines EIA names that the extract
  already has under Iraq, Iran or Syria.

    python scripts/add_eia_pipelines.py [--osm raw/osm/pipelines.json]

Running it twice changes nothing.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pipeline_geometry import PIPELINES_PATH, distance_km, to_geometry
from snap_pipelines_to_osm import OSM_PATH, simplify

SOURCE = "EIA Country Analysis Brief: Türkiye (2023); route from OpenStreetMap"
SOURCE_DATE = "2023-07"

# EIA gives gas capacity in trillion cubic feet a year. The map's unit is
# barrels of oil equivalent a day, at 6,000 cubic feet to the barrel.
def gas_boed(tcf_per_year: float) -> int:
    return int(round(tcf_per_year * 1e12 / 365 / 6000, -3))


KM_PER_MILE = 1.609

# Capacity and length are EIA's. `osm_name` matches the name tags of the
# OpenStreetMap lines that make up the route.
PIPELINES = [
    {
        "id": "pipeline-tr-baku-tbilisi-ceyhan",
        "name": "Baku-Tbilisi-Ceyhan Oil Pipeline",
        "hydrocarbon": "crude_oil",
        "capacity_boed": 1_200_000,
        "length_km": round(1100 * KM_PER_MILE),
        "startPoint": "Baku",
        "endPoint": "Ceyhan",
        "osm_name": r"bak[uüı].{0,3}t[bi].{0,8}ceyhan|ბაქო-თბილისი-ჯეიჰან",
    },
    {
        "id": "pipeline-tr-turkstream",
        "name": "TurkStream Gas Pipeline",
        "hydrocarbon": "natural_gas",
        "capacity_boed": gas_boed(1.1),
        "length_km": round(570 * KM_PER_MILE),
        "startPoint": "Russia",
        "endPoint": "Türkiye",
        "osm_name": r"turkstream|türk akımı",
    },
    {
        "id": "pipeline-tr-blue-stream",
        "name": "Blue Stream Gas Pipeline",
        "hydrocarbon": "natural_gas",
        "capacity_boed": gas_boed(0.6),
        "length_km": round(750 * KM_PER_MILE),
        "startPoint": "Russia",
        "endPoint": "Türkiye",
        "osm_name": r"blue stream|mavi akım",
    },
]

# Pipelines EIA's brief lists as running into Turkey.
ALSO_IN_TURKEY = {
    "Kirkuk-Ceyhan Oil Pipeline",
    "Kurdistan Oil Pipeline",
    "Tabriz-Ankara Gas Pipeline",
    "Türkiye-Syria Natural Gas Pipeline",
}

JOIN_WITHIN_KM = 2.0

# Stubs shorter than this (valve stations, short spurs) are left out.
MIN_PART_KM = 5.0

Line = list[list[float]]


def named_lines(ways: list[dict[str, Any]], pattern: str) -> list[Line]:
    matcher = re.compile(pattern, re.IGNORECASE)
    return [
        [[point["lon"], point["lat"]] for point in way["geometry"]]
        for way in ways
        if any(matcher.search(way["tags"].get(key, "")) for key in ("name", "name:en", "name:tr"))
    ]


def chain(lines: list[Line]) -> list[Line]:
    """Join lines that meet end to end into as few continuous lines as possible."""
    chains = [list(line) for line in lines if len(line) > 1]
    merged = True
    while merged:
        merged = False
        for first in range(len(chains)):
            for second in range(first + 1, len(chains)):
                a, b = chains[first], chains[second]
                for left, right in ((a, b), (a, b[::-1]), (a[::-1], b), (a[::-1], b[::-1])):
                    if distance_km(left[-1], right[0]) <= JOIN_WITHIN_KM:
                        chains[first] = left + right
                        del chains[second]
                        merged = True
                        break
                if merged:
                    break
            if merged:
                break

    return chains


def build_feature(spec: dict[str, Any], ways: list[dict[str, Any]]) -> dict[str, Any]:
    lines = chain(named_lines(ways, spec["osm_name"]))
    if not lines:
        raise SystemExit(f"OpenStreetMap has no line named for {spec['name']}")

    parts = [
        simplify([[round(value, 5) for value in point] for point in line])
        for line in lines
        if sum(distance_km(a, b) for a, b in zip(line, line[1:])) >= MIN_PART_KM
    ]
    properties = {key: value for key, value in spec.items() if key != "osm_name"}
    properties.update(
        {
            "country": "TR",
            "countryName": "Turkey",
            "countries": ["TR"],
            "owner": "",
            "status": "operating",
            "linkedContext": {"countryCode": "TR"},
            "routeSource": "OpenStreetMap",
            "source": SOURCE,
            "sourceDate": SOURCE_DATE,
        }
    )

    return {"type": "Feature", "id": spec["id"], "geometry": to_geometry(parts), "properties": properties}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--osm", type=Path, default=OSM_PATH, help="OSM pipeline extract (Overpass JSON)")
    arguments = parser.parse_args()

    payload = json.loads(PIPELINES_PATH.read_text(encoding="utf-8"))
    ways = json.loads(arguments.osm.read_text(encoding="utf-8"))["elements"]
    added_ids = {spec["id"] for spec in PIPELINES}

    features = [feature for feature in payload["features"] if feature["id"] not in added_ids]
    for feature in features:
        countries = feature["properties"]["countries"]
        if feature["properties"]["name"] in ALSO_IN_TURKEY and "TR" not in countries:
            countries.append("TR")

    features.extend(build_feature(spec, ways) for spec in PIPELINES)
    payload["features"] = sorted(features, key=lambda feature: feature["properties"]["name"])
    payload["_metadata"]["recordCount"] = len(payload["features"])
    PIPELINES_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"{len(PIPELINES)} pipelines added; Turkey listed on {len(ALSO_IN_TURKEY)} cross-border pipelines")


if __name__ == "__main__":
    main()
