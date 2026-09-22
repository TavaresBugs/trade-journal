"use client";

import React, { useState, useEffect, useRef, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { X, ChevronLeft, ChevronRight, RotateCcw, Minus, Plus, Trash2 } from "lucide-react";

const ZOOM_ANNOUNCEMENT_DELAY_MS = 300;

export interface LightboxImageItem {
  id: string;
  url: string;
  title: string;
  subtitle?: string;
}

interface ImagePreviewLightboxProps {
  images: LightboxImageItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onDelete?: (id: string) => void | Promise<void>;
}

/**
 * Fullscreen screenshot preview lightbox with pan, zoom, and centered controls.
 */
export function ImagePreviewLightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
  onDelete,
}: ImagePreviewLightboxProps) {
  const currentImage = images[currentIndex];
  const imageKey = currentImage ? `${currentIndex}:${currentImage.url}` : undefined;
  const [showZoomHint, setShowZoomHint] = useState(true);
  const [zoomState, setZoomState] = useState({
    imageKey,
    visualScale: 1,
    announcedScale: 1,
  });
  const zoomStateRef = useRef(zoomState);
  const zoomAnnouncementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomScale = zoomState.imageKey === imageKey ? zoomState.visualScale : 1;
  const announcedZoomScale = zoomState.imageKey === imageKey ? zoomState.announcedScale : 1;

  const modalId = useId();
  const titleId = `${modalId}-title`;
  const descriptionId = `${modalId}-description`;
  const zoomIndicatorId = `${modalId}-zoom-indicator`;

  const isOpen = currentIndex >= 0 && currentIndex < images.length && Boolean(currentImage);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Reset zoom state when current image changes
  useEffect(() => {
    let resetStateTimer: ReturnType<typeof setTimeout> | null = null;
    const previous = zoomStateRef.current;
    if (previous.imageKey !== imageKey) {
      const resetZoomState = {
        imageKey,
        visualScale: 1,
        announcedScale: 1,
      };
      zoomStateRef.current = resetZoomState;
      resetStateTimer = setTimeout(() => setZoomState(resetZoomState), 0);
    }

    return () => {
      if (resetStateTimer) clearTimeout(resetStateTimer);
      if (zoomAnnouncementTimerRef.current) {
        clearTimeout(zoomAnnouncementTimerRef.current);
        zoomAnnouncementTimerRef.current = null;
      }
    };
  }, [imageKey]);

  // Auto-hide mobile zoom hint after 3s
  useEffect(() => {
    if (isOpen && showZoomHint) {
      const timer = setTimeout(() => setShowZoomHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, showZoomHint]);

  const navigatePrevious = useCallback(() => {
    if (images.length <= 1) return;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    onNavigate(newIndex);
  }, [currentIndex, images.length, onNavigate]);

  const navigateNext = useCallback(() => {
    if (images.length <= 1) return;
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    onNavigate(newIndex);
  }, [currentIndex, images.length, onNavigate]);

  const handleDelete = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!currentImage || !onDelete) return;
      if (
        window.confirm(`Are you sure you want to delete this screenshot (${currentImage.title})?`)
      ) {
        onDelete(currentImage.id);
      }
    },
    [currentImage, onDelete],
  );

  // Keyboard navigation listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateNext();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target;
        const isEditable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLElement &&
            (target.isContentEditable ||
              target.closest("input, textarea, select, [contenteditable='true']") !== null));
        if (!isEditable && onDelete) {
          e.preventDefault();
          handleDelete();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, navigateNext, navigatePrevious, onClose, onDelete, handleDelete]);

  if (!isOpen || !currentImage || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        data-testid="image-preview-lightbox-backdrop"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <h2 id={titleId} className="sr-only">
        Preview for {currentImage.title}
      </h2>
      <p id={descriptionId} className="sr-only">
        Image {currentIndex + 1} of {images.length}. Use arrow keys to navigate and controls to
        adjust zoom.
      </p>

      {/* Delete Button (Top Left) */}
      {onDelete && (
        <button
          type="button"
          aria-label="Delete"
          title="Delete screenshot (Del)"
          className="absolute top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-loss border border-white/10 backdrop-blur-sm transition-colors hover:bg-loss/20 hover:text-loss"
          onClick={handleDelete}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      )}

      {/* Close Button (Top Right) */}
      <button
        type="button"
        aria-label="Close"
        title="Close (ESC)"
        className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-gray-200 border border-white/10 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      {/* Image Label Pill (Top Center) */}
      <div className="pointer-events-none absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-cyan-400 border border-white/10 backdrop-blur-sm">
        <span>{currentImage.title}</span>
        {images.length > 1 && (
          <span className="text-gray-400">
            ({currentIndex + 1}/{images.length})
          </span>
        )}
        {currentImage.subtitle && (
          <span className="text-gray-400 hidden sm:inline">· {currentImage.subtitle}</span>
        )}
      </div>
      <span role="status" aria-label="Current image" aria-live="polite" className="sr-only">
        {currentImage.title}, image {currentIndex + 1} of {images.length}
      </span>
      {/* Zoomable Image Container */}
      <div
        className="absolute inset-4 z-10 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <TransformWrapper
          key={imageKey} // Reset zoom when image changes
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          smooth={false}
          wheel={{ step: 0.08 }}
          doubleClick={{ mode: "reset" }} // Built-in reset on double-click
          panning={{
            disabled: false,
            velocityDisabled: true,
          }}
          limitToBounds={false}
          centerOnInit={true}
          centerZoomedOut={true}
          onTransform={(_ref, state) => {
            const previous = zoomStateRef.current;
            if (previous.imageKey === imageKey && previous.visualScale === state.scale) {
              return;
            }

            const nextZoomState = {
              imageKey,
              visualScale: state.scale,
              announcedScale: previous.imageKey === imageKey ? previous.announcedScale : 1,
            };
            zoomStateRef.current = nextZoomState;
            setZoomState(nextZoomState);

            if (zoomAnnouncementTimerRef.current) {
              clearTimeout(zoomAnnouncementTimerRef.current);
            }
            zoomAnnouncementTimerRef.current = setTimeout(() => {
              const latest = zoomStateRef.current;
              zoomAnnouncementTimerRef.current = null;
              if (
                latest.imageKey !== imageKey ||
                latest.visualScale !== state.scale ||
                latest.announcedScale === latest.visualScale
              ) {
                return;
              }

              const settledZoomState = {
                ...latest,
                announcedScale: latest.visualScale,
              };
              zoomStateRef.current = settledZoomState;
              setZoomState(settledZoomState);
            }, ZOOM_ANNOUNCEMENT_DELAY_MS);
          }}
        >
          {({ zoomIn, zoomOut, resetTransform, state }) => {
            const scale = state.scale;

            return (
              <>
                <TransformComponent
                  wrapperStyle={{
                    width: "100%",
                    height: "100%",
                  }}
                  contentStyle={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentImage.url}
                    alt={`${currentImage.title}, image ${currentIndex + 1} of ${images.length}`}
                    style={
                      {
                        maxWidth: "90vw",
                        maxHeight: "85vh",
                        objectFit: "contain",
                        borderRadius: "0.5rem",
                        userSelect: "none",
                        WebkitUserDrag: "none",
                        touchAction: "none",
                        cursor: scale > 1 ? "grab" : "zoom-in",
                      } as React.CSSProperties
                    }
                    draggable={false}
                  />
                </TransformComponent>

                {/* Zoom Controls Pill (Bottom Center) */}
                <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2 backdrop-blur-sm border border-white/10 shadow-xl">
                  {/* Reset Button */}
                  <button
                    type="button"
                    onClick={() => resetTransform()}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                    aria-label="Reset to 100%"
                    title="Reset zoom (100%)"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <div className="h-5 w-px bg-white/20" />

                  {/* Zoom Out */}
                  <button
                    type="button"
                    onClick={() => zoomOut(0.25)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                    aria-label="Zoom out"
                    title="Zoom out (-)"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  {/* Percentage Indicator */}
                  <span
                    id={zoomIndicatorId}
                    aria-hidden="true"
                    className={`min-w-14 text-center font-mono tnum text-sm ${
                      zoomScale < 0.99
                        ? "text-yellow-300"
                        : zoomScale > 1.01
                          ? "text-profit"
                          : "text-white"
                    }`}
                  >
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <span
                    role="status"
                    aria-label="Zoom level"
                    aria-live="polite"
                    className="sr-only"
                  >
                    {Math.round(announcedZoomScale * 100)}%
                  </span>

                  {/* Zoom In */}
                  <button
                    type="button"
                    onClick={() => zoomIn(0.25)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                    aria-label="Zoom in"
                    title="Zoom in (+)"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Mobile Zoom Hint */}
                {showZoomHint && (
                  <div className="pointer-events-none absolute top-20 left-1/2 z-50 flex -translate-x-1/2 animate-pulse items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs text-white/80 md:hidden">
                    <span>👆</span>
                    Tap to zoom • Double tap to reset
                  </div>
                )}
              </>
            );
          }}
        </TransformWrapper>
      </div>

      {/* Navigation Arrows (Always visible, active when carousel has > 1 image) */}
      <button
        type="button"
        disabled={images.length <= 1}
        aria-label="Previous"
        title={images.length <= 1 ? "Only 1 image in carousel" : "Previous (left arrow)"}
        className={`absolute top-1/2 left-4 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-gray-200 border border-white/10 backdrop-blur-sm transition-all ${
          images.length <= 1
            ? "opacity-30 cursor-not-allowed"
            : "hover:bg-black/80 hover:text-white cursor-pointer shadow-lg"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          navigatePrevious();
        }}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        disabled={images.length <= 1}
        aria-label="Next"
        title={images.length <= 1 ? "Only 1 image in carousel" : "Next (right arrow)"}
        className={`absolute top-1/2 right-4 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-gray-200 border border-white/10 backdrop-blur-sm transition-all ${
          images.length <= 1
            ? "opacity-30 cursor-not-allowed"
            : "hover:bg-black/80 hover:text-white cursor-pointer shadow-lg"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          navigateNext();
        }}
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>,
    document.body,
  );
}
