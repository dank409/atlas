"""Replace straight pipeline segments with the real route from OpenStreetMap.

GEM draws most pipelines in this region as a straight line between two end
points. OpenStreetMap maps the pipes themselves. For every straight stretch
in the published file this looks for a chain of OSM pipelines that carries
the same kind of product and runs between the same two places, and when
there is one, uses its route instead. Stretches with no match are left as
they are.

    python scripts/fetch_osm_pipelines.py      # writes raw/osm/pipelines.json
    python scripts/snap_pipelines_to_osm.py    # rewrites pipelines.geojson

Run it after `build_workspace_data.py`. Running it twice changes nothing.
"""

from __future__ import annotations

import argparse
import heapq
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

from pipeline_geometry import PIPELINES_PATH, distance_km, get_parts, to_geometry

OSM_PATH = Path(__file__).resolve().parents[1] / "raw" / "osm" / "pipelines.json"

# OSM `substance` values that can carry each GEM hydrocarbon. About a third
# of OSM's pipelines here have no substance tag; those are used for any
# hydrocarbon unless another tag says they carry something else.
OSM_SUBSTANCES = {
    "crude_oil": {"oil", "crude_oil", "petroleum", "fuel", "hydrocarbons"},
    "natural_gas": {"gas", "natural_gas", "lng", "hydrocarbons"},
    "ngl": {"oil", "gas", "natural_gas", "lpg", "ngl", "condensate", "hydrocarbons"},
}
NOT_HYDROCARBON = {"water", "heat", "irrigation", "penstock", "headrace", "spillway", "sewage"}
DESCRIPTIVE_TAGS = ("type", "usage", "content", "product", "pipeline", "operator")

# Only pipelines that exist are matched. A proposed line has no route yet,
# and matching it would draw some other pipeline in its place.
BUILT_STATUSES = {"operating", "idle", "mothballed", "retired"}

# Straight stretches shorter than this are left alone.
MIN_STRETCH_KM = 8

# How far a GEM end point may be from the OSM pipeline it is matched to:
# a share of the stretch's length, within these limits. GEM places ends at
# the town or field, not at the pipe.
SNAP_SHARE = 0.10
MIN_SNAP_KM = 2.0
MAX_SNAP_KM = 40.0

# A route is accepted only if it is not much longer than the straight line.
MAX_DETOUR = 1.35

# OSM pipelines are drawn as many separate lines. Ends closer than
# JOIN_WITHIN_KM are treated as joined, and ends facing each other across a
# short unmapped gap are bridged. Long lines (trunk lines, as opposed to the
# short flowlines inside a field) are also bridged across wider gaps, at a
# cost, so the search prefers mapped pipe.
JOIN_WITHIN_KM = 0.25
BRIDGE_GAP_KM = 2.0
TRUNK_MIN_KM = 10.0
TRUNK_BRIDGE_KM = 15.0
BRIDGE_COST = 1.5

# Detail kept in the published route, and the longest stretch left without
# a point (the app treats long point-free stretches as "route not mapped").
SIMPLIFY_KM = 0.15
MAX_POINT_SPACING_KM = 10

GRID_DEGREES = 0.05

Point = list[float]
Graph = dict[int, list[tuple[int, float]]]


class PipelineNetwork:
    """OSM pipelines for one kind of product, as a routable graph."""

    def __init__(self, ways: list[dict[str, Any]]) -> None:
        self.coordinates: dict[int, tuple[float, float]] = {}
        self.graph: Graph = defaultdict(list)
        self.grid: dict[tuple[int, int], list[int]] = defaultdict(list)
        way_of_node: dict[int, int] = {}
        ends: list[int] = []

        for way in ways:
            nodes = way["nodes"]
            for node, position in zip(nodes, way["geometry"]):
                self.coordinates[node] = (position["lon"], position["lat"])
                way_of_node[node] = way["id"]
            for a, b in zip(nodes, nodes[1:]):
                self._link(a, b)
            ends.extend((nodes[0], nodes[-1]))

        for node, (lon, lat) in self.coordinates.items():
            self.grid[self._cell(lon, lat)].append(node)

        end_set = set(ends)
        for end in ends:
            for other, gap in self.near(self.coordinates[end], BRIDGE_GAP_KM):
                if way_of_node[other] == way_of_node[end]:
                    continue
                if gap <= JOIN_WITHIN_KM or other in end_set:
                    self._link(end, other)

        self._bridge_trunk_lines()

    def _link(self, a: int, b: int, cost_factor: float = 1.0) -> None:
        if a == b:
            return
        cost = distance_km(list(self.coordinates[a]), list(self.coordinates[b])) * cost_factor
        self.graph[a].append((b, cost))
        self.graph[b].append((a, cost))

    def _bridge_trunk_lines(self) -> None:
        """Link each loose end of a long line to the nearest loose end of another long line."""
        line_of_node: dict[int, int] = {}
        line_km: dict[int, float] = defaultdict(float)
        for seed in self.coordinates:
            if seed in line_of_node:
                continue
            line_of_node[seed] = seed
            stack = [seed]
            while stack:
                node = stack.pop()
                for neighbour, length in self.graph[node]:
                    line_km[seed] += length / 2
                    if neighbour not in line_of_node:
                        line_of_node[neighbour] = seed
                        stack.append(neighbour)

        loose_ends = [
            node
            for node, links in self.graph.items()
            if len(links) == 1 and line_km[line_of_node[node]] >= TRUNK_MIN_KM
        ]
        loose_grid: dict[tuple[int, int], list[int]] = defaultdict(list)
        for node in loose_ends:
            loose_grid[self._cell(*self.coordinates[node])].append(node)

        all_nodes = self.grid
        self.grid = loose_grid
        bridges = []
        for node in loose_ends:
            others = [
                (gap, other)
                for other, gap in self.near(self.coordinates[node], TRUNK_BRIDGE_KM)
                if line_of_node[other] != line_of_node[node]
            ]
            if others:
                bridges.append((node, min(others)[1]))
        self.grid = all_nodes

        for a, b in bridges:
            self._link(a, b, BRIDGE_COST)

    @staticmethod
    def _cell(lon: float, lat: float) -> tuple[int, int]:
        return (math.floor(lon / GRID_DEGREES), math.floor(lat / GRID_DEGREES))

    def near(self, point: tuple[float, float] | Point, radius_km: float) -> list[tuple[int, float]]:
        """Nodes within `radius_km` of `point`, with their distance."""
        # Flat-earth distance: exact enough over a few kilometres, and this
        # runs for every node near every end point.
        km_per_lon = 111.19 * math.cos(math.radians(point[1]))
        reach_x = math.ceil(radius_km / (GRID_DEGREES * km_per_lon))
        reach_y = math.ceil(radius_km / (GRID_DEGREES * 111.19))
        cell_x, cell_y = self._cell(point[0], point[1])
        found = []
        for x in range(cell_x - reach_x, cell_x + reach_x + 1):
            for y in range(cell_y - reach_y, cell_y + reach_y + 1):
                for node in self.grid.get((x, y), ()):
                    lon, lat = self.coordinates[node]
                    gap = math.hypot((lon - point[0]) * km_per_lon, (lat - point[1]) * 111.19)
                    if gap <= radius_km:
                        found.append((node, gap))
        return found

    def route(self, start: Point, end: Point, start_node: int | None = None) -> list[int] | None:
        """Shortest chain of pipelines from near `start` to near `end`, if a direct enough one exists."""
        straight = distance_km(start, end)
        radius = min(MAX_SNAP_KM, max(MIN_SNAP_KM, straight * SNAP_SHARE))
        starts = {start_node: 0.0} if start_node is not None else dict(self.near(start, radius))
        ends = dict(self.near(end, radius))
        if not starts or not ends:
            return None

        limit = straight * MAX_DETOUR

        # A* search: a node's priority is the length so far plus the straight
        # distance still to go, so the search stays in the corridor between
        # the two ends instead of spreading over the whole network.
        def to_go(node: int) -> float:
            return distance_km(list(self.coordinates[node]), end)

        best = dict(starts)
        previous: dict[int, int] = {}
        heap = [(gap + to_go(node), gap, node) for node, gap in starts.items()]
        heapq.heapify(heap)
        winner: int | None = None

        while heap:
            priority, cost, node = heapq.heappop(heap)
            if cost > best.get(node, math.inf):
                continue
            if priority > limit + radius:
                break
            if node in ends:
                winner = node
                break
            for neighbour, length in self.graph[node]:
                reached = cost + length
                if reached < best.get(neighbour, math.inf):
                    best[neighbour] = reached
                    previous[neighbour] = node
                    heapq.heappush(heap, (reached + to_go(neighbour), reached, neighbour))

        if winner is None:
            return None

        path = [winner]
        while path[-1] in previous:
            path.append(previous[path[-1]])
        path.reverse()

        length = sum(distance_km(list(self.coordinates[a]), list(self.coordinates[b])) for a, b in zip(path, path[1:]))
        # A "route" that is mostly the two snaps is not a route.
        if len(path) < 2 or length < straight * 0.6 or length > limit:
            return None

        return path


def simplify(points: list[Point]) -> list[Point]:
    """Drop points that add under SIMPLIFY_KM of detail, but never leave a long point-free stretch."""
    if len(points) < 3:
        return points

    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        if last - first < 2:
            continue
        a, b = points[first], points[last]
        scale = math.cos(math.radians(a[1]))
        ax, ay, bx, by = a[0] * scale, a[1], b[0] * scale, b[1]
        span = math.hypot(bx - ax, by - ay) or 1e-12
        worst, worst_offset = first, -1.0
        for index in range(first + 1, last):
            px, py = points[index][0] * scale, points[index][1]
            offset = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / span * 111
            if offset > worst_offset:
                worst, worst_offset = index, offset
        if worst_offset > SIMPLIFY_KM or distance_km(a, b) > MAX_POINT_SPACING_KM:
            # Too long to leave bare: split at the middle when the line is straight.
            split = worst if worst_offset > SIMPLIFY_KM else (first + last) // 2
            keep.add(split)
            stack.extend(((first, split), (split, last)))

    return [points[index] for index in sorted(keep)]


def snap_part(part: list[Point], network: PipelineNetwork) -> tuple[list[Point], float, float]:
    """One polyline with its straight stretches replaced where OSM has the route.

    Returns the new polyline, the km replaced and the km tried.
    """
    line: list[Point] = []
    last_node: int | None = None
    snapped_km = tried_km = 0.0

    for start, end in zip(part, part[1:]):
        stretch = distance_km(start, end)
        path = None
        if stretch >= MIN_STRETCH_KM:
            tried_km += stretch
            path = (last_node is not None and network.route(start, end, last_node)) or network.route(start, end)

        if path:
            snapped_km += stretch
            route = simplify([[round(value, 5) for value in network.coordinates[node]] for node in path])
            line.extend(route if not line else route[1:] if line[-1] == route[0] else route)
            last_node = path[-1]
        else:
            if not line:
                line.append(start)
            line.append(end)
            last_node = None

    return line, snapped_km, tried_km


def can_carry(way: dict[str, Any], substances: set[str]) -> bool:
    tags = way["tags"]
    if "substance" in tags:
        return tags["substance"].lower() in substances

    return "waterway" not in tags and not any(tags.get(key, "").lower() in NOT_HYDROCARBON for key in DESCRIPTIVE_TAGS)


def snap_pipelines(features: list[dict[str, Any]], ways: list[dict[str, Any]]) -> dict[str, float]:
    networks = {
        hydrocarbon: PipelineNetwork([way for way in ways if can_carry(way, substances)])
        for hydrocarbon, substances in OSM_SUBSTANCES.items()
    }
    totals = {"pipelines": 0, "pipelines_snapped": 0, "snapped_km": 0.0, "tried_km": 0.0}
    # GEM repeats one geometry across the segments of a system; route each once.
    cache: dict[str, tuple[list[Point], float, float]] = {}

    for feature in features:
        if feature["properties"]["status"] not in BUILT_STATUSES:
            continue

        network = networks[feature["properties"]["hydrocarbon"]]
        parts = []
        snapped_km = 0.0
        for part in get_parts(feature["geometry"]):
            key = feature["properties"]["hydrocarbon"] + json.dumps(part)
            if key not in cache:
                cache[key] = snap_part(part, network)
            line, part_snapped, part_tried = cache[key]
            parts.append(line)
            snapped_km += part_snapped
            totals["tried_km"] += part_tried

        totals["pipelines"] += 1
        totals["snapped_km"] += snapped_km
        if snapped_km > 0:
            totals["pipelines_snapped"] += 1
            feature["geometry"] = to_geometry(parts)
            feature["properties"]["routeSource"] = "OpenStreetMap"

    return totals


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--osm", type=Path, default=OSM_PATH, help="OSM pipeline extract (Overpass JSON)")
    parser.add_argument("--dry-run", action="store_true", help="report what would change without writing")
    arguments = parser.parse_args()

    payload = json.loads(PIPELINES_PATH.read_text(encoding="utf-8"))
    ways = json.loads(arguments.osm.read_text(encoding="utf-8"))["elements"]
    totals = snap_pipelines(payload["features"], ways)

    print(
        f"{totals['pipelines_snapped']} of {totals['pipelines']} pipelines got an OSM route: "
        f"{totals['snapped_km']:.0f} of {totals['tried_km']:.0f} km of straight stretches replaced"
    )
    if not arguments.dry_run:
        if "OpenStreetMap" not in payload["_metadata"]["source"]:
            payload["_metadata"]["source"] += "; routes from OpenStreetMap"
            payload["_metadata"]["license"] += "; routes ODbL"
        PIPELINES_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
