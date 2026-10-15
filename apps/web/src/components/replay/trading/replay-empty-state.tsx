"use client";

import React from "react";

export function ReplayEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 select-none bg-[#151619] min-h-[200px]">
      <div className="flex flex-col items-center justify-center text-center max-w-[380px]">
        {/* Document / Chart Icon */}
        <div className="mb-3 text-[#434651] flex items-center justify-center w-14 h-14 rounded-full bg-[#1e1f24]/60 border border-[#2a2b30]/60">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M8 17l3-3 2 2 3-4" stroke="#2962ff" />
          </svg>
        </div>

        {/* Title */}
        <strong className="text-[#f0f3fa] text-base font-semibold mb-1 tracking-tight">
          No data here, yet
        </strong>

        {/* Subtitle */}
        <div className="text-[#9a9ea8] text-xs leading-relaxed max-w-[320px]">
          Choose a bar or date in Bar Replay and place at least one trade to see results.
        </div>
      </div>
    </div>
  );
}
