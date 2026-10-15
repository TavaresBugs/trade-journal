import React from "react";
import { BOLETA_COLORS } from "./boleta-tokens";

interface BoletaZoneProps {
  type: "TP" | "SL";
  entryY: number;
  targetY: number;
}

export const BoletaZone: React.FC<BoletaZoneProps> = ({ type, entryY, targetY }) => {
  const isTp = type === "TP";
  const color = isTp ? BOLETA_COLORS.tp : BOLETA_COLORS.sl;
  const dataComponent = isTp ? "zone-tp" : "zone-sl";

  const top = Math.min(entryY, targetY);
  const height = Math.abs(entryY - targetY);

  if (height <= 1) return null;

  return (
    <div
      data-component={dataComponent}
      className="absolute pointer-events-none z-[1]"
      style={{
        left: 0,
        right: 0,
        width: "100%",
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: color,
        opacity: 0.14,
      }}
    />
  );
};
