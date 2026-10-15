import React from "react";
import { BOLETA_COLORS } from "./boleta-tokens";

interface BoletaAxisLabelProps {
  id?: string;
  y?: number;
  price: string;
  oldPrice?: string | null;
  bg?: string;
  textColor?: string;
  dataComponent?: string;
}

export const BoletaAxisLabel: React.FC<BoletaAxisLabelProps> = ({
  id,
  y = 0,
  price,
  oldPrice,
  bg = BOLETA_COLORS.buy,
  textColor = "#FFFFFF",
  dataComponent = "axis-label-entry",
}) => {
  return (
    <div
      id={id}
      data-component={dataComponent}
      className="absolute flex flex-col items-start pointer-events-none z-40"
      style={{
        top: `${y}px`,
        left: "100%",
        transform: "translateY(-50%)",
      }}
    >
      {/* 64x20px Primary Label matching Vela price scale gutter */}
      <div
        className="w-[64px] h-[19px] px-1.5 flex items-center justify-start font-mono text-[11px] font-semibold select-none shadow-sm rounded-r-[2px]"
        style={{
          backgroundColor: bg,
          color: textColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {price}
      </div>

      {/* Old Price faded below during editing (axis-label-old) */}
      {oldPrice && (
        <span
          data-component="axis-label-old"
          className="text-[11px] font-mono select-none pt-0.5"
          style={{
            color: "rgba(138, 143, 156, 0.65)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {oldPrice}
        </span>
      )}
    </div>
  );
};
