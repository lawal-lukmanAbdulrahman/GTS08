"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

export interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
  productTitle?: string;
  hasTransparentBg?: boolean;
  onIndexChange?: (index: number) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 0.25;

export function ImageViewer({
  isOpen,
  onClose,
  images = [],
  initialIndex = 0,
  title,
  productTitle,
  hasTransparentBg = false,
  onIndexChange,
}: ImageViewerProps) {
  const displayTitle = title || productTitle || "";
  const validImages = images.length > 0 ? images : ["/placeholder-product.png"];

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const viewAreaRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Mouse pan tracking refs
  const isMouseDownRef = useRef(false);
  const mouseStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Touch pinch & pan tracking refs
  const touchStartDistRef = useRef(0);
  const touchStartScaleRef = useRef(1);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const touchStartOffsetRef = useRef({ x: 0, y: 0 });

  // Sync initialIndex when modal opens or index prop changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, validImages.length - 1)));
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsPanning(false);
    }
  }, [isOpen, initialIndex, validImages.length]);

  // Reset zoom & pan when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsPanning(false);
    setIsLoaded(false);
  }, [currentIndex]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Precise pan boundary calculations derived from rendered image vs view area dimensions
  const getPanBounds = useCallback((currentScale: number) => {
    if (currentScale <= 1 || !imgRef.current || !viewAreaRef.current) {
      return { maxX: 0, maxY: 0 };
    }

    const imgW = imgRef.current.offsetWidth;
    const imgH = imgRef.current.offsetHeight;
    const containerW = viewAreaRef.current.clientWidth;
    const containerH = viewAreaRef.current.clientHeight;

    if (!imgW || !imgH) {
      return { maxX: 0, maxY: 0 };
    }

    const scaledW = imgW * currentScale;
    const scaledH = imgH * currentScale;

    const maxX = Math.max(0, (scaledW - containerW) / 2);
    const maxY = Math.max(0, (scaledH - containerH) / 2);

    return { maxX, maxY };
  }, []);

  // Update scale with automatic boundary clamping and snapping back to 1 when near origin
  const updateScale = useCallback(
    (newScale: number | ((prev: number) => number)) => {
      setScale((prev) => {
        const target = typeof newScale === "function" ? newScale(prev) : newScale;
        const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, target));
        const rounded = parseFloat(clamped.toFixed(2));

        if (rounded <= 1.02) {
          setPosition({ x: 0, y: 0 });
          return 1;
        }

        const { maxX, maxY } = getPanBounds(rounded);
        setPosition((pos) => ({
          x: Math.min(maxX, Math.max(-maxX, pos.x)),
          y: Math.min(maxY, Math.max(-maxY, pos.y)),
        }));

        return rounded;
      });
    },
    [getPanBounds]
  );

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    updateScale((s) => s + STEP);
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    updateScale((s) => s - STEP);
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleNext = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const nextIdx = (currentIndex + 1) % validImages.length;
      setCurrentIndex(nextIdx);
      onIndexChange?.(nextIdx);
    },
    [currentIndex, validImages.length, onIndexChange]
  );

  const handlePrev = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const prevIdx = (currentIndex - 1 + validImages.length) % validImages.length;
      setCurrentIndex(prevIdx);
      onIndexChange?.(prevIdx);
    },
    [currentIndex, validImages.length, onIndexChange]
  );

  // Keyboard navigation (+, -, 0, Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        updateScale((s) => s + STEP);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        updateScale((s) => s - STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, updateScale, handlePrev, handleNext, onClose]);

  // Native non-passive Wheel Listener for smooth zooming
  useEffect(() => {
    const el = viewAreaRef.current;
    if (!el || !isOpen) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY < 0 ? STEP : -STEP;
      updateScale((s) => s + delta);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [isOpen, updateScale]);

  // Mouse pan handlers: arms pan on mousedown, moves & releases via window listeners
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (scale > 1) {
      isMouseDownRef.current = true;
      hasMovedRef.current = false;
      setIsPanning(true);
      mouseStartRef.current = { x: e.clientX, y: e.clientY };
      posStartRef.current = { ...position };
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (!isPanning) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const dx = e.clientX - mouseStartRef.current.x;
      const dy = e.clientY - mouseStartRef.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
      }

      const { maxX, maxY } = getPanBounds(scale);
      setPosition({
        x: Math.min(maxX, Math.max(-maxX, posStartRef.current.x + dx)),
        y: Math.min(maxY, Math.max(-maxY, posStartRef.current.y + dy)),
      });
    };

    const handleWindowMouseUp = () => {
      isMouseDownRef.current = false;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isPanning, scale, getPanBounds]);

  // Touch pinch & pan handlers (mobile & trackpad touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    if (e.touches.length === 2 && t0 && t1) {
      const dist = Math.hypot(
        t0.clientX - t1.clientX,
        t0.clientY - t1.clientY
      );
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = scale;
      posStartRef.current = { ...position };
    } else if (e.touches.length === 1 && t0 && scale > 1) {
      touchStartDistRef.current = 0;
      touchStartPosRef.current = {
        x: t0.clientX,
        y: t0.clientY,
      };
      touchStartOffsetRef.current = { ...position };
      setIsPanning(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    if (e.touches.length === 2 && t0 && t1 && touchStartDistRef.current > 0) {
      e.preventDefault();
      const currentDist = Math.hypot(
        t0.clientX - t1.clientX,
        t0.clientY - t1.clientY
      );
      const ratio = currentDist / touchStartDistRef.current;
      updateScale(touchStartScaleRef.current * ratio);
    } else if (e.touches.length === 1 && t0 && scale > 1) {
      e.preventDefault();
      const dx = t0.clientX - touchStartPosRef.current.x;
      const dy = t0.clientY - touchStartPosRef.current.y;

      const { maxX, maxY } = getPanBounds(scale);
      setPosition({
        x: Math.min(maxX, Math.max(-maxX, touchStartOffsetRef.current.x + dx)),
        y: Math.min(maxY, Math.max(-maxY, touchStartOffsetRef.current.y + dy)),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      touchStartDistRef.current = 0;
      setIsPanning(false);
      return;
    }

    const t0 = e.touches[0];
    // Re-baseline when transitioning from 2 fingers down to 1 finger
    if (e.touches.length === 1 && t0) {
      touchStartDistRef.current = 0;
      touchStartPosRef.current = {
        x: t0.clientX,
        y: t0.clientY,
      };
      touchStartOffsetRef.current = { ...position };
      setIsPanning(scale > 1);
    }
  };

  // Double-click toggle zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      handleResetZoom();
    } else {
      updateScale(2.5);
    }
  };

  // Clicking backdrop: closes if scale is 1, resets zoom if zoomed
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    if (scale > 1) {
      handleResetZoom();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const activeImage = validImages[currentIndex] || validImages[0];
  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xs select-none overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* ── Top-Right Close Button ── */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        title="Close (Esc)"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-40 p-2 text-white/80 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/10 active:scale-95"
      >
        <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* ── Left Navigation Arrow ── */}
      {validImages.length > 1 && (
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous image"
          title="Previous (←)"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40 p-2 sm:p-3 text-white/70 hover:text-white transition-all cursor-pointer rounded-full hover:bg-black/30 active:scale-90"
        >
          <svg className="w-7 h-7 sm:w-9 sm:h-9 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* ── Right Navigation Arrow ── */}
      {validImages.length > 1 && (
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next image"
          title="Next (→)"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 p-2 sm:p-3 text-white/70 hover:text-white transition-all cursor-pointer rounded-full hover:bg-black/30 active:scale-90"
        >
          <svg className="w-7 h-7 sm:w-9 sm:h-9 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* ── Center Viewport (Pannable & Zoomable area) ── */}
      <div
        ref={viewAreaRef}
        onClick={handleBackdropClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full flex items-center justify-center p-2 sm:p-6 touch-none cursor-default"
      >
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onClick={(e) => e.stopPropagation()}
          className={`relative max-w-[94vw] max-h-[92vh] flex items-center justify-center select-none ${
            scale > 1
              ? isPanning
                ? "cursor-grabbing"
                : "cursor-grab"
              : "cursor-zoom-in"
          }`}
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
            transition: isPanning ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            transformOrigin: "center center",
            willChange: "transform",
          }}
        >
          {!isLoaded && (
            <div className="w-[280px] h-[280px] sm:w-[420px] sm:h-[420px] rounded-xl bg-white/5 animate-pulse flex items-center justify-center">
              <svg className="w-8 h-8 text-white/20 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}

          {(() => {
            const isImgTrans =
              hasTransparentBg ||
              (typeof activeImage === "string" &&
                (activeImage.toLowerCase().endsWith(".png") ||
                  activeImage.toLowerCase().includes(".png?") ||
                  activeImage.toLowerCase().includes("transparent") ||
                  activeImage.toLowerCase().includes("removebg")));
            return (
              <img
                ref={imgRef}
                src={activeImage}
                alt={displayTitle || "Enlarged preview"}
                draggable={false}
                onLoad={() => setIsLoaded(true)}
                className={`max-w-[94vw] max-h-[92vh] object-contain drop-shadow-2xl transition-opacity duration-200 select-none ${
                  isImgTrans ? "p-4 sm:p-6" : ""
                } ${isLoaded ? "opacity-100" : "opacity-0 absolute"}`}
              />
            );
          })()}
        </div>
      </div>

      {/* ── Bottom-Left Image Counter Badge (Matching: 📷 1/3) ── */}
      {validImages.length > 1 && (
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 flex items-center gap-1.5 bg-black/75 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-md border border-white/10 shadow-lg pointer-events-none">
          <svg className="w-3.5 h-3.5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="tracking-wide font-sans">{currentIndex + 1}/{validImages.length}</span>
        </div>
      )}

      {/* ── Subtle Zoom Indicator (Only when zoomed in: click to reset) ── */}
      {scale > 1 && (
        <button
          type="button"
          onClick={handleResetZoom}
          className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-1.5 bg-black/75 hover:bg-black/90 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-md border border-white/10 shadow-lg cursor-pointer transition-all active:scale-95"
        >
          <span>{zoomPercent}%</span>
          <span className="text-white/60 text-[10px] hidden sm:inline">• Click to reset</span>
        </button>
      )}
    </div>
  );
}

// Export both names for maximum compatibility across storefront and admin
export { ImageViewer as ProductZoomLightbox };
