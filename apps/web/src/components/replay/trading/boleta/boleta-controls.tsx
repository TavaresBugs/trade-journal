import React from "react";
import { BOLETA_COLORS } from "./boleta-tokens";

interface CancelButtonProps {
  color?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  dataComponent?: string;
  className?: string;
}

export const BoletaCancelButton: React.FC<CancelButtonProps> = ({
  color = "#E0474C",
  onClick,
  title = "Cancel",
  dataComponent = "cancel-button",
  className = "",
}) => {
  return (
    <button
      type="button"
      data-component={dataComponent}
      onClick={onClick}
      title={title}
      className={`w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm cursor-pointer shrink-0 ${className}`}
      style={{
        backgroundColor: "#0F1115",
        border: `1.5px solid ${color}`,
      }}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path
          d="M1 1L7 7M7 1L1 7"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
};

export interface AlertButtonProps {
  state?: "idle" | "hover" | "active";
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  dataComponent?: string;
  className?: string;
}

/**
 * 1:1 Alert Button from prototipo_botao_alerta.svg:
 * - Outer ring: amber #F0A030 (1.5px standard, 2px on hover, solid fill on active)
 * - Inner clock ring, bells and hands: blue #3D5AFE (turns dark #0F1115 on active)
 * - Plus (+) symbol: amber #F0A030 (turns dark #0F1115 on active)
 * - Size: 22x22px (r=11 circle)
 */
export const BoletaAlertButton: React.FC<AlertButtonProps> = ({
  state = "idle",
  onClick,
  title = "Alert",
  dataComponent = "alert-button",
  className = "",
}) => {
  const isActive = state === "active";
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      type="button"
      data-component={dataComponent}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
      className={`w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm cursor-pointer shrink-0 ${className}`}
      style={{
        backgroundColor: isActive
          ? "#F0A030"
          : isHovered
            ? "rgba(240, 160, 48, 0.3)"
            : "#0F1115",
        border: isActive
          ? "1.5px solid #F0A030"
          : isHovered
            ? "2px solid #F0A030"
            : "1.5px solid #F0A030",
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        className="shrink-0"
      >
        <g
          transform="translate(3.8 2.9) scale(0.6)"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Clock body */}
          <circle
            cx="12"
            cy="13.5"
            r="7.5"
            stroke={isActive ? "#0F1115" : "#3D5AFE"}
          />
          {/* Bells & Hands */}
          <path
            d="M3 6 L6 3 M21 6 L18 3 M12 10 V13.5 L14 15"
            stroke={isActive ? "#0F1115" : "#3D5AFE"}
          />
          {/* Plus (+) */}
          <path
            d="M18.5 16 V21 M16 18.5 H21"
            stroke={isActive ? "#0F1115" : "#F0A030"}
          />
        </g>
      </svg>
    </button>
  );
};

interface ActionButtonProps {
  side: "buy" | "sell";
  onClick?: (e: React.MouseEvent) => void;
}

export const BoletaActionButton: React.FC<ActionButtonProps> = ({ side, onClick }) => {
  const isBuy = side === "buy";
  const bg = isBuy ? BOLETA_COLORS.buy : BOLETA_COLORS.sell;

  return (
    <button
      type="button"
      data-component="action-button"
      onClick={onClick}
      className="w-[68px] h-[26px] rounded-full flex items-center justify-center text-[12px] font-semibold text-white transition-transform hover:brightness-110 active:scale-95 shadow-sm"
      style={{ backgroundColor: bg }}
    >
      {isBuy ? "Buy" : "Sell"}
    </button>
  );
};

interface ConfirmUndoProps {
  onConfirm?: (e: React.MouseEvent) => void;
  onUndo?: (e: React.MouseEvent) => void;
}

export const BoletaConfirmUndoGroup: React.FC<ConfirmUndoProps> = ({ onConfirm, onUndo }) => {
  return (
    <div className="flex items-center gap-1.5" data-component="confirm-undo-group">
      {/* Undo Button (↶) - Perfeitamente centralizado em (11, 11) */}
      <button
        type="button"
        data-component="undo-button"
        onClick={onUndo}
        title="Discard changes"
        className="w-[22px] h-[22px] flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shrink-0"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle
            cx="11"
            cy="11"
            r="10.25"
            fill={BOLETA_COLORS.bgSurface}
            stroke="rgba(255, 255, 255, 0.75)"
            strokeWidth="1.5"
          />
          <path
            d="M 7 9.5 H 12.2 C 14 9.5 15 10.6 15 12.1 C 15 13.6 14 14.6 12.2 14.6 H 9.5 M 9.5 7 L 7 9.5 L 9.5 12"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Confirm Button (✓) - Perfeitamente centralizado em (11, 11) */}
      <button
        type="button"
        data-component="confirm-button"
        onClick={onConfirm}
        title="Confirm changes"
        className="w-[22px] h-[22px] flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shrink-0"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="11" fill={BOLETA_COLORS.buy} />
          <path
            d="M 7 11.2 L 9.8 14 L 15.2 8.2"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
};

interface BracketHandleProps {
  type: "TP" | "SL";
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}

export const BoletaBracketHandle: React.FC<BracketHandleProps> = ({
  type,
  onPointerDown,
  onClick,
}) => {
  const isTp = type === "TP";
  const color = isTp ? BOLETA_COLORS.tp : BOLETA_COLORS.sl;
  const label = isTp ? "TP" : "SL";
  const dataComponent = isTp ? "drag-handle-tp" : "drag-handle-sl";

  return (
    <div
      data-component={dataComponent}
      onPointerDown={onPointerDown}
      onClick={onClick}
      title={`Drag to set ${isTp ? "Take Profit" : "Stop Loss"}`}
      className="flex items-center gap-1.5 px-2 h-[22px] rounded-full select-none cursor-grab active:cursor-grabbing transition-all hover:scale-105 active:scale-95 shadow-sm"
      style={{
        backgroundColor: BOLETA_COLORS.bgSurface,
        border: `1px solid ${color}80`,
      }}
    >
      {/* 6 Grip Dots (canonical 2 columns x 3 rows) */}
      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="shrink-0">
        <circle cx="1.5" cy="2" r="1" fill="#FFFFFF" fillOpacity="0.6" />
        <circle cx="4.5" cy="2" r="1" fill="#FFFFFF" fillOpacity="0.6" />
        <circle cx="1.5" cy="5" r="1" fill="#FFFFFF" fillOpacity="0.6" />
        <circle cx="4.5" cy="5" r="1" fill="#FFFFFF" fillOpacity="0.6" />
        <circle cx="1.5" cy="8" r="1" fill="#FFFFFF" fillOpacity="0.6" />
        <circle cx="4.5" cy="8" r="1" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>
      <span
        className="text-[11px] font-semibold tracking-wide font-sans leading-none"
        style={{ color }}
      >
        +{label}
      </span>
    </div>
  );
};

