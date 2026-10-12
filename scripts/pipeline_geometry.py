"""Clean-up for pipeline geometry as GEM publishes it.

A few GEM records carry a geometry collection that also contains the
routes of unrelated pipelines (the Iraqi Shouibah-Khor Al-Zubair line came
with pieces of an Egyptian and a Libyan one). `drop_stray_parts` removes
those pieces. It is used by `build_workspace_data.py`, and can be run on
its own to clean the published file when the raw downloads are not at hand:

    python scripts/pipeline_geometry.py
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

PIPELINES_PATH = Path(__file__).resolve().parents[1] / "public" / "data" / "infrastructure" / "pipelines.geojson"

# Rough extent of each country a pipeline can be listed in:
# (west, south, east, north) in degrees.
COUNTRY_BOXES = {
    "AE": (51.4, 22.5, 56.5, 26.2),
    "BH": (50.3, 25.5, 50.9, 26.4),
    "EG": (24.6, 21.9, 37.0, 31.8),
    "IN": (68.1, 6.5, 97.4, 35.7),
    "IQ": (38.7, 29.0, 48.7, 37.4),
    "IR": (44.0, 25.0, 63.4, 39.8),
    "JO": (34.8, 29.1, 39.4, 33.4),
    "KW": (46.5, 28.5, 48.6, 30.2),
    "OM": (51.8, 16.6, 60.0, 26.6),
    "PK": (60.8, 23.6, 77.9, 37.1),
    "QA": (50.6, 24.4, 52.0, 26.3),
    "SA": (34.4, 16.2, 55.8, 32.3),
    "SY": (35.6, 32.2, 42.5, 37.4),
    "TR": (25.6, 35.8, 44.9, 42.2),
    "YE": (42.4, 12.0, 54.6, 19.1),
}

# Slack around a country box, so a pipeline just offshore still counts.
BOX_MARGIN_DEGREES = 0.5

# Two pieces closer than this belong to the same pipeline.
CONNECTED_WITHIN_KM = 50

Point = list[float]
Part = list[Point]


def distance_km(a: Point, b: Point) -> float:
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def get_parts(geometry: dict[str, Any]) -> list[Part]:
    return [geometry["coordinates"]] if geometry["type"] == "LineString" else list(geometry["coordinates"])


def to_geometry(parts: list[Part]) -> dict[str, Any]:
    if len(parts) == 1:
        return {"type": "LineString", "coordinates": parts[0]}

    return {"type": "MultiLineString", "coordinates": parts}


def is_inside(point: Point, country_codes: list[str]) -> bool:
    for code in country_codes:
        west, south, east, north = COUNTRY_BOXES[code]
        if (
            west - BOX_MARGIN_DEGREES <= point[0] <= east + BOX_MARGIN_DEGREES
            and south - BOX_MARGIN_DEGREES <= point[1] <= north + BOX_MARGIN_DEGREES
        ):
            return True

    return False


def are_connected(part: Part, others: list[Part]) -> bool:
    return any(distance_km(a, b) <= CONNECTED_WITHIN_KM for other in others for a in part for b in other)


def drop_stray_parts(features: list[dict[str, Any]]) -> list[str]:
    """Remove pieces of other pipelines from multi-part features, in place.

    A piece stays if it touches one of the countries the pipeline is listed
    in, or connects to a piece that does. Of what is left, a piece that is
    an exact copy of another pipeline's route and does not connect to this
    pipeline's own pieces is dropped too. Returns the names of the pipelines
    that changed.
    """
    for feature in features:
        parts = get_parts(feature["geometry"])
        if len(parts) < 2:
            continue

        countries = feature["properties"]["countries"]
        kept = [part for part in parts if any(is_inside(point, countries) for point in part)]
        if not kept:
            continue

        # Pieces that run on across a border from a kept piece.
        candidates = [part for part in parts if part not in kept]
        grew = True
        while grew:
            grew = False
            for part in list(candidates):
                if are_connected(part, kept):
                    kept.append(part)
                    candidates.remove(part)
                    grew = True

        feature["_parts"] = [part for part in parts if part in kept]

    # Second pass, once every feature has lost its out-of-country pieces.
    owners: dict[str, set[str]] = defaultdict(set)
    for feature in features:
        for part in feature.get("_parts") or get_parts(feature["geometry"]):
            owners[json.dumps(part)].add(feature["properties"]["name"])

    changed: list[str] = []
    for feature in features:
        parts = feature.pop("_parts", None)
        if parts is None:
            continue

        own = [part for part in parts if owners[json.dumps(part)] == {feature["properties"]["name"]}]
        if own:
            parts = [part for part in parts if part in own or are_connected(part, own)]

        if len(parts) != len(get_parts(feature["geometry"])):
            feature["geometry"] = to_geometry(parts)
            changed.append(feature["properties"]["name"])

    return changed


def main() -> None:
    payload = json.loads(PIPELINES_PATH.read_text(encoding="utf-8"))
    changed = drop_stray_parts(payload["features"])
    PIPELINES_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Cleaned {len(changed)} pipelines: {', '.join(changed) or 'none'}")


if __name__ == "__main__":
    main()
