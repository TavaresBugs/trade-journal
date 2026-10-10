"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { useCommonChart } from "./common-context"
import { cn } from "./lib"
import { rgb } from "./palette"

export type TooltipVariant = "default" | "frosted-glass"

export const TOOLTIP_SURFACE_CLASSES =
  "rounded-xl border border-white/10 bg-[#121216]/80 backdrop-blur-md shadow-2xl"

const VARIANT: Record<TooltipVariant, string> = {
  default: TOOLTIP_SURFACE_CLASSES,
  "frosted-glass": TOOLTIP_SURFACE_CLASSES,
}

/**
 * Standardized header for tooltip / hover cards with subtle divider.
 */
export function TooltipHeader({
  title,
  badge,
  className,
}: {
  title: React.ReactNode
  badge?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-2 flex items-center justify-between gap-3 border-b border-white/10 pb-1 font-mono text-[10px] font-medium tracking-wide text-muted-foreground",
        className
      )}
    >
      <span>{title}</span>
      {badge}
    </div>
  )
}

/**
 * Standardized metric row with square color swatch, label, and formatted value.
 */
export function TooltipRow({
  label,
  value,
  color,
  swatchClassName,
  valueClassName,
  dimmed = false,
}: {
  label: React.ReactNode
  value: React.ReactNode
  color?: string
  swatchClassName?: string
  valueClassName?: string
  dimmed?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 font-mono text-xs tabular-nums",
        dimmed && "opacity-40"
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
        {color ? (
          <span
            className={cn("inline-block size-2 shrink-0 rounded-[1px]", swatchClassName)}
            style={{ backgroundColor: color }}
          />
        ) : swatchClassName ? (
          <span
            className={cn("inline-block size-2 shrink-0 rounded-[1px]", swatchClassName)}
          />
        ) : null}
        <span className="leading-none text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn("font-bold leading-none text-xs", valueClassName)}
        style={color && !valueClassName ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Subtle horizontal divider inside tooltip cards.
 */
export function TooltipDivider({ className }: { className?: string }) {
  return <div className={cn("border-t border-white/10 pt-1 mt-0.5", className)} />
}

/**
 * Floating hover tooltip. Reads the shared common context so it works in every
 * chart family. It glides between points and fades in/out (instead of snapping),
 * and dims unselected series/slices.
 */
export function Tooltip({
  labelKey,
  labelFormatter,
  valueFormatter,
  variant = "default",
  content,
}: {
  labelKey?: string
  labelFormatter?: (label: string, index: number) => string
  valueFormatter?: (value: number, name: string) => string
  variant?: TooltipVariant
  content?: (props: {
    index: number
    heading: React.ReactNode
    items: ReturnType<ReturnType<typeof useCommonChart>["itemsAt"]>
  }) => React.ReactNode
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

  const rawHeading = chart.heading(index, labelKey)
  const heading =
    labelFormatter && rawHeading != null
      ? labelFormatter(rawHeading, index)
      : rawHeading
  const items = chart.itemsAt(index)

  return (
    <AnimatePresence>
      {show && (content || items.length > 0) && (
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
            "pointer-events-none absolute z-50 whitespace-nowrap px-3 py-2.5",
            VARIANT[variant]
          )}
        >
          {content ? (
            content({ index, heading, items })
          ) : (
            <>
              {heading && <TooltipHeader title={heading} />}
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <TooltipRow
                    key={item.name}
                    label={item.label}
                    value={
                      valueFormatter
                        ? valueFormatter(item.value, item.name)
                        : item.value.toLocaleString()
                    }
                    color={rgb(item.seed.fill)}
                    dimmed={item.dimmed}
                  />
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

Tooltip.chartLayer = "dom" as const
