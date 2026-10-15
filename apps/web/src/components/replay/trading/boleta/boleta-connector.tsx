import React from "react";
import { BOLETA_COLORS } from "./boleta-tokens";

interface BoletaConnectorProps {
  tpY: number | null;
  entryY: number;
  slY: number | null;
  orderColor?: string;
  isTpActive?: boolean;
  isSlActive?: boolean;
}

export const BoletaConnector: React.FC<BoletaConnectorProps> = ({
  tpY,
  entryY,
  slY,
  orderColor = BOLETA_COLORS.buy,
  isTpActive = false,
  isSlActive = false,
}) => {
  if (tpY === null && slY === null) return null;

  const minY = Math.min(tpY ?? entryY, slY ?? entryY, entryY);
  const maxY = Math.max(tpY ?? entryY, slY ?? entryY, entryY);

  return (
    <div
      data-component="connector-container"
      className="absolute top-0 bottom-0 pointer-events-none z-10"
      style={{ right: "20px" }} // x=940 (20px before 960px axis)
    >
      {/* Vertical Connecting Line (1.25px in orderColor) */}
      <svg
        className="absolute left-0 overflow-visible"
        style={{
          top: `${minY}px`,
          height: `${Math.max(2, maxY - minY)}px`,
          width: "12px",
          transform: "translateX(-50%)",
        }}
      >
        <line
          data-component="connector"
          x1="6"
          y1="0"
          x2="6"
          y2={maxY - minY}
          stroke={orderColor}
          strokeWidth="1.25"
        />

        {/* TP Dot */}
        {tpY !== null && (
          <circle
            data-component="connector-dot-tp"
            cx="6"
            cy={tpY - minY}
            r="5"
            fill={isTpActive ? BOLETA_COLORS.buy : BOLETA_COLORS.bgSurface}
            stroke={BOLETA_COLORS.tp}
            strokeWidth="1.5"
          />
        )}

        {/* Entry Dot (Always filled with orderColor / blue) */}
        <circle
          data-component="connector-dot-entry"
          cx="6"
          cy={entryY - minY}
          r="5"
          fill={orderColor}
          stroke={BOLETA_COLORS.bgSurface}
          strokeWidth="1.5"
        />

        {/* SL Dot */}
        {slY !== null && (
          <circle
            data-component="connector-dot-sl"
            cx="6"
            cy={slY - minY}
            r="5"
            fill={isSlActive ? BOLETA_COLORS.buy : BOLETA_COLORS.bgSurface}
            stroke={BOLETA_COLORS.sl}
            strokeWidth="1.5"
          />
        )}
      </svg>
    </div>
  );
};
