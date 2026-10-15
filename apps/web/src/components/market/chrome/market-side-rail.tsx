import React from "react";

export type MarketSidePanelId = "objects" | "dataWindow" | "alerts" | null;

export interface MarketSideRailProps {
  sideRailHostRef: React.RefObject<HTMLElement | null>;
  activePanel: MarketSidePanelId;
  pineEditorOpen: boolean;
  alertLogsCount: number;
  isClientMounted: boolean;

  onScreenshotClick: () => void;
  onToggleAlerts: () => void;
  onToggleObjectTree: () => void;
  onToggleDataWindow: () => void;
  onTogglePineEditor: () => void;
  onOpenChartSettings: () => void;
}

export function MarketSideRail({
  sideRailHostRef,
  activePanel,
  pineEditorOpen,
  alertLogsCount,
  isClientMounted,
  onScreenshotClick,
  onToggleAlerts,
  onToggleObjectTree,
  onToggleDataWindow,
  onTogglePineEditor,
  onOpenChartSettings,
}: MarketSideRailProps) {
  return (
    <nav ref={sideRailHostRef} aria-label="Panels" className="quant-side-rail">
      {/* Top Cap with Screenshot */}
      <div className="quant-side-rail-cap">
        <button
          type="button"
          aria-label="Screenshot"
          className="quant-side-rail-corner"
          onClick={onScreenshotClick}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="shrink-0 size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.5-2.5h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
            <circle cx="12" cy="12.75" r="3.25" />
          </svg>
        </button>
      </div>

      {/* Rail Body */}
      <div className="quant-side-rail-body">
        <div className="quant-side-rail-end quant-side-rail-foot mt-auto">
          <div className="quant-side-rail-group">
            {/* Alerts button */}
            <button
              type="button"
              aria-label="Alerts"
              aria-pressed={activePanel === "alerts" ? "true" : "false"}
              data-rail-item="dock-alerts"
              data-open={activePanel === "alerts" ? "1" : undefined}
              className="quant-side-rail-row"
              onClick={onToggleAlerts}
            >
              <span className="quant-side-rail-tile relative">
                <span className="quant-side-rail-icon">
                  <span aria-hidden="true" className="quant-side-rail-vela-icon">
                    <span className="vela-icon" aria-hidden="true">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="8 7 28 28"
                        width="1em"
                        height="1em"
                        fill="none"
                      >
                        <path
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="0.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M35 14.66 29.16 9l-.7.72 5.84 5.66.7-.72ZM9 14.66 14.84 9l.7.72-5.84 5.66-.7-.72ZM22 16v7h-5v1h6v-8h-1Z"
                        />
                        <path
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="0.75"
                          strokeLinejoin="round"
                          fillRule="evenodd"
                          d="M22 33a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm0-1a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
                        />
                      </svg>
                    </span>
                  </span>
                </span>
                {isClientMounted && alertLogsCount > 0 && (
                  <div className="counterRow-SEyQozUN absolute top-[1px] right-[2px] pointer-events-none z-10">
                    <span className="counter-Afd6t4Zj min-w-[13px] h-[13px] px-[2.5px] text-[9px] font-semibold leading-[13px] text-white bg-[#f23645] rounded-full border border-[#131722] flex items-center justify-center shadow-xs">
                      {alertLogsCount > 99 ? "99+" : alertLogsCount}
                    </span>
                  </div>
                )}
              </span>
            </button>

            {/* Pine editor button */}
            <button
              type="button"
              aria-label="Pine editor"
              aria-pressed={pineEditorOpen ? "true" : "false"}
              data-rail-item="dock-vela-pro.code"
              data-open={pineEditorOpen ? "1" : undefined}
              className="quant-side-rail-row"
              onClick={onTogglePineEditor}
            >
              <span className="quant-side-rail-tile">
                <span className="quant-side-rail-icon">
                  <span aria-hidden="true" className="quant-side-rail-vela-icon">
                    <span className="vela-icon" aria-hidden="true">
                      <svg
                        viewBox="0 0 16 16"
                        width="1em"
                        height="1em"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5.5 4.5-4 3.5 4 3.5M10.5 4.5l4 3.5-4 3.5" />
                      </svg>
                    </span>
                  </span>
                </span>
              </span>
            </button>

            {/* Object tree button */}
            <button
              type="button"
              aria-label="Object tree"
              aria-pressed={activePanel === "objects" ? "true" : "false"}
              data-rail-item="dock-objects"
              data-open={activePanel === "objects" ? "1" : undefined}
              className="quant-side-rail-row"
              onClick={onToggleObjectTree}
            >
              <span className="quant-side-rail-tile">
                <span className="quant-side-rail-icon">
                  <span aria-hidden="true" className="quant-side-rail-vela-icon">
                    <span className="vela-icon" aria-hidden="true">
                      <svg
                        viewBox="0 0 16 16"
                        width="1em"
                        height="1em"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M8 1.8 14 5 8 8.2 2 5z" />
                        <path d="M2 8l6 3.2L14 8" opacity="0.7" />
                        <path d="M2 11l6 3.2 6-3.2" opacity="0.4" />
                      </svg>
                    </span>
                  </span>
                </span>
              </span>
            </button>

            {/* Data window button */}
            <button
              type="button"
              aria-label="Data window"
              aria-pressed={activePanel === "dataWindow" ? "true" : "false"}
              data-rail-item="dock-dataWindow"
              data-open={activePanel === "dataWindow" ? "1" : undefined}
              className="quant-side-rail-row"
              onClick={onToggleDataWindow}
            >
              <span className="quant-side-rail-tile">
                <span className="quant-side-rail-icon">
                  <span aria-hidden="true" className="quant-side-rail-vela-icon">
                    <span className="vela-icon" aria-hidden="true">
                      <svg
                        viewBox="0 0 16 16"
                        width="1em"
                        height="1em"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="1.8" y="2.5" width="12.4" height="11" rx="1.5" />
                        <path d="M4.5 5.5h4M4.5 8h7M4.5 10.5h5.5" />
                      </svg>
                    </span>
                  </span>
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Cap with Chart Settings */}
      <div className="quant-side-rail-cap quant-side-rail-cap-foot">
        <button
          type="button"
          aria-label="Chart settings"
          data-rail-item="chart-settings"
          className="quant-side-rail-row"
          onClick={onOpenChartSettings}
        >
          <span className="quant-side-rail-tile">
            <span className="quant-side-rail-icon">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="quant-side-rail-settings-icon"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 3v14m5-14v14m5-14v14M3 7h4m1 6h4m1-8h4" />
              </svg>
            </span>
          </span>
        </button>
      </div>
    </nav>
  );
}
