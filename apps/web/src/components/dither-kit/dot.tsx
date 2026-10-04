"use client"

import { use } from "react"
import { useChart } from "./chart-context"
import { rgb, type Seed } from "./palette"
import { SeriesContext } from "./series-context"

export type DotVariant = "border" | "colored-border" | "filled"

function dotPaint(variant: DotVariant, seed: Seed) {
  switch (variant) {
    case "colored-border":
      return {
        fill: "var(--card, #0b0b0c)",
        stroke: rgb(seed.line),
        strokeWidth: 1.5,
      }
    case "filled":
      return { fill: rgb(seed.star), stroke: rgb(seed.line), strokeWidth: 1 }
    default:
      return {
        fill: "var(--card, #0b0b0c)",
        stroke: rgb(seed.star, 0.8),
        strokeWidth: 1,
      }
  }
}

function useSeriesContextOrChart(part: string, dataKeyProp?: string) {
  const seriesCtx = use(SeriesContext)
  const chartCtx = useChart()

  if (seriesCtx) {
    return seriesCtx
  }

  const key =
    dataKeyProp ??
    chartCtx.configKeys[0] ??
    Object.keys(chartCtx.seriesSpecs)[0]
  if (key) {
    return {
      dataKey: key,
      seed: chartCtx.seedOf(key),
      dimmed: false,
    }
  }

  return null
}

/** A marker at every data point along the series' top line. */
export function Dot({
  dataKey,
  variant = "border",
  r = 2,
}: {
  dataKey?: string
  variant?: DotVariant
  r?: number
}) {
  const ctx = useChart()
  const series = useSeriesContextOrChart("Dot", dataKey)
  if (!series) return null
  const band = ctx.bands[series.dataKey]
  if (!ctx.ready || !band) return null
  const paint = dotPaint(variant, series.seed)

  return (
    // Fade in once the fill has drawn so dots don't float over the entrance.
    <g
      style={{
        opacity: ctx.entranceDone ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      {band.map((b, i) => (
        <circle
          {...paint}
          // biome-ignore lint/suspicious/noArrayIndexKey: index is the stable x position
          key={i}
          cx={ctx.xCenter(i) ?? 0}
          cy={ctx.y(b[1])}
          r={r}
        />
      ))}
    </g>
  )
}

/** A single marker at the hovered point — keys off the shared hover index. */
export function ActiveDot({
  dataKey,
  variant = "colored-border",
  r = 3,
}: {
  dataKey?: string
  variant?: DotVariant
  r?: number
}) {
  const ctx = useChart()
  const series = useSeriesContextOrChart("ActiveDot", dataKey)
  if (!series) return null
  const band = ctx.bands[series.dataKey]
  if (!ctx.ready || !band || ctx.hoverIndex == null || !ctx.entranceDone)
    return null
  const b = band[ctx.hoverIndex]
  if (!b) return null
  const paint = dotPaint(variant, series.seed)
  const cx = ctx.xCenter(ctx.hoverIndex)
  const cy = ctx.y(b[1])

  return (
    <g>
      {/* Soft halo so the active point is unmistakable over the dither. */}
      <circle cx={cx} cy={cy} r={r + 3} fill={rgb(series.seed.line, 1, 0.18)} />
      <circle cx={cx} cy={cy} r={r} {...paint} strokeWidth={2} />
    </g>
  )
}
