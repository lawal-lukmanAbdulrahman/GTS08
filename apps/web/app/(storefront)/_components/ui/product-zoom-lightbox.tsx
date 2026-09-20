"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface ProductZoomLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  productTitle: string;
  hasTransparentBg?: boolean;
}

export function ProductZoomLightbox({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  productTitle,
  hasTransparentBg = false,
}: ProductZoomLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);

  // Sync initial index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
    }
  }, [isOpen, initialIndex]);

  // Reset zoom scale when image index changes
  useEffect(() => {
    setScale(1);
  }, [currentIndex]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle keyboard navigation & ESC to close
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, images.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setScale(1);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setScale(1);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 3.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  const toggleDoubleClickZoom = () => {
    setScale((prev) => (prev > 1 ? 1 : 2.2));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.2, 3.5));
    } else {
      setScale((prev) => Math.max(prev - 0.2, 1));
    }
  };

  const activeImage = images[currentIndex] || images[0] || "";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between p-3 sm:p-5 bg-black/92 backdrop-blur-md overflow-hidden select-none">
          {/* Backdrop Overlay Click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />

          {/* ────── TOP CONTROLS BAR ────── */}
          <div className="relative z-20 flex items-center justify-between gap-4 w-full max-w-7xl mx-auto pt-1 px-2 text-white">
            {/* Title & Image Counter */}
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white/90 truncate max-w-xs sm:max-w-md">
                {productTitle}
              </span>
              <span className="text-[11px] font-semibold text-gray-400">
                Image {currentIndex + 1} of {images.length}
              </span>
            </div>

            {/* Zoom Actions & Close Button */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Zoom Controls Pill */}
              <div className="flex items-center bg-white/10 backdrop-blur-md rounded-full border border-white/15 p-1 text-xs font-bold text-white shadow-md">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={scale <= 1}
                  aria-label="Zoom out"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:bg-white/20 flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-2.5 py-1 hover:bg-white/20 rounded-full text-[11px] font-extrabold transition-colors cursor-pointer"
                >
                  {Math.round(scale * 100)}%
                </button>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={scale >= 3.5}
                  aria-label="Zoom in"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:bg-white/20 flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close lightbox"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/20 bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all cursor-pointer shadow-lg active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ────── CENTER MAIN IMAGE VIEWPORT (PAN & ZOOM) ────── */}
          <div
            onWheel={handleWheel}
            onDoubleClick={toggleDoubleClickZoom}
            className="relative z-10 flex-1 w-full flex items-center justify-center overflow-hidden my-2 cursor-grab active:cursor-grabbing"
          >
            {/* Left Prev Arrow Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous image"
                className="absolute left-3 sm:left-6 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-white/20 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-all shadow-xl active:scale-95 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Draggable & Zoomable Image Box — keyed to reset drag offsets on image switch */}
            <motion.div
              key={currentIndex}
              drag={scale > 1}
              dragConstraints={{ left: -400 * scale, right: 400 * scale, top: -300 * scale, bottom: 300 * scale }}
              dragElastic={0.08}
              animate={{ scale, x: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative w-full max-w-4xl h-full flex items-center justify-center p-4"
            >
              <div className="relative w-full h-full max-h-[75vh]">
                <Image
                  src={activeImage}
                  alt={productTitle}
                  fill
                  className={`object-contain transition-all duration-200 pointer-events-none drop-shadow-2xl ${
                    hasTransparentBg ? "p-4" : ""
                  }`}
                  priority
                />
              </div>
            </motion.div>

            {/* Right Next Arrow Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next image"
                className="absolute right-3 sm:right-6 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-white/20 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-all shadow-xl active:scale-95 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {/* ────── BOTTOM THUMBNAIL LIST OVERLAY ────── */}
          <div className="relative z-20 w-full max-w-3xl mx-auto pb-1">
            <div
              className="flex items-center justify-center gap-2.5 sm:gap-3 overflow-x-auto py-2 px-3 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl"
              style={{ scrollbarWidth: "none" }}
            >
              {images.map((thumb, idx) => {
                const isSelected = currentIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setScale(1);
                    }}
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? "border-[#EDCF5D] ring-2 ring-[#EDCF5D]/50 scale-105 bg-white/20"
                        : "border-white/20 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/60"
                    }`}
                  >
                    <Image
                      src={thumb}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      className="object-cover p-0.5"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
