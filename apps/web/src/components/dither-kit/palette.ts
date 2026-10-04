// Shared seed palette for the dither chart family. Mirrors the seeds in
// `dither-chart.tsx` so a series rendered through the composable engine reads
// with the exact same fill / line / star hues as the legacy sparkline.

export type Rgb = [number, number, number]

export type DitherColor =
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "orange"
  | "red"
  | "grey"

export type Seed = { fill: Rgb; line: Rgb; star: Rgb }

// Each seed: the area-fill hue, the bright series line, and the star sparkle.
// Aligned exactly with TradeJournal tokens: --profit (#0ca30c), --loss (#d03b3b), --brand (#1197e2)
export const PALETTE: Record<DitherColor, Seed> = {
  green: { fill: [12, 163, 12], line: [70, 210, 70], star: [150, 240, 150] },
  blue: { fill: [17, 151, 226], line: [100, 190, 250], star: [180, 225, 255] },
  purple: {
    fill: [150, 110, 255],
    line: [200, 175, 255],
    star: [225, 210, 255],
  },
  pink: { fill: [240, 90, 190], line: [255, 170, 220], star: [255, 205, 235] },
  orange: {
    fill: [255, 150, 50],
    line: [255, 195, 130],
    star: [255, 220, 175],
  },
  red: { fill: [208, 59, 59], line: [235, 105, 105], star: [250, 175, 175] },
  // No-data: a muted grey so empty metrics read as "nothing here".
  grey: { fill: [92, 92, 100], line: [140, 140, 150], star: [165, 165, 175] },
}

export const rgb = ([r, g, b]: Rgb, k = 1, a = 1) =>
  `rgba(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)},${a})`

export const seedOfColor = (color: DitherColor | string): Seed => {
  if (color in PALETTE) return PALETTE[color as DitherColor]
  if (typeof color === "string" && color.startsWith("#") && color.length >= 7) {
    const r = parseInt(color.slice(1, 3), 16) || 0
    const g = parseInt(color.slice(3, 5), 16) || 0
    const b = parseInt(color.slice(5, 7), 16) || 0
    return {
      fill: [r, g, b],
      line: [Math.min(255, r + 50), Math.min(255, g + 50), Math.min(255, b + 50)],
      star: [Math.min(255, r + 100), Math.min(255, g + 100), Math.min(255, b + 100)],
    }
  }
  return PALETTE.grey
}

export const isDitherColor = (value: unknown): value is DitherColor =>
  typeof value === "string" && value in PALETTE
