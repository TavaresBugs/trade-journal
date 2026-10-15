"use client";

import React, { useEffect, useRef } from "react";
import { useAlerts } from "@/lib/alerts/alerts-store";

export function VelaDeleteAlertModal() {
  const { deleteConfirmAlert, cancelDeleteAlert, confirmDeleteAlert } = useAlerts();
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus trap / escape key listener
  useEffect(() => {
    if (!deleteConfirmAlert) return;

    // Auto-focus cancel button on open (TradingView canonical safety practice)
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDeleteAlert();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteConfirmAlert, cancelDeleteAlert]);

  if (!deleteConfirmAlert) {
    return null;
  }

  const alertName =
    deleteConfirmAlert.message?.trim() ||
    `${deleteConfirmAlert.symbol} Crossing ${Number(deleteConfirmAlert.targetPrice).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4 animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          cancelDeleteAlert();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-alert-title"
        aria-describedby="delete-alert-desc"
        data-name="confirm-dialog"
        className="dialog-hsBoleDO popupDialog-xKF9ptKN relative w-full max-w-[480px] bg-[var(--vela-surface,#1e222d)] text-[var(--vela-fg,#d1d4dc)] border border-[var(--vela-border,#2a2b30)] rounded-[8px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-6 md:p-8 select-none outline-none animate-in zoom-in-95 duration-100"
      >
        {/* Close Button Top Right */}
        <button
          type="button"
          aria-label="Close"
          data-name="close"
          data-role="button"
          onClick={cancelDeleteAlert}
          className="absolute top-4 right-4 w-[28px] h-[28px] flex items-center justify-center rounded text-[var(--vela-fg-muted,#787b86)] hover:text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))] transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 17 17"
            width="17"
            height="17"
            fill="currentColor"
          >
            <path d="m.58 1.42.82-.82 15 15-.82.82z" />
            <path d="m.58 15.58 15-15 .82.82-15 15z" />
          </svg>
        </button>

        {/* Modal Main Content */}
        <div className="main-xKF9ptKN pr-6">
          <h2
            id="delete-alert-title"
            className="title-xKF9ptKN text-[20px] font-semibold text-[var(--vela-fg-bright,#f0f3fa)] leading-[24px] mb-2"
          >
            Delete this alert?
          </h2>
          <p
            id="delete-alert-desc"
            className="content-xKF9ptKN text-[15px] md:text-[16px] text-[var(--vela-fg,#d1d4dc)] leading-[24px]"
          >
            Doing this will permanently delete your &ldquo;{alertName}&rdquo; alert.
          </p>
        </div>

        {/* Action Buttons Footer */}
        <div className="footer-xKF9ptKN flex items-center justify-end gap-2 mt-6">
          <button
            ref={cancelBtnRef}
            type="button"
            name="no"
            data-qa-id="no-btn"
            onClick={cancelDeleteAlert}
            className="h-[34px] px-4 rounded-[8px] border border-[var(--vela-border,#363a45)] bg-transparent text-[var(--vela-fg,#d1d4dc)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.08))] text-[14px] font-normal transition-colors cursor-pointer select-none"
          >
            Cancel
          </button>
          <button
            type="button"
            name="yes"
            data-qa-id="yes-btn"
            onClick={confirmDeleteAlert}
            className="h-[34px] px-4 rounded-[8px] bg-[#f23645] hover:bg-[#e02837] text-white text-[14px] font-normal transition-colors cursor-pointer select-none"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
