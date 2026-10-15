"use client";

import React from "react";

interface ReplayExitWarningProps {
  onExitReplay?: () => void;
}

export function ReplayExitWarning({ onExitReplay }: ReplayExitWarningProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 select-none bg-[#151619] min-h-[200px]">
      <div className="flex flex-col items-center justify-center text-center max-w-[400px]">
        {/* Warning Icon */}
        <div className="mb-3 text-[#f59e0b] flex items-center justify-center w-12 h-12 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Title */}
        <strong className="text-[#f0f3fa] text-base font-semibold mb-1 tracking-tight">
          You&apos;re in replay mode
        </strong>

        {/* Text */}
        <div className="text-[#9a9ea8] text-xs leading-relaxed mb-4 max-w-[340px]">
          You can&apos;t work with real orders and positions while replay mode is on. Exit it to dive into real trading.
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onExitReplay}
          className="px-4 py-1.5 rounded text-xs font-semibold bg-[#2962ff] text-white hover:bg-[#1e53e5] active:bg-[#1848cc] transition-colors shadow-sm"
        >
          Exit replay mode
        </button>
      </div>
    </div>
  );
}
