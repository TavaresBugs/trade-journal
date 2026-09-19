"use client";

export function HalfDonutGauge({ winRate, trades }: { winRate: number | null; trades: number }) {
  const safeRate =
    winRate !== null && Number.isFinite(winRate) ? Math.max(0, Math.min(1, winRate)) : 0;
  const wins = Math.round(safeRate * trades);
  const losses = Math.max(0, trades - wins);
  const winPct = (safeRate * 100).toFixed(1);
  const lossPct = ((1 - safeRate) * 100).toFixed(1);

  // Semicircle parameters
  // Center: (70, 68), Radius: 54
  // Start: (16, 68), End: (124, 68)
  // Arc length = PI * 54 ≈ 169.65
  const arcLength = 169.65;
  const filledLength = trades > 0 && winRate !== null ? safeRate * arcLength : 0;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-24 w-40 sm:h-28 sm:w-44">
        <svg viewBox="0 0 140 82" className="h-full w-full overflow-visible">
          {/* Base Track */}
          <path
            d="M 16 68 A 54 54 0 0 1 124 68"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className="text-muted/20"
          />
          {/* Loss Arc (underneath full span when trades > 0) */}
          {trades > 0 && (
            <path
              d="M 16 68 A 54 54 0 0 1 124 68"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              className="text-loss/35"
            />
          )}
          {/* Win Arc (drawn from left to right) */}
          {trades > 0 && filledLength > 0 && (
            <path
              d="M 16 68 A 54 54 0 0 1 124 68"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filledLength} 300`}
              className="text-profit transition-all duration-700 ease-out"
            />
          )}
          {/* Centered Percentage */}
          <text
            x="70"
            y="56"
            textAnchor="middle"
            className="fill-foreground font-mono text-2xl font-bold tracking-tight"
          >
            {trades > 0 && winRate !== null ? `${winPct}%` : "–"}
          </text>
          <text
            x="70"
            y="70"
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider"
          >
            Win Rate
          </text>
        </svg>
      </div>
      {/* Footer Pill: W/L distribution */}
      <div className="mt-1 flex items-center justify-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-profit">
          <span className="h-1.5 w-1.5 rounded-full bg-profit" />
          {wins}W ({winPct}%)
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-loss">
          <span className="h-1.5 w-1.5 rounded-full bg-loss" />
          {losses}L ({lossPct}%)
        </span>
      </div>
    </div>
  );
}
