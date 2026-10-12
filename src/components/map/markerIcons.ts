// Marker icons are rasterised here from simple geometry rather than
// shipped as image files, so their colours always match the energy
// palette. Pure pixel maths: no canvas, so it also runs under jsdom.

export type MarkerShape = "diamond" | "triangle";

export interface MarkerIcon {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

// Icons are registered at pixelRatio 2, so 48px draws as 24 CSS px at icon-size 1.
export const MARKER_ICON_SIZE = 48;
export const MARKER_ICON_PIXEL_RATIO = 2;

const OUTLINE_COLOR: [number, number, number] = [5, 5, 5];
const SUPERSAMPLES_PER_AXIS = 4;

// Triangle vertices in a [-1, 1] box, pointing up.
const TRIANGLE: Array<[number, number]> = [
  [0, -0.86],
  [0.92, 0.72],
  [-0.92, 0.72]
];
const TRIANGLE_CENTROID_Y = (TRIANGLE[0][1] + TRIANGLE[1][1] + TRIANGLE[2][1]) / 3;

function isInsideDiamond(x: number, y: number, scale: number) {
  return Math.abs(x) + Math.abs(y) <= 0.94 * scale;
}

function isInsideTriangle(x: number, y: number, scale: number) {
  // Shrink towards the centroid so the outline is even on all three sides.
  const [a, b, c] = TRIANGLE.map(([vx, vy]) => [vx * scale, TRIANGLE_CENTROID_Y + (vy - TRIANGLE_CENTROID_Y) * scale]);
  const edge = (p: number[], q: number[]) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const d1 = edge(a, b);
  const d2 = edge(b, c);
  const d3 = edge(c, a);

  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function parseHexColor(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * A filled shape with a thin dark outline, anti-aliased by supersampling.
 * The outline keeps markers legible where they overlap or sit on imagery.
 */
export function buildMarkerIcon(shape: MarkerShape, fillHex: string): MarkerIcon {
  const size = MARKER_ICON_SIZE;
  const data = new Uint8ClampedArray(size * size * 4);
  const fill = parseHexColor(fillHex);
  const isInside = shape === "diamond" ? isInsideDiamond : isInsideTriangle;
  const fillScale = shape === "diamond" ? 0.8 : 0.72;
  const samples = SUPERSAMPLES_PER_AXIS * SUPERSAMPLES_PER_AXIS;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let outlineHits = 0;
      let fillHits = 0;

      for (let sy = 0; sy < SUPERSAMPLES_PER_AXIS; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLES_PER_AXIS; sx += 1) {
          const x = ((px + (sx + 0.5) / SUPERSAMPLES_PER_AXIS) / size) * 2 - 1;
          const y = ((py + (sy + 0.5) / SUPERSAMPLES_PER_AXIS) / size) * 2 - 1;

          if (isInside(x, y, 1)) {
            outlineHits += 1;

            if (isInside(x, y, fillScale)) {
              fillHits += 1;
            }
          }
        }
      }

      if (outlineHits === 0) {
        continue;
      }

      const fillShare = fillHits / outlineHits;
      const offset = (py * size + px) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = Math.round(fill[channel] * fillShare + OUTLINE_COLOR[channel] * (1 - fillShare));
      }
      data[offset + 3] = Math.round((outlineHits / samples) * 255);
    }
  }

  return { data, height: size, width: size };
}
