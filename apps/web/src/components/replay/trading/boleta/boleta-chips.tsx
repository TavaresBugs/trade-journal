import React from "react";
import { BOLETA_COLORS, getBoletaTextWidth } from "./boleta-tokens";

interface DraftChipProps {
  type: "TP" | "SL";
  qty: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

export const BoletaDraftChip: React.FC<DraftChipProps> = ({
  type,
  qty,
  onPointerDown,
  onClick,
  isDragging = false,
}) => {
  const isTp = type === "TP";
  const color = isTp ? BOLETA_COLORS.tp : BOLETA_COLORS.sl;
  const label = isTp ? "Take profit" : "Stop loss";
  const dataComponent = isTp ? "draft-chip-tp" : "draft-chip-sl";

  const qtyStr = qty.toString();
  const qtyWidth = qtyStr.length * 7.2;
  const labelWidth = getBoletaTextWidth(label);
  const xDivider = 20 + qtyWidth + 4;
  const xLabel = xDivider + 7;
  const W = Math.max(isTp ? 116.65 : 106.97, Math.round(xLabel + labelWidth + 8 + 8));
  const H = 24;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      data-component={dataComponent}
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={`select-none cursor-grab active:cursor-grabbing shrink-0 overflow-visible transition-transform ${
        isDragging ? "scale-[1.03]" : ""
      }`}
      style={{
        filter: isDragging ? `drop-shadow(0 0 8px ${color}80)` : undefined,
      }}
    >
      {/* Background Fill + Border Path */}
      <path
        d={`M 4 0 H ${W - 8} L ${W} 12 L ${W - 8} 24 H 4 Q 0 24 0 20 V 4 Q 0 0 4 0 Z`}
        fill="#0F1115"
        fillOpacity="0.92"
        stroke={color}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {/* 6 Grip Dots */}
      <g fill="#FFFFFF" fillOpacity="0.6">
        <circle cx="9" cy="8" r="1" />
        <circle cx="13" cy="8" r="1" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="13" cy="12" r="1" />
        <circle cx="9" cy="16" r="1" />
        <circle cx="13" cy="16" r="1" />
      </g>

      {/* Quantity */}
      <text
        x="20"
        y="12.5"
        fontSize="12"
        fontWeight="600"
        fill="#FFFFFF"
        textAnchor="start"
        dominantBaseline="middle"
        className="font-mono"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {qty}
      </text>

      {/* Divider */}
      <line
        x1={xDivider}
        y1="6"
        x2={xDivider}
        y2="18"
        stroke="#FFFFFF"
        strokeOpacity="0.25"
        strokeWidth="1"
      />

      {/* Label */}
      <text
        x={xLabel}
        y="12.5"
        fontSize="12"
        fontWeight="500"
        fill={color}
        textAnchor="start"
        dominantBaseline="middle"
        className="font-sans"
      >
        {label}
      </text>
    </svg>
  );
};

interface ValueChipProps {
  type: "TP" | "SL";
  qty: number;
  usdAmount: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

export const BoletaValueChip: React.FC<ValueChipProps> = ({
  type,
  qty,
  usdAmount,
  onPointerDown,
  onClick,
  onDoubleClick,
  onContextMenu,
  isDragging = false,
}) => {
  const isTp = type === "TP";
  const color = isTp ? BOLETA_COLORS.tp : BOLETA_COLORS.sl;
  const dataComponent = isTp ? "tp-value-chip" : "sl-value-chip";

  const formattedUsd = `${usdAmount >= 0 ? "+" : "−"}${Math.abs(usdAmount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;

  const qtyStr = qty.toString();
  const qtyWidth = qtyStr.length * 7.2;
  const labelWidth = getBoletaTextWidth(formattedUsd);
  const xDivider = 20 + qtyWidth + 4;
  const xLabel = xDivider + 7;
  const W = Math.max(122, Math.round(xLabel + labelWidth + 8 + 8));
  const H = 26;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      data-component={dataComponent}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`select-none cursor-grab active:cursor-grabbing shrink-0 overflow-visible transition-transform ${
        isDragging ? "scale-[1.03]" : ""
      }`}
      style={{
        filter: isDragging ? `drop-shadow(0 0 8px ${color}80)` : undefined,
      }}
    >
      {/* Background Fill + Border Path */}
      <path
        d={`M 4 0 H ${W - 8} L ${W} 13 L ${W - 8} 26 H 4 Q 0 26 0 22 V 4 Q 0 0 4 0 Z`}
        fill="#0F1115"
        fillOpacity="0.92"
        stroke={color}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {/* 6 Grip Dots */}
      <g fill="#FFFFFF" fillOpacity="0.6">
        <circle cx="9" cy="9" r="1" />
        <circle cx="13" cy="9" r="1" />
        <circle cx="9" cy="13" r="1" />
        <circle cx="13" cy="13" r="1" />
        <circle cx="9" cy="17" r="1" />
        <circle cx="13" cy="17" r="1" />
      </g>

      {/* Quantity */}
      <text
        x="20"
        y="13.5"
        fontSize="12"
        fontWeight="600"
        fill="#FFFFFF"
        textAnchor="start"
        dominantBaseline="middle"
        className="font-mono"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {qty}
      </text>

      {/* Divider */}
      <line
        x1={xDivider}
        y1="7"
        x2={xDivider}
        y2="19"
        stroke="#FFFFFF"
        strokeOpacity="0.25"
        strokeWidth="1"
      />

      {/* Formatted USD */}
      <text
        x={xLabel}
        y="13.5"
        fontSize="12"
        fontWeight="600"
        fill={color}
        textAnchor="start"
        dominantBaseline="middle"
        className="font-mono"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {formattedUsd}
      </text>
    </svg>
  );
};

interface PlaceholderCapsuleProps {
  type: "TP" | "SL";
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}

export const BoletaPlaceholderCapsule: React.FC<PlaceholderCapsuleProps> = ({
  type,
  onPointerDown,
  onClick,
}) => {
  const isTp = type === "TP";
  const color = isTp ? BOLETA_COLORS.tp : BOLETA_COLORS.sl;
  const label = isTp ? "+TP" : "+SL";
  const dataComponent = isTp ? "placeholder-tp" : "placeholder-sl";
  const labelWidth = getBoletaTextWidth(label);
  const W = Math.round(28 + labelWidth);
  const H = 24;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      data-component={dataComponent}
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="select-none cursor-grab active:cursor-grabbing shrink-0 overflow-visible transition-transform hover:scale-105 active:scale-95 shadow-sm"
    >
      <rect
        x="0"
        y="0"
        width={W}
        height={H}
        rx="12"
        fill="#0F1115"
        fillOpacity="0.92"
        stroke={color}
        strokeWidth="1"
      />
      {/* 6 Grip Dots */}
      <g fill="#FFFFFF" fillOpacity="0.6">
        <circle cx="8" cy="8" r="1" />
        <circle cx="12" cy="8" r="1" />
        <circle cx="8" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="8" cy="16" r="1" />
        <circle cx="12" cy="16" r="1" />
      </g>
      {/* Text "+TP" / "+SL" */}
      <text
        x="19"
        y="12.5"
        fontSize="12"
        fontWeight="500"
        fill={color}
        textAnchor="start"
        dominantBaseline="middle"
        className="font-sans"
      >
        {label}
      </text>
    </svg>
  );
};

