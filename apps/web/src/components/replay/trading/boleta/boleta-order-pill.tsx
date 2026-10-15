import React from "react";
import { BOLETA_COLORS, formatBoletaPnlUsd, getBoletaTextWidth } from "./boleta-tokens";

interface BoletaOrderPillProps {
  qty: number;
  orderType: string;
  pnlUsd?: number;
  color?: string;
  isSelected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClickQty?: (e: React.MouseEvent) => void;
  onClickOrderType?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

export const BoletaOrderPill: React.FC<BoletaOrderPillProps> = ({
  qty,
  orderType,
  pnlUsd,
  color = BOLETA_COLORS.buy,
  isSelected = false,
  onPointerDown,
  onClickQty,
  onClickOrderType,
  onContextMenu,
  onDoubleClick,
  isDragging = false,
}) => {
  const qtyStr = qty.toString();
  const qtyWidth = qtyStr.length * 7.2;
  const labelWidth = getBoletaTextWidth(orderType);

  if (isSelected) {
    // Selected Pill (E3, E4, E5): "[quantidade] | [resultado em USD]"
    // Cor da silhueta e do texto: Azul (#3D5AFE) para Buy e Vermelho (#E0474C) para Sell.
    // Sem Long ou Short (o tipo de ordem só fica quando está a Limit ou Stop em E1/E2/E6).
    const displayLabel = pnlUsd !== undefined ? formatBoletaPnlUsd(pnlUsd) : orderType;
    const displayLabelWidth = getBoletaTextWidth(displayLabel);
    const pnlColor =
      pnlUsd !== undefined
        ? pnlUsd > 0
          ? "#089981"
          : pnlUsd < 0
          ? "#f23645"
          : "#9a9ea8"
        : color;

    // Grip dots: Colunas cx=5.2 e cx=9.2 (raio 1.2).
    // Borda esquerda do grip = 4.0px. Margem esquerda = 4.0px.
    // Borda direita do grip = 10.4px. Tag interna começa em x=14.4px -> Margem direita = 4.0px (perfeita simetria).
    const xQty = 19.5;
    const xDivider = Math.round(xQty + qtyWidth + 4);
    const xLabel = xDivider + 6;
    const W = Math.max(68, Math.round(xLabel + displayLabelWidth + 14));
    const H = 32;

    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        data-component="order-pill"
        data-selected="true"
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        className={`select-none cursor-grab active:cursor-grabbing shrink-0 overflow-visible transition-transform ${
          isDragging ? "scale-[1.03]" : ""
        }`}
        style={{
          filter: isDragging ? `drop-shadow(0 0 8px ${color}80)` : undefined,
        }}
      >
        {/* Layer 1: Solid Outer Silhouette (32px high, 8px radius on left, 8px chevron tip on right) */}
        <path
          d={`M 8 0 H ${W - 8} L ${W} 16 L ${W - 8} 32 H 8 Q 0 32 0 24 V 8 Q 0 0 8 0 Z`}
          fill={color}
        />

        {/* Layer 2: 6 White Opaque Grip Dots (simetria exata de 4px à esquerda e 4px à direita) */}
        <g fill="#FFFFFF">
          <circle cx="5.2" cy="12" r="1.2" />
          <circle cx="9.2" cy="12" r="1.2" />
          <circle cx="5.2" cy="16" r="1.2" />
          <circle cx="9.2" cy="16" r="1.2" />
          <circle cx="5.2" cy="20" r="1.2" />
          <circle cx="9.2" cy="20" r="1.2" />
        </g>

        {/* Layer 3: Dark Inner Tag starting at x=14.4 (exatos 4.0px de margem do handle) */}
        <path
          d={`M 18.4 3 H ${W - 11} L ${W - 3} 16 L ${W - 11} 29 H 18.4 Q 14.4 29 14.4 25 V 7 Q 14.4 3 18.4 3 Z`}
          fill="#0F1115"
          fillOpacity="0.92"
        />

        {/* Quantity (with clickable hit-box for lot sizing) */}
        <rect
          x={xQty - 2}
          y="4"
          width={qtyWidth + 6}
          height="24"
          fill="transparent"
          className="cursor-pointer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClickQty?.(e);
          }}
        />
        <text
          x={xQty}
          y="16.5"
          fontSize="12"
          fontWeight="600"
          fill="#FFFFFF"
          textAnchor="start"
          dominantBaseline="middle"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClickQty?.(e);
          }}
          className="cursor-pointer hover:underline font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <title>Change order quantity</title>
          {qty}
        </text>

        {/* Vertical Divider */}
        <line
          x1={xDivider}
          y1="10"
          x2={xDivider}
          y2="22"
          stroke="#FFFFFF"
          strokeOpacity="0.25"
          strokeWidth="1"
        />

        {/* PnL Result in USD (in operation E3/E4/E5) */}
        <text
          x={xLabel}
          y="16.5"
          fontSize="12"
          fontWeight="600"
          fill={pnlColor}
          textAnchor="start"
          dominantBaseline="middle"
          className="font-mono"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {displayLabel}
        </text>
      </svg>
    );
  }

  // Normal / Projection / Position Pill: Height 26px
  const xDivider = 20 + qtyWidth + 4;
  const xLabel = xDivider + 7;
  const W = Math.max(81.65, Math.round(xLabel + labelWidth + 8 + 8));
  const H = 26;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      data-component="order-pill"
      data-selected="false"
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
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
      <rect
        x="15"
        y="2"
        width={qtyWidth + 10}
        height="22"
        fill="transparent"
        className="cursor-pointer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClickQty?.(e);
        }}
      >
        <title>Change order quantity</title>
      </rect>
      <text
        x="20"
        y="13.5"
        fontSize="12"
        fontWeight="600"
        fill="#FFFFFF"
        textAnchor="start"
        dominantBaseline="middle"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClickQty?.(e);
        }}
        className="cursor-pointer hover:underline font-mono"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <title>Change order quantity</title>
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

      {/* Order Type Label (clickable if onClickOrderType is provided) */}
      {onClickOrderType && (
        <rect
          x={xLabel - 2}
          y="2"
          width={labelWidth + 8}
          height="22"
          fill="transparent"
          className="cursor-pointer"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClickOrderType(e);
          }}
        />
      )}
      <text
        x={xLabel}
        y="13.5"
        fontSize="12"
        fontWeight="500"
        fill={color}
        textAnchor="start"
        dominantBaseline="middle"
        onPointerDown={onClickOrderType ? (e) => e.stopPropagation() : undefined}
        onClick={onClickOrderType ? (e) => {
          e.stopPropagation();
          onClickOrderType(e);
        } : undefined}
        className={`font-sans ${onClickOrderType ? "cursor-pointer hover:underline" : ""}`}
      >
        {orderType}
      </text>
    </svg>
  );
};
