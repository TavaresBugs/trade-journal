"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";

export interface VelaToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  size?: "default" | "sm" | "compact";
  style?: React.CSSProperties;
}

export interface VelaCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  label?: React.ReactNode;
}

export interface VelaSwitchProps extends VelaToggleProps {
  variant?: "toggle" | "checkbox";
  indeterminate?: boolean;
  label?: React.ReactNode;
}

/**
 * Exact Ground-Truth Design Tokens extracted from Live Vela (Chrome DevTools + deobfuscated Next.js chunks)
 */
export const VELA_CHECKBOX_STYLE = {
  width: "17px",
  height: "17px",
  borderRadius: "4px",
  svgMarkWidth: "12px",
  svgMarkHeight: "12px",
  unchecked: {
    backgroundColor: "transparent",
    border: "1px solid rgb(42, 43, 48)",
    color: "transparent",
  },
  checked: {
    backgroundColor: "rgb(240, 243, 250)",
    border: "1px solid rgb(240, 243, 250)",
    color: "rgb(21, 22, 25)",
  },
} as const;

export const VELA_TOGGLE_STYLE = {
  width: "26px",
  height: "15px",
  borderRadius: "9999px",
  thumbWidth: "9px",
  thumbHeight: "9px",
  unchecked: {
    trackBackground: "#22242a",
    trackBorder: "1px solid rgba(52, 53, 59, 0.8)",
    thumbColor: "#6c707d",
    thumbTransform: "translateX(0px)",
  },
  checked: {
    trackBackground: "#5c606d",
    trackBorder: "1px solid #6b7080",
    thumbColor: "#ffffff",
    thumbTransform: "translateX(11px)",
  },
} as const;

/**
 * 1. Checkbox (.vela-switch):
 * Dimensions: 17x17px, border-radius: 4px
 * Unchecked: background-color: transparent; border: 1px solid rgb(42, 43, 48); color: transparent;
 * Checked: background-color: rgb(240, 243, 250); border: 1px solid rgb(240, 243, 250); color: rgb(21, 22, 25);
 * SVG Mark: 12x12px with lead, finish, and mixed paths
 */
export function VelaCheckbox({
  checked,
  onChange,
  disabled = false,
  indeterminate = false,
  ariaLabel,
  className = "",
  style,
  label,
}: VelaCheckboxProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onChange(!checked);
    }
  };

  const isChecked = checked || indeterminate;

  const button = (
    <button
      type="button"
      className={`vela-switch inline-flex items-center justify-center shrink-0 transition-colors duration-150 select-none box-border ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${className}`.trim()}
      data-size="md"
      data-tone="bright"
      data-checked={checked ? "true" : "false"}
      role="switch"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        width: VELA_CHECKBOX_STYLE.width,
        height: VELA_CHECKBOX_STYLE.height,
        borderRadius: VELA_CHECKBOX_STYLE.borderRadius,
        backgroundColor: isChecked
          ? VELA_CHECKBOX_STYLE.checked.backgroundColor
          : VELA_CHECKBOX_STYLE.unchecked.backgroundColor,
        border: isChecked
          ? VELA_CHECKBOX_STYLE.checked.border
          : VELA_CHECKBOX_STYLE.unchecked.border,
        color: isChecked ? VELA_CHECKBOX_STYLE.checked.color : VELA_CHECKBOX_STYLE.unchecked.color,
        ...style,
      }}
    >
      <span
        className="vela-icon"
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          data-slot="checkbox-mark"
          style={{
            width: VELA_CHECKBOX_STYLE.svgMarkWidth,
            height: VELA_CHECKBOX_STYLE.svgMarkHeight,
          }}
        >
          <path
            d="M3.2 8.1 6.3 11.2"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-checkbox-part="lead"
            style={{ display: indeterminate ? "none" : undefined }}
          />
          <path
            d="M6.3 11.2 12.8 4.7"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-checkbox-part="finish"
            style={{ display: indeterminate ? "none" : undefined }}
          />
          <path
            d="M3.5 8h9"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-checkbox-part="mixed"
            style={{ display: indeterminate ? undefined : "none" }}
          />
        </svg>
      </span>
    </button>
  );

  if (!label) {
    return button;
  }

  return (
    <label
      className={`inline-flex items-center gap-2.5 select-none ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      }`}
      onClick={(e) => {
        if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName === "BUTTON") {
          return;
        }
        if (!disabled) {
          onChange(!checked);
        }
      }}
    >
      {button}
      <span className="text-[13px] text-[#d1d4dc] font-normal leading-none">{label}</span>
    </label>
  );
}

/**
 * 2. Toggle: Compact 9px thumb switch pattern (Reference: print_20261009_140412.png)
 * - Flexbox centered: inline-flex items-center with px-[1.5px]
 * - Dedicated child <span> for the thumb: mathematically centered vertically at 100% (0 drift)
 * - Off: dark charcoal #22242a track, muted slate #6c707d thumb (translateX(0px))
 * - On: slate/gray #5c606d track, pure crisp white #ffffff thumb (translateX(10px))
 */
export function VelaToggle({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  className = "",
  size = "compact",
  style,
}: VelaToggleProps) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      size={size}
      className={className}
      style={style}
    />
  );
}

/**
 * VelaSwitch: Smart alias / router for VelaToggle and VelaCheckbox
 */
export function VelaSwitch(props: VelaSwitchProps) {
  if (props.variant === "checkbox") {
    return <VelaCheckbox {...props} />;
  }
  return <VelaToggle {...props} />;
}
