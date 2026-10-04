"use client"

import { useEffect, useMemo, useRef } from "react"
import { useChart } from "./chart-context"
import {
  backingSize,
  bloomLayerStyle,
  clamp01,
  easeOutCubic,
  paintColumn,
  prefersReducedMotion,
} from "./dither-paint"
import { rgb, seedOfColor } from "./palette"

type Bars = { top: number[]; base: number[] } // per data index, in backing rows

// Fraction of the timeline spent staggering bar starts — the rest is each bar's
// own grow window, so the rise sweeps across the chart as a wave.
const STAGGER = 0.55

/**
 * Dither canvas for bar charts. Each category owns a band; grouped series split
 * it into side-by-side bars, stacked series share its full width and pile in y.
 * Every bar is filled with the shared {@link paintColumn} ordered dither. Bars
 * grow up from their base in a staggered left-to-right wave (eased), and the
 * hovered category lifts while the rest dim.
 */
export function BarCanvas() {
  const ctx = useChart()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bloomRef = useRef<HTMLCanvasElement>(null)

  const { width, height } = ctx.plot
  const { cols, rows } = backingSize(width, height)
  const { ready, configKeys, bands, seriesSpecs, y } = ctx

  // Memoized: per-series bar tops/bases (backing rows) over the data indices.
  // The canvas re-renders on every hover/cursor tick, so pin this map to the
  // exact ctx fields it reads plus the backing geometry — a bar hover must not
  // rebuild every band's geometry.
  const targets = useMemo(() => {
    const out: Record<string, Bars> = {}
    if (!ready) return out
    const h = height || 1
    const registered = Object.keys(seriesSpecs)
    const keys =
      registered.length > 0
        ? configKeys.filter((k) => registered.includes(k))
        : configKeys
    for (const key of keys) {
      const band = bands[key]
      if (!band) continue
      out[key] = {
        top: band.map((b) => (y(b[1]) / h) * (rows - 1)),
        base: band.map((b) => (y(b[0]) / h) * (rows - 1)),
      }
    }
    return out
  }, [ready, configKeys, bands, seriesSpecs, y, height, rows])

  // The RAF loop reads these through refs so it always sees the latest values;
  // refs are written in an effect (never during render) — mutating a ref
  // mid-render tears under Strict Mode / concurrent rendering.
  const state = useRef(ctx)
  const targetsRef = useRef(targets)
  useEffect(() => {
    state.current = ctx
    targetsRef.current = targets
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const c = canvas?.getContext("2d")
    if (!(canvas && c) || cols <= 0 || rows <= 0) return
    canvas.width = cols
    canvas.height = rows

    const bloomCanvas = bloomRef.current
    const bloomCtx = bloomCanvas?.getContext("2d") ?? null
    if (bloomCanvas) {
      bloomCanvas.width = cols
      bloomCanvas.height = rows
    }

    const reduce = prefersReducedMotion()
    const animate = state.current.animate && !reduce
    const duration = state.current.animationDuration
    const fx = cols / Math.max(width, 1)

    // Eased grow factor for bar `i` at global progress `prog`.
    const barProgress = (i: number, len: number, prog: number) => {
      if (!animate) return 1
      const start = len > 1 ? (i / (len - 1)) * STAGGER : 0
      return easeOutCubic(clamp01((prog - start) / (1 - STAGGER)))
    }

    const paint = (prog: number) => {
      const s = state.current
      c.clearRect(0, 0, cols, rows)
      const stacked = s.stackType === "stacked" || s.stackType === "percent"
      const keys = s.configKeys
      keys.forEach((key, si) => {
        const t = targetsRef.current[key]
        if (!t) return
        const conf = s.config[key]
        const negSeed = conf?.negativeColor ? seedOfColor(conf.negativeColor) : null
        const defaultSeed = s.seedOf(key)
        const variant = s.seriesSpecs[key]?.variant ?? "gradient"
        const emphasis = s.selectedDataKey ?? s.focusDataKey
        const selDim = emphasis !== null && emphasis !== key ? 0.3 : 1
        // Precompute uniform bar width in canvas backing columns for this series
        const sampleSlot = s.barSlot(0, si, keys.length)
        const floatCols = sampleSlot.width * fx
        let maxCols = floatCols

        if (keys.length > 1) {
          const nextSeriesSlot = s.barSlot(0, (si + 1) % keys.length, keys.length)
          const seriesStepCols = Math.abs(nextSeriesSlot.x - sampleSlot.x) * fx
          if (seriesStepCols > 0) {
            maxCols = seriesStepCols >= 2 ? Math.floor(seriesStepCols) - 1 : 1
          }
        } else if (s.dataLength > 1) {
          const nextCatSlot = s.barSlot(1, si, keys.length)
          const stepCols = Math.abs(nextCatSlot.x - sampleSlot.x) * fx
          maxCols = stepCols >= 2 ? Math.floor(stepCols) - 1 : 1
        }

        const barWidthCols = Math.max(
          1,
          Math.min(Math.round(floatCols), Math.max(1, Math.floor(maxCols)))
        )

        for (let i = 0; i < s.dataLength; i++) {
          const base = t.base[i] ?? rows - 1
          const rawTop = t.top[i] ?? base

          // If the bar has no height (e.g. 0% drawdown, $0 net P&L), skip painting
          if (Math.abs(rawTop - base) < 0.001) continue

          const bp = barProgress(i, s.dataLength, prog)
          const grown = base + (rawTop - base) * bp
          const isNeg = rawTop > base
          const barSeed = negSeed && isNeg ? negSeed : defaultSeed

          const grownDepth = Math.max(1, Math.round(Math.abs(grown - base)))
          const top = isNeg ? base : base - grownDepth
          const bottom = isNeg ? base + grownDepth : base

          const activeIndex = s.hoverIndex ?? s.markerIndex
          const active = activeIndex === i
          const hoverDim =
            activeIndex != null && !active && (s.isMouseInChart || s.markerIndex != null) ? 0.5 : 1

          const slot = s.barSlot(i, si, keys.length)
          const center = (slot.x + slot.width / 2) * fx
          let c0 = Math.round(center - barWidthCols / 2)
          let c1 = c0 + barWidthCols
          if (c0 < 0) {
            c0 = 0
            c1 = Math.min(cols, barWidthCols)
          } else if (c1 > cols) {
            c1 = cols
            c0 = Math.max(0, cols - barWidthCols)
          }

          for (let x = c0; x < c1; x++) {
            paintColumn(c, x, top, bottom, barSeed, {
              variant,
              intensity: intensity + (active ? 0.4 : 0),
              dim: selDim * hoverDim,
              stacked,
              inverted: isNeg,
            })
          }
        }
      })

      const marker = s.hoverIndex ?? s.markerIndex
      if (
        marker != null &&
        (s.isMouseInChart || s.markerIndex != null) &&
        marker < s.dataLength
      ) {
        const hi = marker
        keys.forEach((key, si) => {
          const t = targetsRef.current[key]
          if (!t) return
          const conf = s.config[key]
          const negSeed = conf?.negativeColor ? seedOfColor(conf.negativeColor) : null
          const defaultSeed = s.seedOf(key)
          const base = t.base[hi] ?? rows - 1
          const rawTop = t.top[hi] ?? base
          const isNeg = rawTop > base
          const pointSeed = negSeed && isNeg ? negSeed : defaultSeed
          const slot = s.barSlot(hi, si, keys.length)
          const mx = Math.round((slot.x + slot.width / 2) * fx)
          const my = Math.round(rawTop)

          // Vertical guide line in series/value color (matches EquityArea)
          c.fillStyle = rgb(pointSeed.fill, 1, 0.55)
          for (let y = my; y < rows; y++) {
            c.fillRect(mx, y, 1, 1)
          }
          // Highlight cap dot at value edge
          c.fillStyle = rgb(pointSeed.fill)
          c.fillRect(mx - 1, my - 1, 3, 3)
        })
      }
    }

    let raf = 0
    let animStart = 0
    let lastProg = -1
    let lastRevision = state.current.revision
    let intensity = 0
    let needsFill = true
    let lastPaintSig = ""
    let lastSelected: string | null | undefined = Symbol() as never
    let lastHover: number | null | undefined = Symbol() as never

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const s = state.current
      if (!s.ready) return
      if (bloomCtx) {
        const on =
          s.bloom !== "off" &&
          (!s.bloomOnHover || s.isMouseInChart || s.hovered)
        if (on) {
          bloomCtx.clearRect(0, 0, cols, rows)
          bloomCtx.drawImage(canvas, 0, 0)
        }
      }
      if (s.revision !== lastRevision) {
        lastRevision = s.revision
        animStart = 0 // re-play the wave on data change / replay
        lastProg = -1
      }
      if (!animStart) animStart = now
      const prog = animate ? Math.min(1, (now - animStart) / duration) : 1

      if (prog !== lastProg) {
        lastProg = prog
        needsFill = true
      }
      const emphasisNow = s.selectedDataKey ?? s.focusDataKey
      if (emphasisNow !== lastSelected) {
        lastSelected = emphasisNow
        needsFill = true
      }
      const activeHover = s.hoverIndex ?? s.markerIndex
      if (activeHover !== lastHover) {
        lastHover = activeHover
        needsFill = true
      }
      const itTarget = s.isMouseInChart || s.hovered ? 1 : 0
      if (Math.abs(intensity - itTarget) > 0.001) {
        intensity += (itTarget - intensity) * (reduce ? 1 : 0.16)
        needsFill = true
      } else intensity = itTarget

      // Live tweak repaint (variant, stacking) without replaying the wave.
      const paintSig = `${s.stackType}|${s.configKeys
        .map((k) => s.seriesSpecs[k]?.variant ?? "")
        .join(",")}`
      if (paintSig !== lastPaintSig) {
        lastPaintSig = paintSig
        needsFill = true
      }

      if (!needsFill) return
      paint(prog)
      needsFill = false
      if (bloomCtx) {
        const on =
          s.bloom !== "off" &&
          (!s.bloomOnHover || s.isMouseInChart || s.hovered)
        if (on) {
          bloomCtx.clearRect(0, 0, cols, rows)
          bloomCtx.drawImage(canvas, 0, 0)
        }
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [cols, rows, width])

  const bloomActive = ctx.bloomOnHover
    ? ctx.isMouseInChart || ctx.hovered
    : true
  const bloom = bloomLayerStyle(ctx.bloom, bloomActive)
  const pos = {
    left: ctx.margins.left,
    top: ctx.margins.top,
    width,
    height,
  } as const

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
        style={{ ...pos, imageRendering: "pixelated" }}
      />
      <canvas
        ref={bloomRef}
        className="pointer-events-none absolute"
        style={{
          ...pos,
          transition: "opacity 220ms ease",
          ...(bloom ?? { opacity: 0 }),
        }}
      />
    </>
  )
}
