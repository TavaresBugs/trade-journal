"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useCommonChart } from "./common-context"
import { cn } from "./lib"
import { rgb } from "./palette"

export type TooltipVariant = "default" | "frosted-glass"

const VARIANT: Record<TooltipVariant, string> = {
  default: "bg-popover",
  "frosted-glass": "bg-popover/70 backdrop-blur-sm",
}

/**
 * Floating hover tooltip. Reads the shared common context so it works in every
 * chart family. It glides between points and fades in/out (instead of snapping),
 * and dims unselected series/slices.
 */
export function Tooltip({
  labelKey,
  valueFormatter,
  variant = "default",
}: {
  labelKey?: string
  valueFormatter?: (value: number, name: string) => string
  variant?: TooltipVariant
}) {
  const chart = useCommonChart()
  const show = chart.ready && chart.hoverIndex != null

  // Retain the last hovered index so the card keeps its content while fading
  // out — adjust-state-during-render (no refs in render).
  const [lastIndex, setLastIndex] = useState(0)
  if (chart.hoverIndex != null && chart.hoverIndex !== lastIndex) {
    setLastIndex(chart.hoverIndex)
  }
  const index = chart.hoverIndex ?? lastIndex

  const heading = chart.heading(index, labelKey)
  const items = chart.itemsAt(index)

  return (
    <AnimatePresence>
      {show && items.length > 0 && (
        <motion.div
          key="dither-tooltip"
          initial={{
            opacity: 0,
            x: "-50%",
            y: "-115%",
            top: chart.tooltipTop,
            left: chart.tooltipLeft,
          }}
          animate={{
            opacity: 1,
            x: "-50%",
            y: "-115%",
            top: chart.tooltipTop,
            left: chart.tooltipLeft,
          }}
          exit={{ opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 520,
            damping: 38,
            mass: 0.6,
          }}
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm",
            VARIANT[variant]
          )}
        >
          {heading && (
            <div className="mb-1.5 border-b border-border/50 pb-1 text-center font-mono text-[10px] tracking-wide text-muted-foreground">
              {heading}
            </div>
          )}
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2 font-mono text-[11px] tabular-nums"
                style={{ opacity: item.dimmed ? 0.4 : 1 }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 shrink-0 rounded-[1px]"
                    style={{ backgroundColor: rgb(item.seed.fill) }}
                  />
                  <span className="leading-none text-muted-foreground">{item.label}</span>
                </div>
                <span
                  className="ml-auto pl-3 font-semibold leading-none"
                  style={{ color: rgb(item.seed.fill) }}
                >
                  {valueFormatter
                    ? valueFormatter(item.value, item.name)
                    : item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

Tooltip.chartLayer = "dom" as const
