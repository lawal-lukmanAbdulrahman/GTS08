"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getLocalBroadcastItems,
  setLocalBroadcastItems,
  BroadcastItem,
  CanvasElement,
  BroadcastDesignConfig,
  INITIAL_BROADCAST_ITEMS,
  computeElementShadow,
  SHAPE_SEAL_POINTS,
  SHAPE_BURST_POINTS,
  SHAPE_SPEECH_PATH,
  SHAPE_CLOUD_PATH,
  SHAPE_ARROW_PATH,
} from "../../../../lib/notifications";
import { idempotentFetch } from "@gts/utils";
import { SidebarToggle } from "../../sidebar-context";
import { uploadToCloudinary } from "../../products/cloudinary-upload";

const CURATED_PRESETS = [
  {
    name: "Luxury Suiting",
    url: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1200&auto=format&fit=crop",
    title: "EXCLUSIVE EDIT",
    subtitle: "Discover bespoke Italian wool suiting tailored for exceptional occasions.",
    cta: "Explore Collection",
    link: "/shop",
  },
  {
    name: "New Season Linen",
    url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1200&auto=format&fit=crop",
    title: "SPRING / SUMMER",
    subtitle: "Breathable pure linens and relaxed modern fits for tropical elegance.",
    cta: "Shop New Arrivals",
    link: "/shop?category=linen",
  },
  {
    name: "Midnight Gala",
    url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1200&auto=format&fit=crop",
    title: "BLACK TIE COUTURE",
    subtitle: "Hand-finished satin lapels, double-breasted jackets, and statement evening wear.",
    cta: "View Collection",
    link: "/shop?category=evening",
  },
  {
    name: "Private Sale",
    url: "https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?q=80&w=1200&auto=format&fit=crop",
    title: "PRIVATE ACCESS",
    subtitle: "Enjoy member-only complimentary bespoke sizing on select wardrobe essentials.",
    cta: "Claim Privilege",
    link: "/shop?sort=trending",
  },
];

const FONT_OPTIONS = [
  { label: "Satoshi (Modern Clean Sans)", value: "Satoshi, sans-serif" },
  { label: "Playfair Display (Editorial Serif)", value: "'Playfair Display', Georgia, serif" },
  { label: "Cinzel (Classic Roman Luxury)", value: "'Cinzel', serif" },
  { label: "Montserrat (Geometric Bold)", value: "'Montserrat', sans-serif" },
  { label: "Oswald (Condensed Poster)", value: "'Oswald', sans-serif" },
  { label: "Plus Jakarta Sans (Contemporary)", value: "'Plus Jakarta Sans', sans-serif" },
  { label: "Courier Prime (Artisanal Mono)", value: "'Courier Prime', monospace" },
];

const STUDIO_COMPONENTS: {
  type: CanvasElement["type"];
  name: string;
  isDotted?: boolean;
  preset?: Partial<CanvasElement>;
  renderPreview: () => React.ReactNode;
}[] = [
  {
    type: "image",
    name: "Image",
    isDotted: true,
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-110 transition-transform">
        <div className="w-9 h-9 rounded-full border border-dashed border-[#EDCF5D] bg-[#EDCF5D]/10 flex items-center justify-center text-[#EDCF5D] shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    type: "title",
    name: "Headline",
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <span className="text-white font-black text-3xl tracking-tight leading-none drop-shadow">
          Aa
        </span>
      </div>
    ),
  },
  {
    type: "subtitle",
    name: "Subtitle",
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <span className="text-gray-300 font-medium text-xl leading-none">
          Aa
        </span>
      </div>
    ),
  },
  {
    type: "badge",
    name: "Pill Badge",
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EDCF5D] text-black font-black text-[10px] uppercase tracking-wider shadow-sm">
          NOTICE
        </span>
      </div>
    ),
  },
  {
    type: "button",
    name: "CTA Button",
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <div className="w-full max-w-[105px] py-2 px-2.5 rounded-xl bg-[#EDCF5D] text-black font-black text-[11px] uppercase flex items-center justify-center gap-1 shadow-sm">
          <span>Shop</span>
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    type: "button",
    name: "Ghost CTA",
    preset: {
      text: "Learn More",
      backgroundColor: "transparent",
      color: "#FFFFFF",
      borderRadius: 16,
    },
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <div className="w-full max-w-[105px] py-1.5 px-2 rounded-xl border border-white/35 text-white font-bold text-[10.5px] uppercase flex items-center justify-center">
          <span>Details</span>
        </div>
      </div>
    ),
  },
  {
    type: "custom_text",
    name: "Accent",
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <span
          className="text-[#EDCF5D] font-bold text-3xl italic tracking-wide drop-shadow leading-none"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Aa
        </span>
      </div>
    ),
  },
  {
    type: "container",
    name: "Square Box",
    preset: {
      text: "",
      width: 320,
      height: 110,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      borderColor: "rgba(255, 255, 255, 0.2)",
      borderWidth: 1,
      borderRadius: 14,
      color: "#FFFFFF",
    },
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <div className="w-12 h-10 rounded-md border border-white/40 bg-white/10 shadow-inner flex items-center justify-center">
          <div className="w-6 h-4 border border-dashed border-[#EDCF5D]/60 rounded-xs" />
        </div>
      </div>
    ),
  },
  {
    type: "circle",
    name: "Circle",
    preset: {
      text: "50% OFF",
      width: 84,
      height: 84,
      backgroundColor: "#EDCF5D",
      color: "#000000",
      fontSize: 12,
      fontWeight: "black",
      borderRadius: 9999,
    },
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <div className="w-10 h-10 rounded-full bg-[#EDCF5D] text-black font-black text-[9px] flex items-center justify-center shadow-md leading-none select-none">
          50%
        </div>
      </div>
    ),
  },
  {
    type: "seal",
    name: "Seal Badge",
    preset: {
      text: "100% QUALITY",
      width: 90,
      height: 90,
      backgroundColor: "#EDCF5D",
      color: "#000000",
      fontSize: 10,
      fontWeight: "black",
    },
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <svg className="w-10 h-10 text-[#EDCF5D] drop-shadow-md" viewBox="0 0 100 100" fill="currentColor">
          <polygon points={SHAPE_SEAL_POINTS} />
        </svg>
      </div>
    ),
  },
  {
    type: "burst",
    name: "Starburst",
    preset: {
      text: "HOT!",
      width: 90,
      height: 90,
      backgroundColor: "#EDCF5D",
      color: "#000000",
      fontSize: 13,
      fontWeight: "black",
    },
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <svg className="w-10 h-10 text-[#EDCF5D] drop-shadow-md" viewBox="0 0 100 100" fill="currentColor">
          <polygon points={SHAPE_BURST_POINTS} />
        </svg>
      </div>
    ),
  },
  {
    type: "speech",
    name: "Speech Bubble",
    preset: {
      text: "HELLO!",
      width: 105,
      height: 80,
      backgroundColor: "#EDCF5D",
      color: "#000000",
      fontSize: 12,
      fontWeight: "black",
    },
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <svg className="w-10 h-8 text-[#EDCF5D] drop-shadow-md" viewBox="0 0 100 80" fill="currentColor">
          <path d={SHAPE_SPEECH_PATH} />
        </svg>
      </div>
    ),
  },
  {
    type: "cloud",
    name: "Cloud Bubble",
    preset: {
      text: "WOW!",
      width: 105,
      height: 80,
      backgroundColor: "#EDCF5D",
      color: "#000000",
      fontSize: 12,
      fontWeight: "black",
    },
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <svg className="w-10 h-8 text-[#EDCF5D] drop-shadow-md" viewBox="0 0 100 80" fill="currentColor">
          <path d={SHAPE_CLOUD_PATH} />
        </svg>
      </div>
    ),
  },
  {
    type: "arrow",
    name: "Arrow",
    preset: {
      text: "GO",
      width: 95,
      height: 60,
      backgroundColor: "#EDCF5D",
      color: "#000000",
      fontSize: 13,
      fontWeight: "black",
    },
    renderPreview: () => (
      <div className="w-full h-14 flex items-center justify-center select-none group-hover:scale-105 transition-transform">
        <svg className="w-10 h-7 text-[#EDCF5D] drop-shadow-md" viewBox="0 0 100 70" fill="currentColor">
          <path d={SHAPE_ARROW_PATH} />
        </svg>
      </div>
    ),
  },
];

const DEFAULT_ELEMENTS: CanvasElement[] = [
  {
    id: "bottom-shadow-overlay",
    type: "shadow_overlay",
    text: "Black Fade Overlay",
    x: 0,
    y: 166,
    width: 380,
    height: 309,
    rotation: 0,
    borderRadius: 0,
  },
];

interface AlignmentGuide {
  id: string;
  type: "vertical" | "horizontal";
  coord: number;
  start: number;
  end: number;
  isCanvasGuide?: boolean;
}

const SNAP_THRESHOLD = 8;
const CANVAS_W = 380;
const CANVAS_H = 475;
const FRAME_MARGINS = [24, 20, 16, 30];

function calculateSnappingAndGuides(
  rawX: number,
  rawY: number,
  elemW: number,
  elemH: number,
  selectedId: string,
  elements: CanvasElement[]
): { nextX: number; nextY: number; guides: AlignmentGuide[] } {
  let nextX = rawX;
  let nextY = rawY;
  const guides: AlignmentGuide[] = [];

  const otherElements = elements.filter(
    (el) => el.id !== selectedId && el.id !== "bg-image" && !el.isBackground
  );

  // ─────────────────────────────────────────
  // 1. HORIZONTAL SNAPPING (X-axis alignment)
  // ─────────────────────────────────────────
  let minDiffX = SNAP_THRESHOLD + 1;
  let bestX = rawX;
  const activeXGuides: AlignmentGuide[] = [];

  // A. Canvas Center X Snap (X = 190)
  const rawCenterX = rawX + elemW / 2;
  const canvasCenterX = CANVAS_W / 2;
  const diffCanvasCenterX = Math.abs(rawCenterX - canvasCenterX);
  if (diffCanvasCenterX <= SNAP_THRESHOLD && diffCanvasCenterX < minDiffX) {
    minDiffX = diffCanvasCenterX;
    bestX = Math.round(canvasCenterX - elemW / 2);
    activeXGuides.length = 0;
    activeXGuides.push({
      id: "guide-canvas-center-x",
      type: "vertical",
      coord: canvasCenterX,
      start: 0,
      end: CANVAS_H,
      isCanvasGuide: true,
    });
  }

  // B. Canvas Left Edge Snap (X = 0)
  const diffCanvasLeft = Math.abs(rawX - 0);
  if (diffCanvasLeft <= SNAP_THRESHOLD && diffCanvasLeft < minDiffX) {
    minDiffX = diffCanvasLeft;
    bestX = 0;
    activeXGuides.length = 0;
    activeXGuides.push({
      id: "guide-canvas-left",
      type: "vertical",
      coord: 0,
      start: 0,
      end: CANVAS_H,
      isCanvasGuide: true,
    });
  }

  // C. Canvas Right Edge Snap (X = 380)
  const rawRight = rawX + elemW;
  const diffCanvasRight = Math.abs(rawRight - CANVAS_W);
  if (diffCanvasRight <= SNAP_THRESHOLD && diffCanvasRight < minDiffX) {
    minDiffX = diffCanvasRight;
    bestX = CANVAS_W - elemW;
    activeXGuides.length = 0;
    activeXGuides.push({
      id: "guide-canvas-right",
      type: "vertical",
      coord: CANVAS_W,
      start: 0,
      end: CANVAS_H,
      isCanvasGuide: true,
    });
  }

  // D. Canvas Frame Margin Snaps (Left & Right margins: 24, 20, 16, 30)
  for (const m of FRAME_MARGINS) {
    const diffLeftMargin = Math.abs(rawX - m);
    if (diffLeftMargin <= SNAP_THRESHOLD && diffLeftMargin < minDiffX) {
      minDiffX = diffLeftMargin;
      bestX = m;
      activeXGuides.length = 0;
      activeXGuides.push({
        id: `guide-canvas-left-margin-${m}`,
        type: "vertical",
        coord: m,
        start: 0,
        end: CANVAS_H,
        isCanvasGuide: true,
      });
    }

    const diffRightMargin = Math.abs(rawRight - (CANVAS_W - m));
    if (diffRightMargin <= SNAP_THRESHOLD && diffRightMargin < minDiffX) {
      minDiffX = diffRightMargin;
      bestX = CANVAS_W - elemW - m;
      activeXGuides.length = 0;
      activeXGuides.push({
        id: `guide-canvas-right-margin-${m}`,
        type: "vertical",
        coord: CANVAS_W - m,
        start: 0,
        end: CANVAS_H,
        isCanvasGuide: true,
      });
    }
  }

  // D. Other Elements Snap (Left, Center, Right)
  for (const other of otherElements) {
    const oW = other.width || 200;
    const oH = other.height || 40;
    const oLeft = other.x;
    const oCenterX = other.x + oW / 2;
    const oRight = other.x + oW;

    const candidates = [
      { diff: Math.abs(rawX - oLeft), targetX: oLeft, guideX: oLeft },
      { diff: Math.abs(rawX - oRight), targetX: oRight, guideX: oRight },
      { diff: Math.abs(rawCenterX - oCenterX), targetX: oCenterX - elemW / 2, guideX: oCenterX },
      { diff: Math.abs(rawRight - oRight), targetX: oRight - elemW, guideX: oRight },
      { diff: Math.abs(rawRight - oLeft), targetX: oLeft - elemW, guideX: oLeft },
      { diff: Math.abs(rawCenterX - oLeft), targetX: oLeft - elemW / 2, guideX: oLeft },
      { diff: Math.abs(rawCenterX - oRight), targetX: oRight - elemW / 2, guideX: oRight },
    ];

    for (const cand of candidates) {
      if (cand.diff <= SNAP_THRESHOLD) {
        if (cand.diff < minDiffX - 0.01) {
          minDiffX = cand.diff;
          bestX = Math.round(cand.targetX);
          activeXGuides.length = 0;
          activeXGuides.push({
            id: `guide-x-${other.id}-${cand.guideX}`,
            type: "vertical",
            coord: cand.guideX,
            start: Math.min(rawY, other.y) - 16,
            end: Math.max(rawY + elemH, other.y + oH) + 16,
            isCanvasGuide: false,
          });
        } else if (Math.abs(cand.diff - minDiffX) < 1.0) {
          activeXGuides.push({
            id: `guide-x-${other.id}-${cand.guideX}`,
            type: "vertical",
            coord: cand.guideX,
            start: Math.min(rawY, other.y) - 16,
            end: Math.max(rawY + elemH, other.y + oH) + 16,
            isCanvasGuide: false,
          });
        }
      }
    }
  }

  if (minDiffX <= SNAP_THRESHOLD) {
    nextX = bestX;
    guides.push(...activeXGuides);
  }

  // ─────────────────────────────────────────
  // 2. VERTICAL SNAPPING (Y-axis alignment)
  // ─────────────────────────────────────────
  let minDiffY = SNAP_THRESHOLD + 1;
  let bestY = rawY;
  const activeYGuides: AlignmentGuide[] = [];

  // A. Canvas Center Y Snap (Y = 237.5)
  const rawCenterY = rawY + elemH / 2;
  const canvasCenterY = CANVAS_H / 2;
  const diffCanvasCenterY = Math.abs(rawCenterY - canvasCenterY);
  if (diffCanvasCenterY <= SNAP_THRESHOLD && diffCanvasCenterY < minDiffY) {
    minDiffY = diffCanvasCenterY;
    bestY = Math.round(canvasCenterY - elemH / 2);
    activeYGuides.length = 0;
    activeYGuides.push({
      id: "guide-canvas-center-y",
      type: "horizontal",
      coord: canvasCenterY,
      start: 0,
      end: CANVAS_W,
      isCanvasGuide: true,
    });
  }

  // B. Canvas Top Edge Snap (Y = 0)
  const diffCanvasTop = Math.abs(rawY - 0);
  if (diffCanvasTop <= SNAP_THRESHOLD && diffCanvasTop < minDiffY) {
    minDiffY = diffCanvasTop;
    bestY = 0;
    activeYGuides.length = 0;
    activeYGuides.push({
      id: "guide-canvas-top",
      type: "horizontal",
      coord: 0,
      start: 0,
      end: CANVAS_W,
      isCanvasGuide: true,
    });
  }

  // C. Canvas Bottom Edge Snap (Y = 475)
  const rawBottom = rawY + elemH;
  const diffCanvasBottom = Math.abs(rawBottom - CANVAS_H);
  if (diffCanvasBottom <= SNAP_THRESHOLD && diffCanvasBottom < minDiffY) {
    minDiffY = diffCanvasBottom;
    bestY = CANVAS_H - elemH;
    activeYGuides.length = 0;
    activeYGuides.push({
      id: "guide-canvas-bottom",
      type: "horizontal",
      coord: CANVAS_H,
      start: 0,
      end: CANVAS_W,
      isCanvasGuide: true,
    });
  }

  // D. Canvas Frame Margin Snaps (Top & Bottom margins: 24, 20, 16, 30)
  for (const m of FRAME_MARGINS) {
    const diffTopMargin = Math.abs(rawY - m);
    if (diffTopMargin <= SNAP_THRESHOLD && diffTopMargin < minDiffY) {
      minDiffY = diffTopMargin;
      bestY = m;
      activeYGuides.length = 0;
      activeYGuides.push({
        id: `guide-canvas-top-margin-${m}`,
        type: "horizontal",
        coord: m,
        start: 0,
        end: CANVAS_W,
        isCanvasGuide: true,
      });
    }

    const diffBottomMargin = Math.abs(rawBottom - (CANVAS_H - m));
    if (diffBottomMargin <= SNAP_THRESHOLD && diffBottomMargin < minDiffY) {
      minDiffY = diffBottomMargin;
      bestY = CANVAS_H - elemH - m;
      activeYGuides.length = 0;
      activeYGuides.push({
        id: `guide-canvas-bottom-margin-${m}`,
        type: "horizontal",
        coord: CANVAS_H - m,
        start: 0,
        end: CANVAS_W,
        isCanvasGuide: true,
      });
    }
  }

  // D. Other Elements Snap (Top, Center, Bottom)
  for (const other of otherElements) {
    const oW = other.width || 200;
    const oH = other.height || 40;
    const oTop = other.y;
    const oCenterY = other.y + oH / 2;
    const oBottom = other.y + oH;

    const candidates = [
      { diff: Math.abs(rawY - oTop), targetY: oTop, guideY: oTop },
      { diff: Math.abs(rawY - oBottom), targetY: oBottom, guideY: oBottom },
      { diff: Math.abs(rawCenterY - oCenterY), targetY: oCenterY - elemH / 2, guideY: oCenterY },
      { diff: Math.abs(rawBottom - oBottom), targetY: oBottom - elemH, guideY: oBottom },
      { diff: Math.abs(rawBottom - oTop), targetY: oTop - elemH, guideY: oTop },
      { diff: Math.abs(rawCenterY - oTop), targetY: oTop - elemH / 2, guideY: oTop },
      { diff: Math.abs(rawCenterY - oBottom), targetY: oBottom - elemH / 2, guideY: oBottom },
    ];

    for (const cand of candidates) {
      if (cand.diff <= SNAP_THRESHOLD) {
        if (cand.diff < minDiffY - 0.01) {
          minDiffY = cand.diff;
          bestY = Math.round(cand.targetY);
          activeYGuides.length = 0;
          activeYGuides.push({
            id: `guide-y-${other.id}-${cand.guideY}`,
            type: "horizontal",
            coord: cand.guideY,
            start: Math.min(nextX, other.x) - 16,
            end: Math.max(nextX + elemW, other.x + oW) + 16,
            isCanvasGuide: false,
          });
        } else if (Math.abs(cand.diff - minDiffY) < 1.0) {
          activeYGuides.push({
            id: `guide-y-${other.id}-${cand.guideY}`,
            type: "horizontal",
            coord: cand.guideY,
            start: Math.min(nextX, other.x) - 16,
            end: Math.max(nextX + elemW, other.x + oW) + 16,
            isCanvasGuide: false,
          });
        }
      }
    }
  }

  if (minDiffY <= SNAP_THRESHOLD) {
    nextY = bestY;
    guides.push(...activeYGuides);
  }

  // Update vertical guides start & end with final nextY
  for (const g of guides) {
    if (g.type === "vertical" && !g.isCanvasGuide) {
      const otherMatch = otherElements.find((o) => g.id.includes(o.id));
      if (otherMatch) {
        const oH = otherMatch.height || 40;
        g.start = Math.min(nextY, otherMatch.y) - 16;
        g.end = Math.max(nextY + elemH, otherMatch.y + oH) + 16;
      }
    }
  }

  // Deduplicate overlapping guide lines
  const uniqueGuides: AlignmentGuide[] = [];
  for (const g of guides) {
    const existing = uniqueGuides.find(
      (ug) => ug.type === g.type && Math.abs(ug.coord - g.coord) < 1
    );
    if (existing) {
      existing.start = Math.min(existing.start, g.start);
      existing.end = Math.max(existing.end, g.end);
      if (g.isCanvasGuide) existing.isCanvasGuide = true;
    } else {
      uniqueGuides.push({ ...g });
    }
  }

  return { nextX, nextY, guides: uniqueGuides };
}

function generateUniqueElementId(prefix = "elem"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

let sharedMeasureCanvas: HTMLCanvasElement | null = null;

function measureElementContentSize(el: Partial<CanvasElement>): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { width: el.width || 200, height: el.height || 40 };
  }

  const type = el.type || "custom_text";

  if (["custom_text", "title", "subtitle", "badge", "button"].includes(type)) {
    const text = el.text || "";
    const fontSize = el.fontSize || (type === "title" ? 22 : type === "badge" ? 10 : 16);
    const fontFamily = el.fontFamily || "system-ui, -apple-system, sans-serif";
    const fontWeight = el.fontWeight || (type === "title" || type === "badge" || type === "custom_text" ? "bold" : "normal");
    const fontStyle = el.fontStyle || "normal";
    const textTransform = el.textTransform || "none";

    let displayText = text;
    if (textTransform === "uppercase") displayText = text.toUpperCase();
    if (textTransform === "lowercase") displayText = text.toLowerCase();

    if (!sharedMeasureCanvas) {
      sharedMeasureCanvas = document.createElement("canvas");
    }
    const ctx = sharedMeasureCanvas.getContext("2d");
    if (ctx) {
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}", system-ui, sans-serif`;

      const lines = displayText.split("\n");
      let maxLineWidth = 0;
      lines.forEach((line) => {
        const w = Math.ceil(ctx.measureText(line).width);
        if (w > maxLineWidth) maxLineWidth = w;
      });

      const lineHeight = Math.max(Math.round(fontSize * 1.28), 16);
      const naturalHeight = Math.max(lineHeight * Math.max(1, lines.length), 16);

      if (type === "badge") {
        return {
          width: Math.max(60, maxLineWidth + 32),
          height: Math.max(22, Math.round(fontSize + 12)),
        };
      }

      if (type === "button") {
        return {
          width: Math.max(el.width || 160, maxLineWidth + 64),
          height: Math.max(el.height || 44, Math.round(fontSize + 24)),
        };
      }

      if (type === "title" || type === "subtitle") {
        return {
          width: Math.max(el.width || 320, maxLineWidth + 8),
          height: Math.max(el.height || 36, naturalHeight),
        };
      }

      // custom_text
      return {
        width: Math.max(24, maxLineWidth + 8),
        height: Math.max(16, naturalHeight),
      };
    }
  }

  return { width: el.width || 200, height: el.height || 40 };
}

interface EditorHistorySnapshot {
  elements: CanvasElement[];
  selectedElementId: string | null;
  selectedElementIds?: string[];
  borderRadius?: number;
  bgColor?: string;
  showBottomShadow?: boolean;
  isFrameless?: boolean;
}

function BroadcastEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams?.get("id");
  const isNew = searchParams?.get("new") === "true";

  // Core Campaign Fields
  const [id, setId] = useState(`broadcast-${Date.now()}`);
  const [title, setTitle] = useState(isNew || !campaignId ? "" : "SPRING / SUMMER");
  const [subtitle, setSubtitle] = useState(isNew || !campaignId ? "" : "Breathable pure linens and relaxed modern fits for tropical elegance.");
  const [imageUrl, setImageUrl] = useState(
    isNew || !campaignId ? "" : "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1200&auto=format&fit=crop"
  );
  const [ctaLabel, setCtaLabel] = useState("Shop New Arrivals");
  const [ctaLink, setCtaLink] = useState("/shop");
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string>(""); // ISO datetime or empty for no expiry

  // Canvas Design Properties
  const [borderRadius, setBorderRadius] = useState<number>(24);
  const [bgColor, setBgColor] = useState<string>("#010101");
  const [showBottomShadow, setShowBottomShadow] = useState<boolean>(true);
  const [isFrameless, setIsFrameless] = useState<boolean>(false);
  const [elements, setElements] = useState<CanvasElement[]>(
    isNew || !campaignId
      ? [
          {
            id: "bottom-shadow-overlay",
            type: "shadow_overlay",
            text: "Black Fade Overlay",
            x: 0,
            y: 166,
            width: 380,
            height: 309,
            rotation: 0,
            borderRadius: 0,
          },
        ]
      : DEFAULT_ELEMENTS
  );

  // Interaction State
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"card" | "elements" | "inspector">("card");
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDragOverBanner, setIsDragOverBanner] = useState<boolean>(false);
  const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = useState<number | null>(null);

  // Floating Pill Toolbar and Clipboard State
  const [clipboardElement, setClipboardElement] = useState<CanvasElement | null>(null);
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState<boolean>(false);
  const [isMovingBg, setIsMovingBg] = useState<boolean>(false);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);

  // History State for Undo / Redo
  const [historyPast, setHistoryPast] = useState<EditorHistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<EditorHistorySnapshot[]>([]);
  const historyPastRef = useRef<EditorHistorySnapshot[]>([]);
  const historyFutureRef = useRef<EditorHistorySnapshot[]>([]);
  historyPastRef.current = historyPast;
  historyFutureRef.current = historyFuture;

  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const selectedElementIdRef = useRef(selectedElementId);
  selectedElementIdRef.current = selectedElementId;
  const selectedElementIdsRef = useRef(selectedElementIds);
  selectedElementIdsRef.current = selectedElementIds;
  const borderRadiusRef = useRef(borderRadius);
  borderRadiusRef.current = borderRadius;
  const bgColorRef = useRef(bgColor);
  bgColorRef.current = bgColor;
  const showBottomShadowRef = useRef(showBottomShadow);
  showBottomShadowRef.current = showBottomShadow;
  const isFramelessRef = useRef(isFrameless);
  isFramelessRef.current = isFrameless;
  const dragStartSnapshotRef = useRef<EditorHistorySnapshot | null>(null);
  const hasDraggedMarqueeRef = useRef<boolean>(false);
  const hasMovedMouseRef = useRef<boolean>(false);

  const getSnapshot = (): EditorHistorySnapshot => ({
    elements: JSON.parse(JSON.stringify(elementsRef.current)),
    selectedElementId: selectedElementIdRef.current,
    selectedElementIds: [...selectedElementIdsRef.current],
    borderRadius: borderRadiusRef.current,
    bgColor: bgColorRef.current,
    showBottomShadow: showBottomShadowRef.current,
    isFrameless: isFramelessRef.current,
  });

  const pushHistorySnapshot = (snapshotBeforeChange?: EditorHistorySnapshot) => {
    const snap = snapshotBeforeChange || getSnapshot();
    setHistoryPast((prev) => {
      const next = [...prev.slice(-49), snap];
      historyPastRef.current = next;
      return next;
    });
    setHistoryFuture([]);
    historyFutureRef.current = [];
  };

  const handleUndo = () => {
    const past = historyPastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    if (!previous) return;
    const newPast = past.slice(0, -1);
    const current = getSnapshot();

    historyPastRef.current = newPast;
    setHistoryPast(newPast);

    const newFuture = [current, ...historyFutureRef.current];
    historyFutureRef.current = newFuture;
    setHistoryFuture(newFuture);

    setElements(previous.elements);
    setSelectedElementId(previous.selectedElementId);
    setSelectedElementIds(
      previous.selectedElementIds || (previous.selectedElementId ? [previous.selectedElementId] : [])
    );
    if (previous.borderRadius !== undefined) setBorderRadius(previous.borderRadius);
    if (previous.bgColor !== undefined) setBgColor(previous.bgColor);
    if (previous.showBottomShadow !== undefined) setShowBottomShadow(previous.showBottomShadow);
    if (previous.isFrameless !== undefined) setIsFrameless(previous.isFrameless);

    // Sync campaign fields
    const titleElem = previous.elements.find((el) => el.type === "title");
    if (titleElem) setTitle(titleElem.text);
    const subElem = previous.elements.find((el) => el.type === "subtitle");
    if (subElem) setSubtitle(subElem.text);
    const btnElem = previous.elements.find((el) => el.type === "button");
    if (btnElem) {
      setCtaLabel(btnElem.text);
      if (btnElem.ctaLink) setCtaLink(btnElem.ctaLink);
    }
    const bgElem = previous.elements.find((el) => el.isBackground || el.id === "bg-image");
    if (bgElem?.imageUrl) setImageUrl(bgElem.imageUrl);
  };

  const handleRedo = () => {
    const future = historyFutureRef.current;
    if (future.length === 0) return;
    const next = future[0];
    if (!next) return;
    const newFuture = future.slice(1);
    const current = getSnapshot();

    const newPast = [...historyPastRef.current.slice(-49), current];
    historyPastRef.current = newPast;
    setHistoryPast(newPast);

    historyFutureRef.current = newFuture;
    setHistoryFuture(newFuture);

    setElements(next.elements);
    setSelectedElementId(next.selectedElementId);
    setSelectedElementIds(
      next.selectedElementIds || (next.selectedElementId ? [next.selectedElementId] : [])
    );
    if (next.borderRadius !== undefined) setBorderRadius(next.borderRadius);
    if (next.bgColor !== undefined) setBgColor(next.bgColor);
    if (next.showBottomShadow !== undefined) setShowBottomShadow(next.showBottomShadow);
    if (next.isFrameless !== undefined) setIsFrameless(next.isFrameless);

    // Sync campaign fields
    const titleElem = next.elements.find((el) => el.type === "title");
    if (titleElem) setTitle(titleElem.text);
    const subElem = next.elements.find((el) => el.type === "subtitle");
    if (subElem) setSubtitle(subElem.text);
    const btnElem = next.elements.find((el) => el.type === "button");
    if (btnElem) {
      setCtaLabel(btnElem.text);
      if (btnElem.ctaLink) setCtaLink(btnElem.ctaLink);
    }
    const bgElem = next.elements.find((el) => el.isBackground || el.id === "bg-image");
    if (bgElem?.imageUrl) setImageUrl(bgElem.imageUrl);
  };

  // References for Dragging / Transforming
  const canvasRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const imageLayerInputRef = useRef<HTMLInputElement>(null);
  const layerReplaceInputRef = useRef<HTMLInputElement>(null);
  const transformRef = useRef<{
    type: "move" | "resize" | "rotate" | "pan" | "marquee" | "multi-resize";
    handle?: string;
    startX: number;
    startY: number;
    elemStartX: number;
    elemStartY: number;
    elemStartW: number;
    elemStartH: number;
    elemStartRot: number;
    elemStartFontSize?: number;
    startAngle?: number;
    centerX: number;
    centerY: number;
    initialPositions?: { id: string; x: number; y: number; width?: number; height?: number; fontSize?: number }[];
  } | null>(null);

  // Load existing campaign if editing
  useEffect(() => {
    if (campaignId) {
      const items = getLocalBroadcastItems();
      const existing = items.find((i) => i.id === campaignId);
      if (existing) {
        setId(existing.id);
        setTitle(existing.title || "Custom Broadcast");
        setSubtitle(existing.subtitle || "");
        setImageUrl(existing.imageUrl || "");
        setCtaLabel(existing.ctaLabel || "Visit");
        setCtaLink(existing.ctaLink || "/shop");
        setIsActive(existing.status === "active");

        if (existing.designConfig) {
          if (existing.designConfig.borderRadius !== undefined) setBorderRadius(existing.designConfig.borderRadius);
          if (existing.designConfig.showBottomShadow !== undefined) setShowBottomShadow(existing.designConfig.showBottomShadow);
          if (existing.designConfig.isFrameless !== undefined) setIsFrameless(existing.designConfig.isFrameless);
          if (existing.designConfig.backgroundColor) setBgColor(existing.designConfig.backgroundColor);
          if (existing.designConfig.elements && existing.designConfig.elements.length > 0) {
            let loadedElems = [...existing.designConfig.elements];
            const hasBg = loadedElems.some((el) => el.isBackground || el.id === "bg-image");
            if (!hasBg && existing.imageUrl) {
              loadedElems = [
                {
                  id: "bg-image",
                  type: "image",
                  text: "Background Graphic",
                  imageUrl: existing.imageUrl,
                  x: 0,
                  y: 0,
                  width: 380,
                  height: 475,
                  rotation: 0,
                  borderRadius: 0,
                  isBackground: true,
                },
                ...loadedElems,
              ];
            }
            const shouldHaveShadow = existing.designConfig.showBottomShadow !== false;
            if (shouldHaveShadow && !loadedElems.some((el) => el.type === "shadow_overlay" || el.id === "bottom-shadow-overlay")) {
              const bgIdx = loadedElems.findIndex((el) => el.isBackground || el.id === "bg-image");
              const shadowElem: CanvasElement = {
                id: "bottom-shadow-overlay",
                type: "shadow_overlay",
                text: "Black Fade Overlay",
                x: 0,
                y: 166,
                width: 380,
                height: 309,
                rotation: 0,
                borderRadius: 0,
              };
              if (bgIdx !== -1) {
                loadedElems.splice(bgIdx + 1, 0, shadowElem);
              } else {
                loadedElems.unshift(shadowElem);
              }
            }
            setElements(loadedElems);
          }
        } else {
          // Initialize elements populated only with existing campaign's actual fields
          const initialElems: CanvasElement[] = [];
          if (existing.imageUrl) {
            initialElems.push({
              id: "bg-image",
              type: "image",
              text: "Background Graphic",
              imageUrl: existing.imageUrl,
              x: 0,
              y: 0,
              width: 380,
              height: 475,
              rotation: 0,
              borderRadius: 0,
              isBackground: true,
            });
          }
          initialElems.push({
            id: "bottom-shadow-overlay",
            type: "shadow_overlay",
            text: "Black Fade Overlay",
            x: 0,
            y: 166,
            width: 380,
            height: 309,
            rotation: 0,
            borderRadius: 0,
          });
          if (existing.title) {
            initialElems.push({
              id: "elem-title",
              type: "title",
              text: existing.title,
              x: 24,
              y: 295,
              width: 330,
              height: 36,
              rotation: 0,
              fontSize: 22,
              fontWeight: "black",
              color: "#FFFFFF",
            });
          }
          if (existing.subtitle) {
            initialElems.push({
              id: "elem-subtitle",
              type: "subtitle",
              text: existing.subtitle,
              x: 24,
              y: 335,
              width: 330,
              height: 48,
              rotation: 0,
              fontSize: 13,
              fontWeight: "normal",
              color: "#E5E5E5",
            });
          }
          if (existing.ctaLabel) {
            initialElems.push({
              id: "elem-cta",
              type: "button",
              text: existing.ctaLabel,
              x: 20,
              y: 405,
              width: 340,
              height: 48,
              rotation: 0,
              fontSize: 13,
              fontWeight: "black",
              color: "#000000",
              backgroundColor: "#EDCF5D",
              borderRadius: 16,
              ctaLink: existing.ctaLink || "/shop",
            });
          }
          setElements(initialElems);
        }
      }
    } else if (isNew) {
      // Clean slate for brand new campaign
      setId(`broadcast-${Date.now()}`);
      setTitle("");
      setSubtitle("");
      setImageUrl("");
      setCtaLabel("Visit");
      setCtaLink("/shop");
      setIsActive(true);
      setElements([
        {
          id: "bottom-shadow-overlay",
          type: "shadow_overlay",
          text: "Black Fade Overlay",
          x: 0,
          y: 166,
          width: 380,
          height: 309,
          rotation: 0,
          borderRadius: 0,
        },
      ]);
    }
  }, [campaignId, isNew]);

  // Ensure default black fade overlay layer exists on mount
  useEffect(() => {
    setElements((prev) => {
      const hasShadow = prev.some((el) => el.type === "shadow_overlay" || el.id === "bottom-shadow-overlay");
      if (hasShadow) return prev;
      const bgIdx = prev.findIndex((el) => el.isBackground || el.id === "bg-image");
      const shadowElem: CanvasElement = {
        id: "bottom-shadow-overlay",
        type: "shadow_overlay",
        text: "Black Fade Overlay",
        x: 0,
        y: 166,
        width: 380,
        height: 309,
        rotation: 0,
        borderRadius: 0,
      };
      if (bgIdx !== -1) {
        const next = [...prev];
        next.splice(bgIdx + 1, 0, shadowElem);
        return next;
      }
      return [shadowElem, ...prev];
    });
  }, []);

  // Selected element shortcut
  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

  // Helper to synchronize single and multi selection state
  const setSelection = (ids: string[]) => {
    setSelectedElementIds(ids);
    if (ids.length === 0) {
      setSelectedElementId(null);
    } else {
      setSelectedElementId(ids[ids.length - 1] ?? null);
    }
  };

  // Select an element with support for Shift/Ctrl/Cmd multi-selection and groups
  const handleSelectElement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab("inspector");

    // If mouse was dragged/moved during mousedown, do not toggle selection on click release
    if (hasMovedMouseRef.current) {
      hasMovedMouseRef.current = false;
      return;
    }

    const isMultiKey = e.ctrlKey || e.metaKey || e.shiftKey;
    const clickedElem = elements.find((el) => el.id === id);

    if (isMultiKey) {
      // Toggle element in multi-selection
      // If clicked element has groupId, toggle its whole group together
      const relatedIds = clickedElem?.groupId
        ? elements.filter((el) => el.groupId === clickedElem.groupId).map((el) => el.id)
        : [id];

      const allPresent = relatedIds.every((rid) => selectedElementIds.includes(rid));
      let nextIds: string[];
      if (allPresent) {
        // Deselect
        nextIds = selectedElementIds.filter((sid) => !relatedIds.includes(sid));
      } else {
        // Add
        nextIds = Array.from(new Set([...selectedElementIds, ...relatedIds]));
      }
      setSelection(nextIds);
    } else {
      // Normal click: if element is in a group, select the whole group!
      if (clickedElem?.groupId) {
        const groupMembers = elements
          .filter((el) => el.groupId === clickedElem.groupId)
          .map((el) => el.id);
        setSelection(groupMembers);
      } else {
        setSelection([id]);
      }
    }
  };

  // Double-clicking an item in a group isolates and selects ONLY that item directly
  const handleDoubleClickElement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelection([id]);
    setActiveTab("inspector");
  };

  // Group selected elements together
  const handleGroupElements = () => {
    if (selectedElementIds.length < 2) return;
    pushHistorySnapshot();
    const newGroupId = `grp-${Date.now()}`;
    setElements((prev) =>
      prev.map((el) =>
        selectedElementIds.includes(el.id) ? { ...el, groupId: newGroupId } : el
      )
    );
  };

  // Ungroup selected elements
  const handleUngroupElements = () => {
    if (selectedElementIds.length === 0) return;
    pushHistorySnapshot();
    const groupsToRemove = new Set(
      elements
        .filter((el) => selectedElementIds.includes(el.id) && el.groupId)
        .map((el) => el.groupId as string)
    );
    setElements((prev) =>
      prev.map((el) => {
        if (selectedElementIds.includes(el.id) || (el.groupId && groupsToRemove.has(el.groupId))) {
          const { groupId, ...rest } = el;
          return rest as CanvasElement;
        }
        return el;
      })
    );
  };

  // Deselect on clicking empty canvas
  const handleCanvasClick = (e: React.MouseEvent) => {
    // If user just finished dragging a marquee selection box, do not clear selection
    if (hasDraggedMarqueeRef.current) {
      hasDraggedMarqueeRef.current = false;
      return;
    }
    if (
      (e.target as HTMLElement).closest(".banner-element") ||
      (e.target as HTMLElement).closest(".selection-overlay-control")
    ) {
      return;
    }
    setSelection([]);
    setIsToolbarMenuOpen(false);
    setActiveGuides([]);
  };

  // Helper to calculate full-display dimensions preserving natural aspect ratio
  const calculateBgDimensions = (nw: number, nh: number) => {
    const safeW = nw > 0 ? nw : 380;
    const safeH = nh > 0 ? nh : 475;
    const aspect = safeW / safeH;
    let width = 380;
    let height = 475;
    if (aspect >= 380 / 475) {
      height = 475;
      width = Math.round(475 * aspect);
    } else {
      width = 380;
      height = Math.round(380 / aspect);
    }
    const x = Math.round((380 - width) / 2);
    const y = Math.round((475 - height) / 2);
    return { width, height, x, y };
  };

  // Apply quick presets
  const handleApplyPreset = (p: (typeof CURATED_PRESETS)[0]) => {
    setImageUrl(p.url);
    setTitle(p.title);
    setSubtitle(p.subtitle);
    setCtaLabel(p.cta);
    setCtaLink(p.link);

    const img = new window.Image();
    img.onload = () => {
      const { width, height, x, y } = calculateBgDimensions(img.naturalWidth, img.naturalHeight);
      setElements((prev) => {
        const bgIdx = prev.findIndex((el) => el.isBackground || el.id === "bg-image");
        let next = prev.map((el) => {
          if (el.type === "title") return { ...el, text: p.title };
          if (el.type === "subtitle") return { ...el, text: p.subtitle };
          if (el.type === "button") return { ...el, text: p.cta, ctaLink: p.link };
          return el;
        });
        const newBg: CanvasElement = {
          id: "bg-image",
          type: "image",
          text: "Background Graphic",
          imageUrl: p.url,
          x,
          y,
          width,
          height,
          rotation: 0,
          borderRadius: 0,
          isBackground: true,
        };
        if (bgIdx >= 0 && next[bgIdx]) {
          next[bgIdx] = newBg;
        } else {
          next = [newBg, ...next];
        }
        return next;
      });
      setSelectedElementId("bg-image");
    };
    img.src = p.url;
  };

  // File select & upload handler (preview locally, upload on publish)
  const handleFileSelect = (file: File) => {
    setPendingImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);

    const img = new window.Image();
    img.onload = () => {
      pushHistorySnapshot();
      const { width, height, x, y } = calculateBgDimensions(img.naturalWidth, img.naturalHeight);
      setElements((prev) => {
        const bgIdx = prev.findIndex((el) => el.isBackground || el.id === "bg-image");
        const newBg: CanvasElement = {
          id: "bg-image",
          type: "image",
          text: "Background Graphic",
          imageUrl: objectUrl,
          x,
          y,
          width,
          height,
          rotation: 0,
          borderRadius: 0,
          isBackground: true,
        };
        if (bgIdx >= 0 && prev[bgIdx]) {
          const next = [...prev];
          next[bgIdx] = newBg;
          return next;
        }
        return [newBg, ...prev];
      });
      setSelectedElementId("bg-image");
    };
    img.src = objectUrl;

    uploadToCloudinary(file, "gts/broadcast")
      .then((res) => {
        if (res?.url) {
          setImageUrl(res.url);
          setElements((prev) =>
            prev.map((el) =>
              el.isBackground || el.id === "bg-image" ? { ...el, imageUrl: res.url } : el
            )
          );
        }
      })
      .catch((err) => {
        console.error("Cloudinary upload failed for banner bg:", err);
      });
  };

  const handleClearBackgroundImage = () => {
    pushHistorySnapshot();
    setImageUrl("");
    setPendingImageFile(null);
    setElements((prev) => prev.filter((el) => !el.isBackground && el.id !== "bg-image"));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  // Add new layer elements
  const handleAddElement = (
    type: CanvasElement["type"],
    dropCoords?: { x: number; y: number },
    preset?: Partial<CanvasElement>
  ) => {
    pushHistorySnapshot();
    const newId = generateUniqueElementId("elem");
    let newElem: CanvasElement;

    const defaultDimensions: Record<
      string,
      { w: number; h: number; defaultX: number; defaultY: number }
    > = {
      image: { w: 160, h: 160, defaultX: 110, defaultY: 130 },
      title: { w: 320, h: 36, defaultX: 30, defaultY: 180 },
      subtitle: { w: 320, h: 40, defaultX: 30, defaultY: 220 },
      badge: { w: 120, h: 24, defaultX: 30, defaultY: 240 },
      button: { w: 320, h: 48, defaultX: 30, defaultY: 380 },
      custom_text: { w: 250, h: 30, defaultX: 30, defaultY: 200 },
      container: { w: 320, h: 110, defaultX: 30, defaultY: 140 },
      circle: { w: 84, h: 84, defaultX: 148, defaultY: 80 },
      seal: { w: 90, h: 90, defaultX: 145, defaultY: 80 },
      burst: { w: 90, h: 90, defaultX: 145, defaultY: 80 },
      speech: { w: 105, h: 80, defaultX: 137, defaultY: 80 },
      cloud: { w: 105, h: 80, defaultX: 137, defaultY: 80 },
      arrow: { w: 95, h: 60, defaultX: 142, defaultY: 80 },
    };

    const dim = defaultDimensions[type] || { w: 200, h: 40, defaultX: 30, defaultY: 200 };
    if (preset?.text || type === "custom_text") {
      const measured = measureElementContentSize({ type, ...preset });
      if (measured.width) dim.w = measured.width;
      if (measured.height) dim.h = measured.height;
    }
    let posX = dim.defaultX;
    let posY = dim.defaultY;

    if (dropCoords) {
      posX = Math.max(10, Math.min(380 - dim.w - 10, Math.round(dropCoords.x - dim.w / 2)));
      posY = Math.max(10, Math.min(475 - dim.h - 10, Math.round(dropCoords.y - dim.h / 2)));
    }

    if (type === "image") {
      newElem = {
        id: newId,
        type: "image",
        text: "Image Layer",
        imageUrl:
          preset?.imageUrl ||
          "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=600&auto=format&fit=crop",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        borderRadius: 0,
        shadowPreset: "none",
        shadowBlur: 0,
      };
    } else if (type === "title") {
      newElem = {
        id: newId,
        type: "title",
        text: "NEW HEADLINE",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 22,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#FFFFFF",
      };
    } else if (type === "subtitle") {
      newElem = {
        id: newId,
        type: "subtitle",
        text: "Add descriptive promotion details here.",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 13,
        fontWeight: "normal",
        fontFamily: "Satoshi, sans-serif",
        color: "#D4D4D4",
      };
    } else if (type === "badge") {
      newElem = {
        id: newId,
        type: "badge",
        text: "SPECIAL OFFER",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 10,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#000000",
        backgroundColor: "#EDCF5D",
        borderRadius: 9999,
        padding: "3px 10px",
        isPill: true,
      };
    } else if (type === "button") {
      newElem = {
        id: newId,
        type: "button",
        text: "Explore Now",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 13,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#000000",
        backgroundColor: "#EDCF5D",
        borderRadius: 16,
        ctaLink: "/shop",
      };
    } else if (type === "container") {
      newElem = {
        id: newId,
        type: "container",
        text: "",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
        borderRadius: 14,
        color: "#FFFFFF",
      };
    } else if (type === "circle") {
      newElem = {
        id: newId,
        type: "circle",
        text: "50% OFF",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 12,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#000000",
        backgroundColor: "#EDCF5D",
        borderRadius: 9999,
      };
    } else if (type === "seal") {
      newElem = {
        id: newId,
        type: "seal",
        text: "100% QUALITY",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 10,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#000000",
        backgroundColor: "#EDCF5D",
      };
    } else if (type === "burst") {
      newElem = {
        id: newId,
        type: "burst",
        text: "HOT!",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 13,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#000000",
        backgroundColor: "#EDCF5D",
      };
    } else if (type === "speech") {
      newElem = {
        id: newId,
        type: "speech",
        text: "HELLO!",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 12,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#000000",
        backgroundColor: "#EDCF5D",
      };
    } else if (type === "cloud") {
      newElem = {
        id: newId,
        type: "cloud",
        text: "WOW!",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 12,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#000000",
        backgroundColor: "#EDCF5D",
      };
    } else if (type === "arrow") {
      newElem = {
        id: newId,
        type: "arrow",
        text: "GO",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 13,
        fontWeight: "black",
        fontFamily: "Satoshi, sans-serif",
        color: "#000000",
        backgroundColor: "#EDCF5D",
      };
    } else {
      newElem = {
        id: newId,
        type: "custom_text",
        text: "Special Offer Text",
        x: posX,
        y: posY,
        width: dim.w,
        height: dim.h,
        rotation: 0,
        fontSize: 15,
        fontWeight: "bold",
        fontFamily: "Satoshi, sans-serif",
        color: "#EDCF5D",
      };
    }

    if (preset) {
      newElem = { ...newElem, ...preset };
    }

    setElements((prev) => [...prev, newElem]);
    setSelectedElementId(newId);
    setActiveTab("inspector");
  };

  // Delete element (single or multi-selection)
  const handleDeleteElement = (elemId?: string) => {
    pushHistorySnapshot();
    const targetIds = elemId && !selectedElementIds.includes(elemId)
      ? [elemId]
      : selectedElementIds.length > 0
      ? selectedElementIds
      : elemId
      ? [elemId]
      : [];

    if (targetIds.length === 0) return;

    setElements((prev) => {
      const next = prev.filter((item) => !targetIds.includes(item.id));
      if (prev.some((item) => targetIds.includes(item.id) && (item.isBackground || item.id === "bg-image"))) {
        setImageUrl("");
      }
      return next;
    });
    setSelection([]);
  };

  // Copy element to internal clipboard
  const handleCopyElement = (elem: CanvasElement) => {
    setClipboardElement(elem);
  };

  // Paste element from internal clipboard
  const handlePasteElement = () => {
    if (!clipboardElement) return;
    pushHistorySnapshot();
    const newId = generateUniqueElementId("elem");
    const newElem: CanvasElement = {
      ...clipboardElement,
      id: newId,
      x: Math.min(320, clipboardElement.x + 20),
      y: Math.min(420, clipboardElement.y + 20),
      isLocked: false,
      isBackground: false,
    };
    setElements((prev) => [...prev, newElem]);
    setSelection([newId]);
    setActiveTab("inspector");
  };

  // Duplicate element (single or multi-selection)
  const handleDuplicateElement = (elemId?: string) => {
    const targetIds = elemId && !selectedElementIds.includes(elemId)
      ? [elemId]
      : selectedElementIds.length > 0
      ? selectedElementIds
      : elemId
      ? [elemId]
      : [];

    if (targetIds.length === 0) return;
    pushHistorySnapshot();

    const timestamp = Date.now();
    const newIds: string[] = [];

    // If all duplicated items were in the same group, assign them a new shared groupId
    const groupedItems = elements.filter((el) => targetIds.includes(el.id));
    const singleOldGroup = targetIds.length > 1 && groupedItems.every((el) => el.groupId && el.groupId === groupedItems[0]?.groupId);
    const newSharedGroupId = singleOldGroup ? `grp-${timestamp}` : undefined;

    setElements((prev) => {
      const duplicates = prev
        .filter((el) => targetIds.includes(el.id))
        .map((target) => {
          const newId = generateUniqueElementId("elem");
          newIds.push(newId);
          const cloned: CanvasElement = {
            ...target,
            id: newId,
            x: Math.min(320, target.x + 15),
            y: Math.min(420, target.y + 15),
            isLocked: false,
            isBackground: false,
            groupId: newSharedGroupId || (target.groupId ? `grp-${timestamp}-${target.groupId}` : undefined),
          };
          return cloned;
        });

      return [...prev, ...duplicates];
    });

    setSelection(newIds);
    setActiveTab("inspector");
  };

  // Center element horizontally (and vertically if already centered horizontally or Shift is held)
  const handleCenterElement = (elemId: string, forceBoth = false) => {
    pushHistorySnapshot();
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === elemId) {
          const elemWidth = el.width || 200;
          const elemHeight = el.height || 40;
          const bannerW = 380;
          const bannerH = 475;
          const targetX = Math.round((bannerW - elemWidth) / 2);
          const targetY = Math.round((bannerH - elemHeight) / 2);

          if (forceBoth || el.x === targetX) {
            return { ...el, x: targetX, y: targetY };
          }
          return { ...el, x: targetX };
        }
        return el;
      })
    );
  };

  // Add new image layer from file
  const handleImageLayerFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    handleAddElement("image", undefined, { imageUrl: objectUrl });

    uploadToCloudinary(file, "gts/broadcast")
      .then((res) => {
        if (res?.url) {
          setElements((prev) =>
            prev.map((el) => (el.imageUrl === objectUrl ? { ...el, imageUrl: res.url } : el))
          );
        }
      })
      .catch((err) => {
        console.error("Cloudinary upload failed for layer image:", err);
      });

    e.target.value = "";
  };

  // Replace image of currently selected image layer
  const handleReplaceLayerImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElementId) return;

    pushHistorySnapshot();
    const objectUrl = URL.createObjectURL(file);
    updateSelectedElement({ imageUrl: objectUrl });

    uploadToCloudinary(file, "gts/broadcast")
      .then((res) => {
        if (res?.url) {
          updateSelectedElement({ imageUrl: res.url });
        }
      })
      .catch((err) => {
        console.error("Cloudinary upload failed for layer replace:", err);
      });

    e.target.value = "";
  };

  // Handle dragging & dropping image files directly onto canvas to add them as layers
  const handleDropImageFiles = (files: File[], coords?: { x: number; y: number }) => {
    pushHistorySnapshot();
    files.forEach((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const nw = img.naturalWidth || 200;
        const nh = img.naturalHeight || 200;
        const maxDim = 200;
        let w = nw;
        let h = nh;
        if (w > maxDim || h > maxDim) {
          const ratio = w / nh;
          if (ratio >= 1) {
            w = maxDim;
            h = Math.round(maxDim / ratio);
          } else {
            h = maxDim;
            w = Math.round(maxDim * ratio);
          }
        }

        const stagger = index * 20;
        const targetX = coords ? coords.x : CANVAS_W / 2;
        const targetY = coords ? coords.y : CANVAS_H / 2;
        const posX = Math.max(10, Math.min(380 - w - 10, Math.round(targetX - w / 2 + stagger)));
        const posY = Math.max(10, Math.min(475 - h - 10, Math.round(targetY - h / 2 + stagger)));

        const newId = `elem-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        const newElem: CanvasElement = {
          id: newId,
          type: "image",
          text: file.name.replace(/\.[^/.]+$/, "") || "Image Layer",
          imageUrl: objectUrl,
          x: posX,
          y: posY,
          width: w,
          height: h,
          rotation: 0,
          borderRadius: 0,
          flipX: false,
          flipY: false,
          shadowPreset: "none",
          shadowBlur: 0,
        };

        setElements((prev) => [...prev, newElem]);
        setSelectedElementId(newId);
        setActiveTab("inspector");

        uploadToCloudinary(file, "gts/broadcast")
          .then((res) => {
            if (res?.url) {
              setElements((prev) =>
                prev.map((el) => (el.id === newId ? { ...el, imageUrl: res.url } : el))
              );
            }
          })
          .catch((err) => {
            console.error("Cloudinary upload failed for dropped image layer:", err);
          });
      };
      img.src = objectUrl;
    });
  };

  // Reorder canvas layer stack hierarchy
  const handleLayerDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("application/gts-layer-index", `${index}`);
    e.dataTransfer.effectAllowed = "move";
    setDraggedLayerIndex(index);
  };

  const handleLayerDragOver = (e: React.DragEvent, index: number) => {
    if (e.dataTransfer.types.includes("application/gts-layer-index")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverLayerIndex !== index) {
        setDragOverLayerIndex(index);
      }
    }
  };

  const handleLayerDragLeave = () => {
    setDragOverLayerIndex(null);
  };

  const handleLayerDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIndexStr = e.dataTransfer.getData("application/gts-layer-index");
    const sourceIndex = sourceIndexStr ? parseInt(sourceIndexStr, 10) : draggedLayerIndex;

    if (sourceIndex !== null && !isNaN(sourceIndex) && sourceIndex !== dropIndex) {
      pushHistorySnapshot();
      setElements((prev) => {
        const next = [...prev];
        const [moved] = next.splice(sourceIndex, 1);
        if (!moved) return prev;

        let targetDrop = dropIndex;
        const bgIndex = next.findIndex((el) => el.isBackground || el.id === "bg-image");

        // The black fade overlay can NEVER be behind the bg image
        if (moved.type === "shadow_overlay" || moved.id === "bottom-shadow-overlay") {
          if (bgIndex !== -1 && targetDrop <= bgIndex) {
            targetDrop = bgIndex + 1;
          }
        }

        // The bg image must always remain at the very bottom (index 0)
        if (moved.isBackground || moved.id === "bg-image") {
          targetDrop = 0;
        }

        next.splice(targetDrop, 0, moved);
        return next;
      });
    }

    setDraggedLayerIndex(null);
    setDragOverLayerIndex(null);
  };

  // Update selected element property
  const updateSelectedElement = (updates: Partial<CanvasElement>, recordHistory = false) => {
    if (!selectedElementId) return;
    if (recordHistory) {
      pushHistorySnapshot();
    }
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === selectedElementId) {
          const updated = { ...el, ...updates };

          // Automatically fit bounding box to content size when font size, text, or typography styles change
          if (
            (updates.fontSize !== undefined ||
              updates.text !== undefined ||
              updates.fontFamily !== undefined ||
              updates.fontWeight !== undefined ||
              updates.textTransform !== undefined) &&
            updates.width === undefined &&
            updates.height === undefined
          ) {
            const contentSize = measureElementContentSize(updated);
            if (contentSize) {
              updated.width = contentSize.width;
              updated.height = contentSize.height;
            }
          }

          // Keep main campaign fields in sync
          if (updated.type === "title") setTitle(updated.text);
          if (updated.type === "subtitle") setSubtitle(updated.text);
          if (updated.type === "button") {
            setCtaLabel(updated.text);
            if (updated.ctaLink) setCtaLink(updated.ctaLink);
          }
          return updated;
        }
        return el;
      })
    );
  };

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE TRANSFORMS (DRAGGING, RESIZING, ROTATING, PANNING)
  // ─────────────────────────────────────────────────────────────
  const startMove = (e: React.MouseEvent, elem: CanvasElement) => {
    if (isPanMode) return;
    e.stopPropagation();
    if (elem.isLocked) return;

    hasMovedMouseRef.current = false;

    const isMultiKey = e.ctrlKey || e.metaKey || e.shiftKey;
    const currentSelectedIds = selectedElementIdsRef.current;

    let activeIds: string[];
    if (isMultiKey) {
      // Do not mutate selection on mousedown with modifier keys; onClick will toggle cleanly.
      // Prepare activeIds so if the user holds Ctrl and drags, the selection moves together.
      activeIds = currentSelectedIds.includes(elem.id)
        ? currentSelectedIds
        : [...currentSelectedIds, elem.id];
    } else {
      if (currentSelectedIds.includes(elem.id)) {
        activeIds = currentSelectedIds;
      } else {
        if (elem.groupId) {
          activeIds = elements.filter((el) => el.groupId === elem.groupId).map((el) => el.id);
        } else {
          activeIds = [elem.id];
        }
        setSelection(activeIds);
      }
    }
    setActiveTab("inspector");

    dragStartSnapshotRef.current = getSnapshot();

    if (elem.id === "bg-image" || elem.isBackground) {
      setIsMovingBg(true);
    }

    const movingElements = elements.filter((el) => activeIds.includes(el.id));
    const initialPositions = movingElements.map((el) => ({ id: el.id, x: el.x, y: el.y }));

    transformRef.current = {
      type: "move",
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: elem.x,
      elemStartY: elem.y,
      elemStartW: elem.width || 200,
      elemStartH: elem.height || 40,
      elemStartRot: elem.rotation || 0,
      centerX: 0,
      centerY: 0,
      initialPositions,
    };
  };

  const startResize = (e: React.MouseEvent, handle: string, elem: CanvasElement) => {
    if (elem.isLocked) return;
    e.stopPropagation();
    dragStartSnapshotRef.current = getSnapshot();
    if (elem.id === "bg-image" || elem.isBackground) {
      setIsMovingBg(true);
    }
    const contentSize = measureElementContentSize(elem);
    const startW = elem.type === "custom_text" ? Math.max(elem.width || 0, contentSize.width) : (elem.width || 200);
    const startH = elem.type === "custom_text" ? Math.max(elem.height || 0, contentSize.height) : (elem.height || 40);

    transformRef.current = {
      type: "resize",
      handle,
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: elem.x,
      elemStartY: elem.y,
      elemStartW: startW,
      elemStartH: startH,
      elemStartRot: elem.rotation || 0,
      elemStartFontSize: elem.fontSize || 16,
      centerX: 0,
      centerY: 0,
    };
  };

  const startMultiResize = (
    e: React.MouseEvent,
    handle: string,
    box: { minX: number; minY: number; combW: number; combH: number }
  ) => {
    e.stopPropagation();
    dragStartSnapshotRef.current = getSnapshot();
    const selectedElems = elements.filter((el) => selectedElementIds.includes(el.id) && !el.isLocked);
    transformRef.current = {
      type: "multi-resize",
      handle,
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: box.minX,
      elemStartY: box.minY,
      elemStartW: box.combW,
      elemStartH: box.combH,
      elemStartRot: 0,
      centerX: 0,
      centerY: 0,
      initialPositions: selectedElems.map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width || 200,
        height: el.height || 40,
        fontSize: el.fontSize || 16,
      })),
    };
  };

  const startRotate = (e: React.MouseEvent, elem: CanvasElement) => {
    if (elem.isLocked) return;
    e.stopPropagation();
    dragStartSnapshotRef.current = getSnapshot();
    if (elem.id === "bg-image" || elem.isBackground) {
      setIsMovingBg(true);
    }
    const bannerEl = bannerRef.current;
    if (!bannerEl) return;

    const bannerRect = bannerEl.getBoundingClientRect();
    const elemCenterX = bannerRect.left + (elem.x + (elem.width || 200) / 2) * zoom;
    const elemCenterY = bannerRect.top + (elem.y + (elem.height || 40) / 2) * zoom;
    const startAngle = Math.atan2(e.clientY - elemCenterY, e.clientX - elemCenterX) * (180 / Math.PI);

    transformRef.current = {
      type: "rotate",
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: elem.x,
      elemStartY: elem.y,
      elemStartW: elem.width || 200,
      elemStartH: elem.height || 40,
      elemStartRot: elem.rotation || 0,
      startAngle,
      centerX: elemCenterX,
      centerY: elemCenterY,
    };
  };

  const startPan = (e: React.MouseEvent) => {
    if (!isPanMode && e.button !== 1) return; // middle click or pan mode
    e.preventDefault();
    transformRef.current = {
      type: "pan",
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: panOffset.x,
      elemStartY: panOffset.y,
      elemStartW: 0,
      elemStartH: 0,
      elemStartRot: 0,
      centerX: 0,
      centerY: 0,
    };
  };

  // Stage mouse down: handles pan mode, middle-click pan, and marquee lasso drag across stage & canvas
  const handleStageMouseDown = (e: React.MouseEvent) => {
    if (isPanMode || e.button === 1) {
      e.preventDefault();
      transformRef.current = {
        type: "pan",
        startX: e.clientX,
        startY: e.clientY,
        elemStartX: panOffset.x,
        elemStartY: panOffset.y,
        elemStartW: 0,
        elemStartH: 0,
        elemStartRot: 0,
        centerX: 0,
        centerY: 0,
      };
      return;
    }

    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(".banner-element") ||
      target.closest(".selection-overlay-control")
    ) {
      return;
    }

    // Start Marquee selection
    hasDraggedMarqueeRef.current = false;
    transformRef.current = {
      type: "marquee",
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: 0,
      elemStartY: 0,
      elemStartW: 0,
      elemStartH: 0,
      elemStartRot: 0,
      centerX: 0,
      centerY: 0,
    };
    setMarqueeBox({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };

  // Global Mouse Move & Up Listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const transform = transformRef.current;
      if (!transform) return;

      if (transform.type !== "move") {
        setActiveGuides((prev) => (prev.length > 0 ? [] : prev));
      }

      if (transform.type === "move") {
        const dx = (e.clientX - transform.startX) / zoom;
        const dy = (e.clientY - transform.startY) / zoom;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          hasMovedMouseRef.current = true;
        }

        if (transform.initialPositions && transform.initialPositions.length > 1) {
          // Multi-element move
          const posMap = new Map(transform.initialPositions.map((p) => [p.id, p]));
          setElements((prev) =>
            prev.map((el) => {
              const init = posMap.get(el.id);
              if (init && !el.isLocked) {
                return {
                  ...el,
                  x: Math.round(init.x + dx),
                  y: Math.round(init.y + dy),
                };
              }
              return el;
            })
          );
          setActiveGuides([]);
        } else {
          // Single element move with snapping
          const rawX = Math.round(transform.elemStartX + dx);
          const rawY = Math.round(transform.elemStartY + dy);

          if (selectedElementId) {
            const currentElem = elements.find((el) => el.id === selectedElementId);
            if (currentElem && currentElem.id !== "bg-image" && !currentElem.isBackground) {
              const contentSize = measureElementContentSize(currentElem);
              const elemW = currentElem.type === "custom_text"
                ? Math.max(currentElem.width || 0, contentSize.width)
                : (currentElem.width || contentSize.width || 200);
              const elemH = currentElem.type === "custom_text"
                ? Math.max(currentElem.height || 0, contentSize.height)
                : (currentElem.height || contentSize.height || 40);
              const { nextX, nextY, guides } = calculateSnappingAndGuides(
                rawX,
                rawY,
                elemW,
                elemH,
                selectedElementId,
                elements
              );
              setActiveGuides(guides);
              updateSelectedElement({ x: nextX, y: nextY });
            } else {
              setActiveGuides((prev) => (prev.length > 0 ? [] : prev));
              updateSelectedElement({ x: rawX, y: rawY });
            }
          } else {
            setActiveGuides((prev) => (prev.length > 0 ? [] : prev));
            updateSelectedElement({ x: rawX, y: rawY });
          }
        }
      } else if (transform.type === "resize" && transform.handle) {
        const dx = (e.clientX - transform.startX) / zoom;
        const dy = (e.clientY - transform.startY) / zoom;
        const h = transform.handle;

        let nextW = transform.elemStartW;
        let nextH = transform.elemStartH;
        let nextX = transform.elemStartX;
        let nextY = transform.elemStartY;

        const isCorner = (h.includes("n") || h.includes("s")) && (h.includes("e") || h.includes("w"));
        const isVerticalOnly = h === "n" || h === "s";
        const isHorizontalOnly = h === "e" || h === "w";

        // Horizontal resize
        if (h.includes("e")) {
          nextW = Math.max(30, Math.round(transform.elemStartW + dx));
        } else if (h.includes("w")) {
          nextW = Math.max(30, Math.round(transform.elemStartW - dx));
          nextX = Math.round(transform.elemStartX + (transform.elemStartW - nextW));
        }

        // Vertical resize
        if (h.includes("s")) {
          nextH = Math.max(16, Math.round(transform.elemStartH + dy));
        } else if (h.includes("n")) {
          nextH = Math.max(16, Math.round(transform.elemStartH - dy));
          nextY = Math.round(transform.elemStartY + (transform.elemStartH - nextH));
        }

        // Dynamic Text Expansion (Font Size & Dimensions)
        const startFontSize = transform.elemStartFontSize || 16;
        let nextFontSize = startFontSize;
        const currentElem = elements.find((el) => el.id === selectedElementId);

        if (isHorizontalOnly) {
          // Strict horizontal stretch only:
          // Keep vertical height locked to start height, font size locked to start font size.
          // Container or text element widens horizontally without changing font size or vertical height!
          nextH = transform.elemStartH;
          nextFontSize = startFontSize;
        } else if (isVerticalOnly) {
          // Strict vertical stretch only:
          // Keep horizontal width locked to start width, font size locked to start font size.
          nextW = transform.elemStartW;
          nextFontSize = startFontSize;
        } else if (isCorner) {
          // Corner dragging scales both dimensions and font size proportionally
          const scaleRatio = Math.max(
            nextW / Math.max(1, transform.elemStartW),
            nextH / Math.max(1, transform.elemStartH)
          );
          if (["title", "subtitle", "custom_text"].includes(currentElem?.type || "")) {
            nextFontSize = Math.max(8, Math.min(100, Math.round(startFontSize * scaleRatio)));
          }
          nextW = Math.round(transform.elemStartW * scaleRatio);
          nextH = Math.round(transform.elemStartH * scaleRatio);
          if (h.includes("w")) {
            nextX = Math.round(transform.elemStartX + (transform.elemStartW - nextW));
          }
          if (h.includes("n")) {
            nextY = Math.round(transform.elemStartY + (transform.elemStartH - nextH));
          }
        }

        updateSelectedElement({
          width: nextW,
          height: nextH,
          x: nextX,
          y: nextY,
          fontSize: nextFontSize,
        });
      } else if (transform.type === "multi-resize" && transform.handle && transform.initialPositions) {
        const dx = (e.clientX - transform.startX) / zoom;
        const dy = (e.clientY - transform.startY) / zoom;
        const h = transform.handle;

        let nextW = transform.elemStartW;
        let nextH = transform.elemStartH;
        let nextX = transform.elemStartX;
        let nextY = transform.elemStartY;

        if (h.includes("e")) {
          nextW = Math.max(40, Math.round(transform.elemStartW + dx));
        } else if (h.includes("w")) {
          nextW = Math.max(40, Math.round(transform.elemStartW - dx));
          nextX = Math.round(transform.elemStartX + (transform.elemStartW - nextW));
        }

        if (h.includes("s")) {
          nextH = Math.max(20, Math.round(transform.elemStartH + dy));
        } else if (h.includes("n")) {
          nextH = Math.max(20, Math.round(transform.elemStartH - dy));
          nextY = Math.round(transform.elemStartY + (transform.elemStartH - nextH));
        }

        const isHorizontalOnly = h === "e" || h === "w";
        const isVerticalOnly = h === "n" || h === "s";
        const isCorner = (h.includes("n") || h.includes("s")) && (h.includes("e") || h.includes("w"));

        let scaleX = nextW / Math.max(1, transform.elemStartW);
        let scaleY = nextH / Math.max(1, transform.elemStartH);

        if (isHorizontalOnly) {
          scaleY = 1;
        } else if (isVerticalOnly) {
          scaleX = 1;
        } else if (isCorner) {
          const uniformScale = Math.max(scaleX, scaleY);
          scaleX = uniformScale;
          scaleY = uniformScale;
          nextW = Math.round(transform.elemStartW * uniformScale);
          nextH = Math.round(transform.elemStartH * uniformScale);
          if (h.includes("w")) {
            nextX = Math.round(transform.elemStartX + (transform.elemStartW - nextW));
          }
          if (h.includes("n")) {
            nextY = Math.round(transform.elemStartY + (transform.elemStartH - nextH));
          }
        }

        const posMap = new Map(transform.initialPositions.map((p) => [p.id, p]));
        setElements((prev) =>
          prev.map((el) => {
            const init = posMap.get(el.id);
            if (!init || el.isLocked) return el;

            const relX = init.x - transform.elemStartX;
            const relY = init.y - transform.elemStartY;

            const updatedX = Math.round(nextX + relX * scaleX);
            const updatedY = Math.round(nextY + relY * scaleY);
            const updatedW = Math.max(20, Math.round((init.width || 200) * scaleX));
            const updatedH = Math.max(10, Math.round((init.height || 40) * scaleY));

            let updatedFontSize = init.fontSize;
            if (isCorner && init.fontSize) {
              updatedFontSize = Math.max(8, Math.min(100, Math.round(init.fontSize * scaleX)));
            }

            return {
              ...el,
              x: updatedX,
              y: updatedY,
              width: updatedW,
              height: updatedH,
              ...(updatedFontSize ? { fontSize: updatedFontSize } : {}),
            };
          })
        );
      } else if (transform.type === "rotate") {
        const currentAngle =
          Math.atan2(e.clientY - transform.centerY, e.clientX - transform.centerX) *
          (180 / Math.PI);
        const angleDiff = currentAngle - (transform.startAngle ?? 0);
        let deg = Math.round(transform.elemStartRot + angleDiff);

        // Normalize between -180 and 180
        while (deg > 180) deg -= 360;
        while (deg < -180) deg += 360;

        // Snap to 0, 90, -90 if close
        if (Math.abs(deg) < 4) deg = 0;
        if (Math.abs(deg - 90) < 4) deg = 90;
        if (Math.abs(deg + 90) < 4) deg = -90;

        updateSelectedElement({ rotation: deg });
      } else if (transform.type === "pan") {
        const dx = e.clientX - transform.startX;
        const dy = e.clientY - transform.startY;
        setPanOffset({
          x: Math.round(transform.elemStartX + dx),
          y: Math.round(transform.elemStartY + dy),
        });
      } else if (transform.type === "marquee") {
        const curX = e.clientX;
        const curY = e.clientY;
        const boxX = Math.min(transform.startX, curX);
        const boxY = Math.min(transform.startY, curY);
        const boxW = Math.abs(curX - transform.startX);
        const boxH = Math.abs(curY - transform.startY);

        setMarqueeBox({ x: boxX, y: boxY, w: boxW, h: boxH });

        if (boxW > 3 || boxH > 3) {
          hasDraggedMarqueeRef.current = true;
          const domElements = document.querySelectorAll<HTMLElement>("[data-canvas-element-id]");
          const intersectingIds: string[] = [];
          const marqueeRect = {
            left: boxX,
            top: boxY,
            right: boxX + boxW,
            bottom: boxY + boxH,
          };

          domElements.forEach((dom) => {
            const elId = dom.getAttribute("data-canvas-element-id");
            if (!elId || elId === "bg-image") return;
            const r = dom.getBoundingClientRect();
            const intersects = !(
              r.right < marqueeRect.left ||
              r.left > marqueeRect.right ||
              r.bottom < marqueeRect.top ||
              r.top > marqueeRect.bottom
            );
            if (intersects) {
              intersectingIds.push(elId);
            }
          });

          // Expand groups: if any element in a group is intersected, include all members
          const finalIds = new Set<string>();
          intersectingIds.forEach((id) => {
            const el = elements.find((item) => item.id === id);
            if (el?.groupId) {
              elements
                .filter((item) => item.groupId === el.groupId)
                .forEach((m) => finalIds.add(m.id));
            } else {
              finalIds.add(id);
            }
          });

          const idsArr = Array.from(finalIds);
          setSelectedElementIds(idsArr);
          if (idsArr.length > 0) {
            setSelectedElementId(idsArr[idsArr.length - 1] ?? null);
          } else {
            setSelectedElementId(null);
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (dragStartSnapshotRef.current) {
        const startSnapshot = dragStartSnapshotRef.current;
        const currentElements = elementsRef.current;
        const hasChanged =
          JSON.stringify(startSnapshot.elements) !== JSON.stringify(currentElements);
        if (hasChanged) {
          setHistoryPast((prev) => {
            const next = [...prev.slice(-49), startSnapshot];
            historyPastRef.current = next;
            return next;
          });
          setHistoryFuture([]);
          historyFutureRef.current = [];
        }
        dragStartSnapshotRef.current = null;
      }
      if (transformRef.current?.type === "marquee") {
        setMarqueeBox(null);
      }
      transformRef.current = null;
      setIsMovingBg(false);
      setActiveGuides([]);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [zoom, selectedElementId, selectedElementIds, elements]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+C, Ctrl+V, Ctrl+D, Delete/Backspace, P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form inputs, textareas, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ctrl+Z / Cmd+Z: Undo (without Shift)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z OR Ctrl+Y / Cmd+Y: Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "z" || e.key === "Z")) ||
        ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y"))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+V / Cmd+V: Paste (works even if no element is selected)
      if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        if (clipboardElement) {
          e.preventDefault();
          handlePasteElement();
        }
        return;
      }

      // Ctrl+G / Cmd+G: Group elements (without Shift)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        handleGroupElements();
        return;
      }

      // Ctrl+Shift+G / Cmd+Shift+G: Ungroup elements
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        handleUngroupElements();
        return;
      }

      const hasSelection = selectedElementIds.length > 0 || Boolean(selectedElementId);
      if (!hasSelection) return;

      // Ctrl+C / Cmd+C: Copy selected element
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        const leadId = selectedElementId || selectedElementIds[0];
        const elem = elements.find((el) => el.id === leadId);
        if (elem) {
          e.preventDefault();
          handleCopyElement(elem);
        }
        return;
      }

      // Ctrl+D / Cmd+D: Duplicate selection
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleDuplicateElement();
        return;
      }

      // Delete key or Backspace key: Delete selection
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteElement();
        return;
      }

      // 'P' or 'p' key: Center selected element on canvas
      if (e.key === "p" || e.key === "P") {
        if (selectedElementId) {
          e.preventDefault();
          handleCenterElement(selectedElementId, e.shiftKey);
        }
        return;
      }

      // Arrow Keys: Nudge selected element(s) (1px precision, or 10px with Shift)
      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        const targetIds =
          selectedElementIds.length > 0
            ? selectedElementIds
            : selectedElementId
            ? [selectedElementId]
            : [];
        if (targetIds.length === 0) return;

        e.preventDefault();
        pushHistorySnapshot();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;

        setElements((prev) =>
          prev.map((el) => {
            if (targetIds.includes(el.id) && !el.isLocked) {
              return {
                ...el,
                x: Math.round(el.x + dx),
                y: Math.round(el.y + dy),
              };
            }
            return el;
          })
        );
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedElementId, selectedElementIds, clipboardElement, elements]);

  // Save Campaign (uploads pending image to Cloudinary first)
  const handleSaveCampaign = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    let finalImageUrl = imageUrl;
    if (pendingImageFile) {
      try {
        const uploadRes = await uploadToCloudinary(pendingImageFile, "gts/broadcast");
        if (uploadRes?.url) {
          finalImageUrl = uploadRes.url;
          setImageUrl(uploadRes.url);
          setPendingImageFile(null);
        }
      } catch (err) {
        console.error("Cloudinary upload failed during publish:", err);
      }
    }

    const finalElements = elements.map((el) => {
      if ((el.isBackground || el.id === "bg-image") && finalImageUrl) {
        return { ...el, imageUrl: finalImageUrl };
      }
      return el;
    });

    const designConfig: BroadcastDesignConfig = {
      borderRadius,
      showBottomShadow,
      isFrameless,
      elements: finalElements,
      backgroundColor: bgColor,
    };

    const payload: BroadcastItem = {
      id,
      title,
      subtitle,
      imageUrl: finalImageUrl,
      ctaLabel,
      ctaLink,
      isActive,
      status: isActive ? "active" : "disabled",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      designConfig,
      // Include expiresAt only if set; empty string means no expiry
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      analytics: {
        impressions: 0,
        uniqueVisitors: 0,
        avgAttentionSeconds: 0,
        clicks: 0,
        ctrPct: 0,
        dismissals: 0,
        desktopPct: 50,
        mobilePct: 50,
        retentionBreakdown: { under2s: 0, twoTo5s: 0, fiveTo10s: 0, over10s: 0 },
      },
    };

    // Save to local storage
    const currentItems = getLocalBroadcastItems();
    const existingIndex = currentItems.findIndex((i) => i.id === id);
    let updatedItems: BroadcastItem[];

    if (existingIndex >= 0) {
      updatedItems = currentItems.map((item, idx) =>
        idx === existingIndex
          ? {
              ...item,
              ...payload,
              analytics: item.analytics, // preserve analytics
              createdAt: item.createdAt,
            }
          : item
      );
    } else {
      updatedItems = [payload, ...currentItems];
    }

    setLocalBroadcastItems(updatedItems);

    // Save to server API via idempotentFetch with Auth header
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("gts_token") : null;
      const res = await idempotentFetch("/api/v1/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res?.ok) {
        const json = await res.json();
        if (json?.broadcasts && Array.isArray(json.broadcasts)) {
          // Merge server state with local storage
          const current = getLocalBroadcastItems();
          const merged = [...json.broadcasts];
          for (const item of current) {
            if (!merged.some((m) => m.id === item.id)) {
              merged.push(item);
            }
          }
          setLocalBroadcastItems(merged);
        }
      }
    } catch (err) {
      console.warn("Server save error:", err);
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0E0E0E] text-white select-none overflow-hidden font-sans">
      
      {/* ────── TOP STUDIO HEADER ────── */}
      <header className="h-16 px-6 border-b border-[#242424] bg-[#141414] flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <SidebarToggle className="text-gray-400 hover:text-white hover:bg-[#222222]" />

          <Link
            href="/admin/broadcast"
            className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#222222] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Campaigns</span>
          </Link>

          <div className="h-4 w-px bg-[#2C2C2C]" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono uppercase">Campaign:</span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setElements((prev) =>
                  prev.map((el) => (el.type === "title" ? { ...el, text: e.target.value } : el))
                );
              }}
              className="bg-transparent border-b border-transparent hover:border-[#383838] focus:border-[#EDCF5D] text-sm font-bold text-white px-1 py-0.5 outline-none transition-colors"
              placeholder="Campaign Title..."
            />
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveCampaign}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-[#EDCF5D] hover:bg-[#dfbe46] text-black font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>{pendingImageFile ? "Uploading & Saving..." : "Publishing..."}</span>
              </>
            ) : saveSuccess ? (
              <>
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Saved Live!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Save & Publish</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ────── MAIN STUDIO WORKSPACE (DOTTED GRID WITH FLOATING OVERLAY PANEL) ────── */}
      <div className="flex-1 relative overflow-hidden bg-[#0A0A0A] bg-[radial-gradient(#2E2E2E_1px,transparent_1px)] [background-size:24px_24px] flex p-2.5 gap-2.5">
        
        {/* ══════════════════════════════════════════════════════════════
            LEFT FLOATING OVERLAY PANEL (CONTROLS & INSPECTOR)
            ══════════════════════════════════════════════════════════════ */}
        <aside className="w-80 lg:w-[380px] h-full rounded-2xl border border-[#262626] bg-[#141414]/95 backdrop-blur-xl flex flex-col shrink-0 z-20 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden">
          
          {/* Tab Navigation (Segmented Curved Style) */}
          <div className="p-2 border-b border-[#242424] bg-[#141414]/90 shrink-0">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-[10px] bg-[#1C1C1E] border border-[#2A2A2E]">
              {[
                {
                  id: "card",
                  label: "Artwork",
                  icon: (
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
                    </svg>
                  ),
                },
                {
                  id: "elements",
                  label: "Add Layers",
                  icon: (
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  ),
                },
                {
                  id: "inspector",
                  label: "Inspector",
                  icon: (
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  ),
                },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-1.5 px-2 rounded-[8px] font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isActive
                        ? "bg-[#EDCF5D] text-black shadow-xs font-black"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
            
            {/* ── TAB 1: ARTWORK & CARD SETUP ── */}
            {activeTab === "card" && (
              <div className="space-y-4">

                {/* 0. Expiry Date */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    Expiry Date
                    <span className="text-gray-600 font-normal lowercase tracking-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      id="broadcast-expiry-date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#EDCF5D]/50 focus:ring-1 focus:ring-[#EDCF5D]/30 transition-colors cursor-pointer [color-scheme:dark]"
                      title="Broadcast auto-archives after this date/time"
                    />
                    {expiresAt && (
                      <button
                        type="button"
                        onClick={() => setExpiresAt("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Clear expiry"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {expiresAt && (
                    <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      Auto-archives: {new Date(expiresAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* 1. Background Graphic Upload Only */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                    <span>Background Image</span>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={handleClearBackgroundImage}
                        className="text-[10px] text-red-400 hover:text-red-300 font-medium cursor-pointer transition-colors"
                        title="Remove image to use solid banner background color"
                      >
                        Clear Image
                      </button>
                    )}
                  </label>

                  {/* Upload Dropzone */}
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("image/")) {
                        handleFileSelect(file);
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg bg-[#1A1A1A] cursor-pointer transition-colors group ${
                      isDragging ? "border-[#EDCF5D] bg-[#EDCF5D]/5" : "border-[#333333] hover:border-[#EDCF5D]"
                    }`}
                  >
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-[#EDCF5D] mb-1.5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white truncate max-w-[280px]">
                      {pendingImageFile ? pendingImageFile.name : "Click or Drag Image File"}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5">
                      {pendingImageFile
                        ? `${(pendingImageFile.size / 1024 / 1024).toFixed(2)} MB • uploads to Cloudinary on publish`
                        : "PNG, JPG, WebP up to 10MB"}
                    </span>
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#222222] border border-[#333333] text-[10px] font-mono text-gray-300 group-hover:border-[#EDCF5D]/50 transition-colors">
                      <span className="text-[#EDCF5D] font-bold">Aspect Ratio:</span>
                      <span>4:5 Portrait (380 × 475px)</span>
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                {/* 2. Bottom Shadow / Vignette Toggle */}
                <div className="pt-2 border-t border-[#222222] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">Bottom Shadow (Vignette)</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !showBottomShadow;
                        pushHistorySnapshot();
                        setShowBottomShadow(nextVal);
                        if (nextVal) {
                          setElements((prev) => {
                            if (prev.some((el) => el.type === "shadow_overlay" || el.id === "bottom-shadow-overlay")) {
                              return prev;
                            }
                            const bgIdx = prev.findIndex((el) => el.isBackground || el.id === "bg-image");
                            const shadowElem: CanvasElement = {
                              id: "bottom-shadow-overlay",
                              type: "shadow_overlay",
                              text: "Black Fade Overlay",
                              x: 0,
                              y: 166,
                              width: 380,
                              height: 309,
                              rotation: 0,
                              borderRadius: 0,
                            };
                            if (bgIdx !== -1) {
                              const next = [...prev];
                              next.splice(bgIdx + 1, 0, shadowElem);
                              return next;
                            }
                            return [shadowElem, ...prev];
                          });
                        } else {
                          setElements((prev) => prev.filter((el) => el.type !== "shadow_overlay" && el.id !== "bottom-shadow-overlay"));
                        }
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        showBottomShadow ? "bg-[#EDCF5D]" : "bg-neutral-800"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                          showBottomShadow ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 3. Banner Background Color */}
                <div className="pt-2 border-t border-[#222222] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">Banner Background Color</div>                    </div>
                    <span className="font-mono text-[11px] text-[#EDCF5D] uppercase font-bold">{bgColor}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-8 h-8 rounded-md bg-transparent border border-[#3A3A3A] cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      placeholder="#010101"
                      className="flex-1 px-3 py-1.5 rounded-md bg-[#1E1E1E] border border-[#2E2E2E] text-white font-mono text-xs outline-none focus:border-[#EDCF5D]"
                    />
                  </div>
                </div>

                {/* 4. Banner Border Radius */}
                <div className="pt-2 border-t border-[#222222] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Banner Corner Radius
                    </label>
                    <span className="font-mono text-xs text-[#EDCF5D] font-bold">{borderRadius}px</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "0px (Sharp)", val: 0 },
                      { label: "12px", val: 12 },
                      { label: "24px", val: 24 },
                      { label: "32px (Curved)", val: 32 },
                    ].map((r) => (
                      <button
                        key={r.val}
                        type="button"
                        onClick={() => setBorderRadius(r.val)}
                        className={`py-1.5 px-2 rounded-md border text-[11px] font-bold transition-all cursor-pointer ${
                          borderRadius === r.val
                            ? "bg-[#EDCF5D] text-black border-[#EDCF5D]"
                            : "bg-[#1A1A1A] border-[#2A2A2A] text-gray-300 hover:border-gray-500"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(Number(e.target.value))}
                    className="w-full accent-[#EDCF5D] cursor-pointer"
                  />
                </div>

                {/* 4. Card Frame Style */}
                <div className="pt-2 border-t border-[#222222] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">Frameless Artwork Mode</div>
                      <div className="text-[11px] text-gray-400">Remove outer card border, rendering image only</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFrameless(!isFrameless)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        isFrameless ? "bg-[#EDCF5D]" : "bg-neutral-800"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-1 ${
                          isFrameless ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* ── TAB 2: ADD LAYERS ── */}
            {activeTab === "elements" && (
              <div className="space-y-6">
                <div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {STUDIO_COMPONENTS.map((comp) => {
                      const isDotted = comp.isDotted || comp.type === "image";
                      return (
                        <div
                          key={comp.name}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/gts-element-type", comp.type);
                            e.dataTransfer.setData("text/plain", comp.type);
                            if (comp.preset) {
                              e.dataTransfer.setData(
                                "application/gts-element-preset",
                                JSON.stringify(comp.preset)
                              );
                            }
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onDragEnd={() => setIsDragOverBanner(false)}
                          onClick={() => {
                            if (comp.type === "image") {
                              imageLayerInputRef.current?.click();
                            } else {
                              handleAddElement(comp.type, undefined, comp.preset);
                            }
                          }}
                          className={`p-3 rounded-2xl transition-all cursor-pointer group text-center flex flex-col items-center justify-between gap-2.5 select-none shadow-sm ${
                            isDotted
                              ? "bg-[#161616] border-2 border-dashed border-[#383838] hover:border-[#EDCF5D] hover:bg-[#1C1C1C]"
                              : "bg-[#161616] border border-[#282828] hover:border-[#EDCF5D] hover:bg-[#1C1C1C]"
                          } active:scale-95`}
                          title={
                            comp.type === "image"
                              ? "Click to upload image or drag onto poster"
                              : "Click to add or drag directly onto poster"
                          }
                        >
                          {/* Live component preview */}
                          {comp.renderPreview()}

                          {/* Subtitle label */}
                          <div className="font-bold text-white text-xs group-hover:text-[#EDCF5D] transition-colors truncate w-full text-center">
                            {comp.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hidden file input for adding image layer */}
                  <input
                    ref={imageLayerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageLayerFilePick}
                    className="hidden"
                  />
                </div>

                {/* Layer Stack List */}
                <div className="space-y-2 pt-2 border-t border-[#222222]">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Canvas Layers ({elements.length})
                    </label>
                    <span className="text-[10px] text-gray-500 font-medium">
                      Drag handle to reorder
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {elements.map((el, i) => (
                      <div
                        key={`${el.id}-${i}`}
                        draggable
                        onDragStart={(e) => handleLayerDragStart(e, i)}
                        onDragOver={(e) => handleLayerDragOver(e, i)}
                        onDragLeave={handleLayerDragLeave}
                        onDrop={(e) => handleLayerDrop(e, i)}
                        onDragEnd={() => {
                          setDraggedLayerIndex(null);
                          setDragOverLayerIndex(null);
                        }}
                        onClick={(e) => {
                          handleSelectElement(el.id, e);
                        }}
                        className={`p-2.5 px-3 rounded-xl flex items-center justify-between cursor-pointer border transition-all select-none ${
                          dragOverLayerIndex === i
                            ? "border-[#EDCF5D] bg-[#1E1E1E] scale-[1.01]"
                            : selectedElementIds.includes(el.id) || selectedElementId === el.id
                            ? "bg-[#181818] border-[#2563EB] shadow-[0_0_12px_rgba(37,99,235,0.25)]"
                            : "bg-[#141414] border-[#242424] hover:border-[#383838] hover:bg-[#181818]"
                        } ${draggedLayerIndex === i ? "opacity-40" : "opacity-100"}`}
                      >
                        {/* Left: Layer Number & Miniature Live Component */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <span className="text-[10px] font-mono text-gray-500 w-3.5 shrink-0 select-none">
                            {i + 1}
                          </span>

                          <div className="truncate flex items-center gap-1.5 flex-1">
                            {el.groupId && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 shrink-0">
                                Group
                              </span>
                            )}
                            {el.type === "badge" && (
                              <span
                                style={{
                                  backgroundColor: el.backgroundColor || "#EDCF5D",
                                  color: el.color || "#000000",
                                  fontFamily: el.fontFamily || undefined,
                                }}
                                className="px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider shadow-sm truncate max-w-[170px] inline-block select-none"
                              >
                                {el.text}
                              </span>
                            )}

                            {el.type === "title" && (
                              <span
                                style={{
                                  color: el.color || "#FFFFFF",
                                  fontFamily: el.fontFamily || undefined,
                                }}
                                className="font-black text-xs uppercase tracking-tight truncate drop-shadow-sm max-w-[180px] block select-none"
                              >
                                {el.text}
                              </span>
                            )}

                            {el.type === "subtitle" && (
                              <span
                                style={{
                                  color: el.color || "#E5E5E5",
                                  fontFamily: el.fontFamily || undefined,
                                }}
                                className="text-[11px] text-gray-300 truncate max-w-[180px] block select-none"
                              >
                                {el.text}
                              </span>
                            )}

                            {el.type === "button" && (
                              <div
                                style={{
                                  backgroundColor: el.backgroundColor || "#EDCF5D",
                                  color: el.color || "#000000",
                                  fontFamily: el.fontFamily || undefined,
                                  border:
                                    el.backgroundColor === "transparent"
                                      ? "1px solid rgba(255,255,255,0.4)"
                                      : undefined,
                                }}
                                className="px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider shadow-sm truncate max-w-[170px] flex items-center gap-1 select-none"
                              >
                                <span className="truncate">{el.text}</span>
                                <svg
                                  className="w-2.5 h-2.5 shrink-0"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2.4}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                                  />
                                </svg>
                              </div>
                            )}

                            {el.type === "custom_text" && (
                              <span
                                style={{
                                  color: el.color || "#EDCF5D",
                                  fontFamily: el.fontFamily || undefined,
                                }}
                                className="font-bold text-xs truncate max-w-[180px] block select-none"
                              >
                                {el.text}
                              </span>
                            )}

                            {el.type === "container" && (
                              <div
                                style={{
                                  backgroundColor: el.backgroundColor || "rgba(255,255,255,0.1)",
                                  borderColor: el.borderColor || "rgba(255,255,255,0.3)",
                                }}
                                className="px-2 py-0.5 rounded border text-[10px] text-gray-200 truncate max-w-[170px] inline-block select-none"
                              >
                                {el.text || "Square Box"}
                              </div>
                            )}

                            {el.type === "circle" && (
                              <span
                                style={{
                                  backgroundColor: el.backgroundColor || "#EDCF5D",
                                  color: el.color || "#000000",
                                }}
                                className="w-5 h-5 rounded-full font-black text-[8px] uppercase flex items-center justify-center shadow-sm select-none shrink-0"
                              >
                                {el.text ? el.text.slice(0, 3) : "●"}
                              </span>
                            )}

                            {el.type === "seal" && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-[#EDCF5D] shrink-0" viewBox="0 0 100 100" fill="currentColor">
                                  <polygon points={SHAPE_SEAL_POINTS} />
                                </svg>
                                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[150px]">
                                  {el.text || "Seal Badge"}
                                </span>
                              </div>
                            )}

                            {el.type === "burst" && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-[#EDCF5D] shrink-0" viewBox="0 0 100 100" fill="currentColor">
                                  <polygon points={SHAPE_BURST_POINTS} />
                                </svg>
                                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[150px]">
                                  {el.text || "Starburst"}
                                </span>
                              </div>
                            )}

                            {el.type === "speech" && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-3.5 text-[#EDCF5D] shrink-0" viewBox="0 0 100 80" fill="currentColor">
                                  <path d={SHAPE_SPEECH_PATH} />
                                </svg>
                                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[150px]">
                                  {el.text || "Speech Bubble"}
                                </span>
                              </div>
                            )}

                            {el.type === "cloud" && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-3.5 text-[#EDCF5D] shrink-0" viewBox="0 0 100 80" fill="currentColor">
                                  <path d={SHAPE_CLOUD_PATH} />
                                </svg>
                                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[150px]">
                                  {el.text || "Cloud Bubble"}
                                </span>
                              </div>
                            )}

                            {el.type === "arrow" && (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-3 text-[#EDCF5D] shrink-0" viewBox="0 0 100 70" fill="currentColor">
                                  <path d={SHAPE_ARROW_PATH} />
                                </svg>
                                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[150px]">
                                  {el.text || "Arrow"}
                                </span>
                              </div>
                            )}

                            {el.type === "image" && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded overflow-hidden bg-black/60 border border-white/20 shrink-0 flex items-center justify-center">
                                  {el.imageUrl ? (
                                    <img src={el.imageUrl} alt="Layer" className="w-full h-full object-cover" />
                                  ) : (
                                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[150px]">
                                  Image Layer
                                </span>
                              </div>
                            )}

                            {el.type === "shadow_overlay" && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded overflow-hidden border border-white/20 bg-gradient-to-t from-black via-black/80 to-transparent shrink-0" />
                                <span className="text-[10px] font-bold text-gray-300 truncate max-w-[150px]">
                                  {el.text || "Black Fade Overlay"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Drag Handle Icon */}
                        <div
                          className="p-1 text-gray-500 hover:text-white cursor-grab active:cursor-grabbing transition-colors shrink-0"
                          title="Drag to change layer hierarchy"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-12a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: ELEMENT INSPECTOR ── */}
            {activeTab === "inspector" && (
              <div className="space-y-5">
                {selectedElementIds.length > 1 && (
                  <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/50 flex items-center justify-between text-xs text-blue-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      <span>{selectedElementIds.length} items in selection</span>
                    </div>
                    <div>
                      {(() => {
                        const selectedElems = elements.filter((el) => selectedElementIds.includes(el.id));
                        const firstGId = selectedElems[0]?.groupId;
                        const isFullyGrouped = Boolean(
                          firstGId && selectedElems.every((el) => el.groupId === firstGId)
                        );
                        return isFullyGrouped ? (
                          <button
                            type="button"
                            onClick={handleUngroupElements}
                            className="px-2.5 py-1 rounded-md bg-blue-900/60 hover:bg-blue-800 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            Ungroup
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleGroupElements}
                            className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            Group
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {selectedElement ? (
                  <>
                    {/* Element Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                      <div className="font-bold text-sm text-white truncate max-w-[200px]">
                        {selectedElement.type === "image"
                          ? selectedElement.isBackground
                            ? "Background Image"
                            : "Image Layer"
                          : selectedElement.text || "Element"}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Lock / Unlock Toggle Button */}
                        <button
                          type="button"
                          onClick={() => updateSelectedElement({ isLocked: !selectedElement.isLocked })}
                          className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                            selectedElement.isLocked
                              ? "bg-amber-950/40 text-amber-400 border-amber-900/50 hover:bg-amber-900/60"
                              : "bg-[#1E1E1E] text-gray-400 border-[#333] hover:text-white hover:bg-[#252525]"
                          }`}
                          title={selectedElement.isLocked ? "Unlock layer" : "Lock layer"}
                        >
                          {selectedElement.isLocked ? (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteElement(selectedElement.id)}
                          className="w-7 h-7 rounded-md bg-red-950/40 text-red-400 hover:bg-red-900/60 hover:text-red-300 border border-red-900/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          title="Delete layer (Delete / Backspace)"
                          aria-label="Delete layer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* ── IMAGE LAYER CONTROLS ── */}
                    {selectedElement.type === "image" && (
                      <div className="space-y-3">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Image Source
                        </label>

                        {selectedElement.imageUrl && (
                          <div className="w-full h-32 relative rounded-xl overflow-hidden border border-[#333] bg-black/40 shadow-inner flex items-center justify-center">
                            <img
                              src={selectedElement.imageUrl}
                              alt="Layer preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div>
                          <button
                            type="button"
                            onClick={() => layerReplaceInputRef.current?.click()}
                            className="w-full py-2 px-3 rounded-lg bg-[#222] hover:bg-[#2A2A2A] border border-[#333] hover:border-[#EDCF5D] text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <svg className="w-3.5 h-3.5 text-[#EDCF5D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <span>Replace Image File</span>
                          </button>
                          <input
                            ref={layerReplaceInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleReplaceLayerImage}
                            className="hidden"
                          />
                        </div>


                        {/* Image Corner Radius */}
                        <div className="space-y-2 pt-2 border-t border-[#242424]">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                              Corner Radius
                            </label>
                            <span className="font-mono text-xs text-[#EDCF5D] font-bold">
                              {selectedElement.borderRadius !== undefined ? selectedElement.borderRadius : 0}px
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: "0px", val: 0 },
                              { label: "8px", val: 8 },
                              { label: "16px", val: 16 },
                              { label: "Circle", val: 9999 },
                            ].map((r) => (
                              <button
                                key={r.label}
                                type="button"
                                onClick={() => updateSelectedElement({ borderRadius: r.val })}
                                className={`py-1 px-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer ${
                                  (selectedElement.borderRadius ?? 0) === r.val
                                    ? "bg-[#EDCF5D] text-black border-[#EDCF5D]"
                                    : "bg-[#1A1A1A] border-[#2A2A2A] text-gray-300 hover:border-gray-500"
                                }`}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={80}
                            value={selectedElement.borderRadius !== undefined ? Math.min(80, selectedElement.borderRadius) : 0}
                            onChange={(e) => updateSelectedElement({ borderRadius: Number(e.target.value) })}
                            className="w-full accent-[#EDCF5D] cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* ── SHADOW OVERLAY CONTROLS ── */}
                    {selectedElement.type === "shadow_overlay" && (
                      <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3.5">
                        <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                            Black Fade Overlay
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {selectedElement.height || 309}px
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-medium text-gray-400">Fade Coverage Height</label>
                            <span className="text-[11px] font-bold text-[#EDCF5D]">
                              {Math.round(((selectedElement.height || 309) / 475) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={50}
                            max={475}
                            value={selectedElement.height || 309}
                            onChange={(e) => {
                              const h = Number(e.target.value);
                              updateSelectedElement({ height: h, y: 475 - h });
                            }}
                            className="w-full accent-[#EDCF5D] cursor-pointer"
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          In the <strong>Layers</strong> tab on the left, you can drag layers above or below this overlay to place them in front of or behind the dark fade.
                        </p>
                      </div>
                    )}

                    {/* ── TEXT & SHAPE CONTROLS ── */}
                    {selectedElement.type !== "image" && selectedElement.type !== "shadow_overlay" && (
                      <>
                        {/* Text Content */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            Content Text
                          </label>
                          <textarea
                            rows={2}
                            value={selectedElement.text}
                            onChange={(e) => updateSelectedElement({ text: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-[#181818] border border-[#2B2B2B] text-white text-xs focus:border-[#EDCF5D] outline-none transition-colors"
                          />
                        </div>

                        {/* Typography Card (Image 1 & Image 2) */}
                        <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3.5">
                          <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                              Typography
                            </span>
                          </div>

                          {/* Row: Font Family */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-gray-400">Font Family</label>
                            <select
                              value={selectedElement.fontFamily || "Satoshi, sans-serif"}
                              onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl bg-[#1C1C1C] border border-[#2E2E2E] text-white text-xs outline-none focus:border-[#EDCF5D] cursor-pointer"
                              style={{ fontFamily: selectedElement.fontFamily || "inherit" }}
                            >
                              {FONT_OPTIONS.map((f) => (
                                <option
                                  key={f.value}
                                  value={f.value}
                                  style={{ fontFamily: f.value }}
                                  className="bg-[#1C1C1C] text-white py-1"
                                >
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Row: Font Size with Stepper */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium text-gray-400">Font Size</label>
                              <div className="inline-flex items-center rounded-lg border border-[#2E2E2E] bg-[#1C1C1C] p-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedElement({
                                      fontSize: Math.max(8, (selectedElement.fontSize || 16) - 1),
                                    })
                                  }
                                  className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-bold"
                                  title="Decrease font size"
                                >
                                  -
                                </button>
                                <span className="w-11 text-center font-mono text-xs font-bold text-[#EDCF5D]">
                                  {selectedElement.fontSize || 16}px
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedElement({
                                      fontSize: Math.min(120, (selectedElement.fontSize || 16) + 1),
                                    })
                                  }
                                  className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-bold"
                                  title="Increase font size"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={9}
                              max={96}
                              value={selectedElement.fontSize || 16}
                              onChange={(e) => updateSelectedElement({ fontSize: Number(e.target.value) })}
                              className="w-full accent-[#EDCF5D] cursor-pointer"
                            />
                          </div>

                          {/* Row: Text Alignment & Styling (Segmented Controls) */}
                          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#222222]">
                            {/* Text Alignment */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-gray-400">Align</label>
                              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A]">
                                {[
                                  {
                                    id: "left",
                                    label: "Left",
                                    icon: (
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h16.5" />
                                      </svg>
                                    ),
                                  },
                                  {
                                    id: "center",
                                    label: "Center",
                                    icon: (
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6.75 12h10.5m-13.5 5.25h16.5" />
                                      </svg>
                                    ),
                                  },
                                  {
                                    id: "right",
                                    label: "Right",
                                    icon: (
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M9.75 12h10.5m-16.5 5.25h16.5" />
                                      </svg>
                                    ),
                                  },
                                ].map((a) => {
                                  const isActive = (selectedElement.textAlign || "left") === a.id;
                                  return (
                                    <button
                                      key={a.id}
                                      type="button"
                                      onClick={() => updateSelectedElement({ textAlign: a.id as any })}
                                      className={`h-7.5 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                                        isActive
                                          ? "bg-[#EDCF5D] text-black shadow-xs font-bold"
                                          : "text-gray-400 hover:text-white hover:bg-white/5"
                                      }`}
                                      title={`Align ${a.label}`}
                                    >
                                      {a.icon}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Text Style (B, I, U, aA) */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-gray-400">Style</label>
                              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedElement({
                                      fontWeight:
                                        selectedElement.fontWeight === "bold" || selectedElement.fontWeight === "black"
                                          ? "normal"
                                          : "bold",
                                    })
                                  }
                                  className={`h-7.5 flex items-center justify-center rounded-md text-xs font-black transition-all cursor-pointer ${
                                    selectedElement.fontWeight === "bold" || selectedElement.fontWeight === "black"
                                      ? "bg-[#EDCF5D] text-black shadow-xs"
                                      : "text-gray-400 hover:text-white hover:bg-white/5"
                                  }`}
                                  title="Toggle Bold"
                                >
                                  B
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedElement({
                                      fontStyle: selectedElement.fontStyle === "italic" ? "normal" : "italic",
                                    })
                                  }
                                  className={`h-7.5 flex items-center justify-center rounded-md text-xs italic font-serif font-bold transition-all cursor-pointer ${
                                    selectedElement.fontStyle === "italic"
                                      ? "bg-[#EDCF5D] text-black shadow-xs"
                                      : "text-gray-400 hover:text-white hover:bg-white/5"
                                  }`}
                                  title="Toggle Italic"
                                >
                                  I
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedElement({
                                      textDecoration: selectedElement.textDecoration === "underline" ? "none" : "underline",
                                    })
                                  }
                                  className={`h-7.5 flex items-center justify-center rounded-md text-xs underline font-bold transition-all cursor-pointer ${
                                    selectedElement.textDecoration === "underline"
                                      ? "bg-[#EDCF5D] text-black shadow-xs"
                                      : "text-gray-400 hover:text-white hover:bg-white/5"
                                  }`}
                                  title="Toggle Underline"
                                >
                                  U
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedElement({
                                      textTransform: selectedElement.textTransform === "uppercase" ? "none" : "uppercase",
                                    })
                                  }
                                  className={`h-7.5 flex items-center justify-center rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                    selectedElement.textTransform === "uppercase"
                                      ? "bg-[#EDCF5D] text-black shadow-xs"
                                      : "text-gray-400 hover:text-white hover:bg-white/5"
                                  }`}
                                  title="Toggle Uppercase"
                                >
                                  aA
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Row: Text Color (Clean color square + hex, zero extra dots) */}
                          <div className="pt-2 border-t border-[#222222] space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-medium text-gray-400">Text Color</label>
                              <span className="font-mono text-[11px] text-[#EDCF5D] uppercase font-bold">
                                {selectedElement.color || "#FFFFFF"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedElement.color || "#FFFFFF"}
                                onChange={(e) => updateSelectedElement({ color: e.target.value })}
                                className="w-8 h-8 rounded-lg bg-transparent border border-[#3A3A3A] cursor-pointer p-0.5"
                              />
                              <input
                                type="text"
                                value={selectedElement.color || "#FFFFFF"}
                                onChange={(e) => updateSelectedElement({ color: e.target.value })}
                                placeholder="#FFFFFF"
                                className="flex-1 px-3 py-1.5 rounded-xl bg-[#1C1C1C] border border-[#2E2E2E] text-white font-mono text-xs outline-none focus:border-[#EDCF5D]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Background / Fill Color (Clean color square + hex, zero extra dots) */}
                        {(selectedElement.type === "button" ||
                          selectedElement.type === "badge" ||
                          selectedElement.type === "container" ||
                          selectedElement.type === "circle" ||
                          selectedElement.type === "seal" ||
                          selectedElement.type === "burst" ||
                          selectedElement.type === "speech" ||
                          selectedElement.type === "cloud" ||
                          selectedElement.type === "arrow") && (
                          <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-2.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                                {["seal", "burst", "speech", "cloud", "arrow"].includes(selectedElement.type)
                                  ? "Shape Fill Color"
                                  : "Background Fill"}
                              </label>
                              <span className="font-mono text-[11px] text-[#EDCF5D] uppercase font-bold">
                                {selectedElement.backgroundColor || "#EDCF5D"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedElement.backgroundColor || "#EDCF5D"}
                                onChange={(e) => updateSelectedElement({ backgroundColor: e.target.value })}
                                className="w-8 h-8 rounded-lg bg-transparent border border-[#3A3A3A] cursor-pointer p-0.5"
                              />
                              <input
                                type="text"
                                value={selectedElement.backgroundColor || "#EDCF5D"}
                                onChange={(e) => updateSelectedElement({ backgroundColor: e.target.value })}
                                placeholder="#EDCF5D"
                                className="flex-1 px-3 py-1.5 rounded-xl bg-[#1C1C1C] border border-[#2E2E2E] text-white font-mono text-xs outline-none focus:border-[#EDCF5D]"
                              />
                            </div>
                          </div>
                        )}

                        {/* Button Corner Radius */}
                        {selectedElement.type === "button" && (
                          <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                                Button Corner Radius
                              </label>
                              <span className="font-mono text-xs text-[#EDCF5D] font-bold">
                                {selectedElement.borderRadius !== undefined ? selectedElement.borderRadius : 16}px
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { label: "Sharp (0px)", val: 0 },
                                { label: "8px", val: 8 },
                                { label: "16px", val: 16 },
                                { label: "Pill", val: 9999 },
                              ].map((r) => (
                                <button
                                  key={r.label}
                                  type="button"
                                  onClick={() => updateSelectedElement({ borderRadius: r.val })}
                                  className={`py-1.5 px-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer ${
                                    (selectedElement.borderRadius ?? 16) === r.val
                                      ? "bg-[#EDCF5D] text-black border-[#EDCF5D]"
                                      : "bg-[#1C1C1C] border-[#2A2A2A] text-gray-300 hover:border-gray-500"
                                  }`}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={40}
                              value={selectedElement.borderRadius !== undefined ? Math.min(40, selectedElement.borderRadius) : 16}
                              onChange={(e) => updateSelectedElement({ borderRadius: Number(e.target.value) })}
                              className="w-full accent-[#EDCF5D] cursor-pointer"
                            />
                          </div>
                        )}

                        {/* Container Corner Radius */}
                        {selectedElement.type === "container" && (
                          <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                                Box Corner Radius
                              </label>
                              <span className="font-mono text-xs text-[#EDCF5D] font-bold">
                                {selectedElement.borderRadius !== undefined ? selectedElement.borderRadius : 14}px
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { label: "0px", val: 0 },
                                { label: "8px", val: 8 },
                                { label: "14px", val: 14 },
                                { label: "24px", val: 24 },
                              ].map((r) => (
                                <button
                                  key={r.label}
                                  type="button"
                                  onClick={() => updateSelectedElement({ borderRadius: r.val })}
                                  className={`py-1.5 px-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer ${
                                    (selectedElement.borderRadius ?? 14) === r.val
                                      ? "bg-[#EDCF5D] text-black border-[#EDCF5D]"
                                      : "bg-[#1C1C1C] border-[#2A2A2A] text-gray-300 hover:border-gray-500"
                                  }`}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={40}
                              value={selectedElement.borderRadius !== undefined ? selectedElement.borderRadius : 14}
                              onChange={(e) => updateSelectedElement({ borderRadius: Number(e.target.value) })}
                              className="w-full accent-[#EDCF5D] cursor-pointer"
                            />
                          </div>
                        )}

                        {/* CTA Link Target for Button */}
                        {selectedElement.type === "button" && (
                          <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                              Button Destination Link
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-[#1C1C1C] border border-[#2E2E2E] flex items-center justify-center text-gray-400 shrink-0">
                                <svg className="w-4 h-4 text-[#EDCF5D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                                </svg>
                              </div>
                              <input
                                type="text"
                                value={selectedElement.ctaLink || "/shop"}
                                onChange={(e) => updateSelectedElement({ ctaLink: e.target.value })}
                                className="flex-1 px-3 py-2 rounded-xl bg-[#1C1C1C] border border-[#2E2E2E] text-white font-mono text-xs focus:border-[#EDCF5D] outline-none"
                                placeholder="/shop?category=..."
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* ── ELEVATION & BACKGROUND SHADOW ── */}
                    {!selectedElement.isBackground && selectedElement.id !== "bg-image" && (() => {
                      const currentElevation =
                        selectedElement.shadowBlur !== undefined
                          ? selectedElement.shadowBlur
                          : selectedElement.shadowPreset === "subtle"
                          ? 8
                          : selectedElement.shadowPreset === "medium"
                          ? 20
                          : selectedElement.shadowPreset === "floating"
                          ? 32
                          : selectedElement.shadowPreset === "deep"
                          ? 48
                          : 0;

                      return (
                        <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
                          <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-[#EDCF5D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                              </svg>
                              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                                Elevation & Shadow
                              </label>
                            </div>
                            {currentElevation > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedElement(
                                    { shadowPreset: "none", shadowBlur: 0, shadowOffsetY: 0 },
                                    true
                                  )
                                }
                                className="text-[10px] text-red-400 hover:text-red-300 font-bold transition-colors cursor-pointer"
                              >
                                Reset
                              </button>
                            )}
                          </div>

                          {/* 1. Elevation Slider */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-400 font-medium">Elevation</span>
                              <span className="font-mono text-[#EDCF5D] font-bold">
                                {currentElevation === 0 ? "Flat" : `${currentElevation}px`}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={50}
                              value={currentElevation}
                              onPointerDown={() => pushHistorySnapshot()}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateSelectedElement({
                                  shadowBlur: val,
                                  shadowOffsetY: Math.round(val * 0.45),
                                  shadowPreset: val > 0 ? "custom" : "none",
                                });
                              }}
                              className="w-full accent-[#EDCF5D] cursor-pointer"
                            />
                          </div>

                          {/* 2. Color Picker */}
                          {currentElevation > 0 && (
                            <div className="space-y-2 pt-2 border-t border-[#222]">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-400 font-medium">Shadow Color</span>
                                <span className="font-mono text-xs text-gray-300">
                                  {selectedElement.shadowColor || "#000000"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={selectedElement.shadowColor || "#000000"}
                                  onChange={(e) =>
                                    updateSelectedElement({
                                      shadowColor: e.target.value,
                                      shadowPreset: "custom",
                                    })
                                  }
                                  className="w-8 h-8 rounded-lg bg-transparent border border-[#3A3A3A] cursor-pointer p-0.5"
                                  title="Shadow color picker"
                                />
                                <input
                                  type="text"
                                  value={selectedElement.shadowColor || "#000000"}
                                  onChange={(e) =>
                                    updateSelectedElement({
                                      shadowColor: e.target.value,
                                      shadowPreset: "custom",
                                    })
                                  }
                                  placeholder="#000000"
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#1C1C1C] border border-[#2E2E2E] text-white font-mono text-xs outline-none focus:border-[#EDCF5D]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Transform Coordinates */}
                    <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
                      <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                          Position & Transform
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                          <span className="text-gray-400 font-mono">X:</span>
                          <span className="font-mono font-bold text-white">{selectedElement.x}px</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                          <span className="text-gray-400 font-mono">Y:</span>
                          <span className="font-mono font-bold text-white">{selectedElement.y}px</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                          <span className="text-gray-400 font-mono">W:</span>
                          <span className="font-mono font-bold text-white">{selectedElement.width || 200}px</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-[#1C1C1C] border border-[#282828]">
                          <span className="text-gray-400 font-mono">H:</span>
                          <span className="font-mono font-bold text-white">{selectedElement.height || 40}px</span>
                        </div>
                      </div>

                      {/* Alignment Action */}
                      <button
                        type="button"
                        onClick={() => handleCenterElement(selectedElement.id)}
                        className="w-full py-2 px-3 rounded-xl bg-[#1C1C1C] hover:bg-[#252525] border border-[#2E2E2E] hover:border-[#EDCF5D]/40 text-gray-300 hover:text-white font-semibold text-xs transition-all flex items-center justify-between cursor-pointer"
                        title="Center selected layer on canvas (Press P)"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-[#EDCF5D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-7-9h14M8 8h8m-8 8h8" />
                          </svg>
                          <span>Center on Canvas</span>
                        </div>
                        <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-white/10 text-[#EDCF5D] border border-white/10">P</kbd>
                      </button>

                      {/* Flip Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => updateSelectedElement({ flipX: !selectedElement.flipX })}
                          className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedElement.flipX
                              ? "bg-[#EDCF5D]/15 border-[#EDCF5D] text-[#EDCF5D]"
                              : "bg-[#1C1C1C] hover:bg-[#252525] border-[#2E2E2E] text-gray-300 hover:text-white"
                          }`}
                          title={selectedElement.flipX ? "Unflip Horizontal" : "Flip Horizontal"}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M4.5 7.5L8.5 12l-4 4.5V7.5zm15 0L15.5 12l4 4.5V7.5z" />
                          </svg>
                          <span>Flip H</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedElement({ flipY: !selectedElement.flipY })}
                          className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            selectedElement.flipY
                              ? "bg-[#EDCF5D]/15 border-[#EDCF5D] text-[#EDCF5D]"
                              : "bg-[#1C1C1C] hover:bg-[#252525] border-[#2E2E2E] text-gray-300 hover:text-white"
                          }`}
                          title={selectedElement.flipY ? "Unflip Vertical" : "Flip Vertical"}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M7.5 4.5L12 8.5 16.5 4.5H7.5zm0 15L12 15.5 16.5 19.5H7.5z" />
                          </svg>
                          <span>Flip V</span>
                        </button>
                      </div>

                      {/* Rotation Slider */}
                      <div className="space-y-1.5 pt-2 border-t border-[#222222]">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400 font-medium">Rotation Angle</span>
                          <span className="font-mono text-[#EDCF5D] font-bold">{selectedElement.rotation || 0}°</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            value={selectedElement.rotation || 0}
                            onChange={(e) => updateSelectedElement({ rotation: Number(e.target.value) })}
                            className="flex-1 accent-[#EDCF5D] cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => updateSelectedElement({ rotation: 0 })}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#222] hover:bg-[#333] text-gray-300 hover:text-white cursor-pointer transition-colors"
                          >
                            Reset 0°
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#1A1A1A] border border-[#282828] text-[#EDCF5D] mx-auto flex items-center justify-center shadow-inner">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 7.49 5.865-3.32.748z" />
                      </svg>
                    </div>
                    <div className="font-bold text-gray-300">No Layer Selected</div>
                    <p className="text-[11px] text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Click any layer on the banner canvas to inspect its style, colors, rotation, and dimensions.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

        </aside>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT CANVAS WORKSPACE (DOTTED GRID & INTERACTIVE BANNER)
            ══════════════════════════════════════════════════════════════ */}
        <main
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleStageMouseDown}
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes("application/gts-element-type") ||
              e.dataTransfer.types.includes("text/plain") ||
              e.dataTransfer.types.includes("Files")
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOverBanner(false);
            const files = Array.from(e.dataTransfer.files || []).filter((f) =>
              f.type.startsWith("image/")
            );
            if (files.length > 0 && bannerRef.current) {
              const rect = bannerRef.current.getBoundingClientRect();
              const dropX = (e.clientX - rect.left) / zoom;
              const dropY = (e.clientY - rect.top) / zoom;
              handleDropImageFiles(files, { x: dropX, y: dropY });
              return;
            }
            const type = (e.dataTransfer.getData("application/gts-element-type") ||
              e.dataTransfer.getData("text/plain")) as any;
            if (!type || !bannerRef.current) return;
            const rect = bannerRef.current.getBoundingClientRect();
            const dropX = (e.clientX - rect.left) / zoom;
            const dropY = (e.clientY - rect.top) / zoom;
            let preset: Partial<CanvasElement> | undefined = undefined;
            const presetData = e.dataTransfer.getData("application/gts-element-preset");
            if (presetData) {
              try {
                preset = JSON.parse(presetData);
              } catch {}
            }
            handleAddElement(type, { x: dropX, y: dropY }, preset);
          }}
          className={`flex-1 h-full relative overflow-hidden flex items-center justify-center ${
            isPanMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
        >
          
          {/* Transformed Stage Viewport */}
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: transformRef.current ? "none" : "transform 0.15s ease-out",
            }}
            className="relative"
          >
            
            {/* ── BANNER CARD CONTAINER (Standard 380px x 475px aspect-[4/5]) ── */}
            {(() => {
              const bgElement = elements.find((el) => el.isBackground || el.id === "bg-image");
              const foregroundElements = elements.filter((el) => !el.isBackground && el.id !== "bg-image");
              const isBgSelected = selectedElementId === bgElement?.id;

              // Universal renderer for all canvas component types (used in both normal layer stack and off-canvas bleed)
              const renderCanvasElementContent = (el: CanvasElement, isBleed = false) => {
                const shadowStyle = computeElementShadow(el);

                switch (el.type) {
                  case "image":
                    return (
                      <div
                        style={{
                          borderRadius: el.borderRadius ? `${el.borderRadius}px` : "0px",
                          boxShadow: shadowStyle.boxShadow,
                        }}
                        className="w-full h-full relative overflow-hidden select-none"
                      >
                        {el.imageUrl ? (
                          <img
                            src={el.imageUrl}
                            alt={el.text || "Image layer"}
                            className="w-full h-full object-cover pointer-events-none select-none"
                            style={{ borderRadius: el.borderRadius ? `${el.borderRadius}px` : "0px" }}
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-full bg-[#181818] border border-[#333] flex flex-col items-center justify-center p-2 text-gray-400 text-xs select-none">
                            <svg className="w-6 h-6 mb-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px]">No image</span>
                          </div>
                        )}
                      </div>
                    );

                  case "shadow_overlay":
                    return (
                      <div
                        className="w-full h-full pointer-events-none"
                        style={{
                          background: el.backgroundColor || "linear-gradient(to top, rgba(1,1,1,0.95) 0%, rgba(1,1,1,0.7) 40%, rgba(1,1,1,0.2) 75%, transparent 100%)",
                          opacity: el.opacity ?? 1,
                          borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                        }}
                      />
                    );

                  case "badge":
                    return (
                      <div
                        style={{
                          backgroundColor: el.backgroundColor || "#EDCF5D",
                          color: el.color || "#000000",
                          borderRadius: el.borderRadius ? `${el.borderRadius}px` : "9999px",
                          fontSize: `${el.fontSize || 10}px`,
                          fontWeight: el.fontWeight || "bold",
                          fontFamily: el.fontFamily || undefined,
                          fontStyle: el.fontStyle || "normal",
                          textDecoration: el.textDecoration || "none",
                          textTransform: el.textTransform || "none",
                          textAlign: el.textAlign || "center",
                          boxShadow: shadowStyle.boxShadow || "0 4px 10px rgba(0,0,0,0.3)",
                        }}
                        className={`w-full h-full flex items-center px-3 tracking-wider font-mono whitespace-nowrap leading-none select-none ${
                          (el.textAlign || "center") === "left"
                            ? "justify-start text-left"
                            : (el.textAlign || "center") === "right"
                            ? "justify-end text-right"
                            : "justify-center text-center"
                        }`}
                      >
                        {el.text}
                      </div>
                    );

                  case "title":
                    return (
                      <h2
                        style={{
                          color: el.color || "#FFFFFF",
                          fontSize: `${el.fontSize || 22}px`,
                          fontWeight: el.fontWeight || "black",
                          fontFamily: el.fontFamily || undefined,
                          fontStyle: el.fontStyle || "normal",
                          textDecoration: el.textDecoration || "none",
                          textTransform: el.textTransform || "none",
                          textAlign: el.textAlign || "left",
                          filter: shadowStyle.filter || undefined,
                        }}
                        className={`w-full h-full flex items-center tracking-tight leading-tight select-none ${
                          (el.textAlign || "left") === "center"
                            ? "justify-center text-center"
                            : (el.textAlign || "left") === "right"
                            ? "justify-end text-right"
                            : "justify-start text-left"
                        } ${
                          shadowStyle.filter ? "" : "drop-shadow-md"
                        }`}
                      >
                        {el.text}
                      </h2>
                    );

                  case "subtitle":
                    return (
                      <p
                        style={{
                          color: el.color || "#E5E5E5",
                          fontSize: `${el.fontSize || 13}px`,
                          fontWeight: el.fontWeight || "normal",
                          fontFamily: el.fontFamily || undefined,
                          fontStyle: el.fontStyle || "normal",
                          textDecoration: el.textDecoration || "none",
                          textTransform: el.textTransform || "none",
                          textAlign: el.textAlign || "left",
                          filter: shadowStyle.filter || undefined,
                        }}
                        className={`w-full h-full flex items-center leading-relaxed select-none ${
                          (el.textAlign || "left") === "center"
                            ? "justify-center text-center"
                            : (el.textAlign || "left") === "right"
                            ? "justify-end text-right"
                            : "justify-start text-left"
                        } ${
                          shadowStyle.filter ? "" : "drop-shadow-sm"
                        }`}
                      >
                        {el.text}
                      </p>
                    );

                  case "button":
                    return (
                      <div
                        style={{
                          backgroundColor: el.backgroundColor || "#EDCF5D",
                          color: el.color || "#000000",
                          borderRadius: el.borderRadius !== undefined ? `${el.borderRadius}px` : "16px",
                          fontSize: `${el.fontSize || 13}px`,
                          fontWeight: el.fontWeight || "black",
                          fontFamily: el.fontFamily || undefined,
                          fontStyle: el.fontStyle || "normal",
                          textDecoration: el.textDecoration || "none",
                          textTransform: el.textTransform || "none",
                          textAlign: el.textAlign || "center",
                          border: el.backgroundColor === "transparent" ? "1px solid rgba(255,255,255,0.4)" : undefined,
                          boxShadow: shadowStyle.boxShadow || "0 10px 25px -3px rgba(0,0,0,0.5)",
                        }}
                        className={`w-full h-full px-5 py-3 flex items-center gap-2 tracking-wider select-none font-sans whitespace-nowrap ${
                          (el.textAlign || "center") === "left"
                            ? "justify-start text-left"
                            : (el.textAlign || "center") === "right"
                            ? "justify-end text-right"
                            : "justify-center text-center"
                        }`}
                      >
                        <span>{el.text}</span>
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </div>
                    );

                  case "custom_text":
                    return (
                      <div
                        style={{
                          color: el.color || "#EDCF5D",
                          fontSize: `${el.fontSize || 15}px`,
                          fontWeight: el.fontWeight || "bold",
                          fontFamily: el.fontFamily || undefined,
                          fontStyle: el.fontStyle || "normal",
                          textDecoration: el.textDecoration || "none",
                          textTransform: el.textTransform || "none",
                          textAlign: el.textAlign || "left",
                          filter: shadowStyle.filter || undefined,
                          whiteSpace: (el.text || "").includes("\n") ? "pre-wrap" : "nowrap",
                        }}
                        className={`w-full h-full flex items-center select-none leading-none ${
                          (el.textAlign || "left") === "center"
                            ? "justify-center text-center"
                            : (el.textAlign || "left") === "right"
                            ? "justify-end text-right"
                            : "justify-start text-left"
                        } ${
                          shadowStyle.filter ? "" : "drop-shadow-md"
                        }`}
                      >
                        {el.text}
                      </div>
                    );

                  case "container":
                    return (
                      <div
                        style={{
                          backgroundColor: el.backgroundColor || "rgba(0, 0, 0, 0.45)",
                          border: `${el.borderWidth ?? 1}px solid ${el.borderColor || "rgba(255,255,255,0.2)"}`,
                          borderRadius: `${el.borderRadius ?? 14}px`,
                          color: el.color || "#FFFFFF",
                          fontFamily: el.fontFamily || undefined,
                          fontSize: `${el.fontSize || 13}px`,
                          fontWeight: el.fontWeight || "normal",
                          fontStyle: el.fontStyle || "normal",
                          textDecoration: el.textDecoration || "none",
                          textTransform: el.textTransform || "none",
                          textAlign: el.textAlign || "center",
                          boxShadow: shadowStyle.boxShadow || "0 10px 25px -3px rgba(0,0,0,0.4)",
                        }}
                        className={`w-full h-full p-3 backdrop-blur-md flex items-center select-none overflow-hidden ${
                          (el.textAlign || "center") === "left"
                            ? "justify-start text-left"
                            : (el.textAlign || "center") === "right"
                            ? "justify-end text-right"
                            : "justify-center text-center"
                        }`}
                      >
                        {el.text}
                      </div>
                    );

                  case "circle":
                    return (
                      <div
                        style={{
                          backgroundColor: el.backgroundColor || "#EDCF5D",
                          border: el.borderColor ? `${el.borderWidth ?? 1}px solid ${el.borderColor}` : undefined,
                          borderRadius: "9999px",
                          color: el.color || "#000000",
                          fontSize: `${el.fontSize || 12}px`,
                          fontWeight: el.fontWeight || "black",
                          fontFamily: el.fontFamily || undefined,
                          fontStyle: el.fontStyle || "normal",
                          textDecoration: el.textDecoration || "none",
                          textTransform: el.textTransform || "none",
                          textAlign: el.textAlign || "center",
                          boxShadow: shadowStyle.boxShadow || "0 10px 25px -3px rgba(0,0,0,0.4)",
                        }}
                        className={`w-full h-full rounded-full flex items-center p-2 tracking-wider select-none leading-tight font-sans ${
                          (el.textAlign || "center") === "left"
                            ? "justify-start text-left"
                            : (el.textAlign || "center") === "right"
                            ? "justify-end text-right"
                            : "justify-center text-center"
                        }`}
                      >
                        {el.text}
                      </div>
                    );

                  case "seal":
                    return (
                      <div
                        style={{
                          filter: shadowStyle.filter || "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
                        }}
                        className="w-full h-full relative flex items-center justify-center select-none"
                      >
                        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polygon
                            points={SHAPE_SEAL_POINTS}
                            fill={el.backgroundColor || "#EDCF5D"}
                            stroke={el.borderColor || "transparent"}
                            strokeWidth={el.borderWidth || 0}
                          />
                        </svg>
                        {el.text && (
                          <span
                            style={{
                              color: el.color || "#000000",
                              fontSize: `${el.fontSize || 10}px`,
                              fontWeight: el.fontWeight || "black",
                              fontFamily: el.fontFamily || undefined,
                              fontStyle: el.fontStyle || "normal",
                              textDecoration: el.textDecoration || "none",
                              textTransform: el.textTransform || "none",
                            }}
                            className="relative z-10 text-center tracking-wider px-1 max-w-[80%] truncate select-none leading-tight"
                          >
                            {el.text}
                          </span>
                        )}
                      </div>
                    );

                  case "burst":
                    return (
                      <div
                        style={{
                          filter: shadowStyle.filter || "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
                        }}
                        className="w-full h-full relative flex items-center justify-center select-none"
                      >
                        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <polygon
                            points={SHAPE_BURST_POINTS}
                            fill={el.backgroundColor || "#EDCF5D"}
                            stroke={el.borderColor || "transparent"}
                            strokeWidth={el.borderWidth || 0}
                          />
                        </svg>
                        {el.text && (
                          <span
                            style={{
                              color: el.color || "#000000",
                              fontSize: `${el.fontSize || 13}px`,
                              fontWeight: el.fontWeight || "black",
                              fontFamily: el.fontFamily || undefined,
                              fontStyle: el.fontStyle || "normal",
                              textDecoration: el.textDecoration || "none",
                              textTransform: el.textTransform || "none",
                            }}
                            className="relative z-10 text-center tracking-wider px-1 max-w-[80%] truncate select-none"
                          >
                            {el.text}
                          </span>
                        )}
                      </div>
                    );

                  case "speech":
                    return (
                      <div
                        style={{
                          filter: shadowStyle.filter || "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
                        }}
                        className="w-full h-full relative flex items-center justify-center select-none"
                      >
                        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 80" preserveAspectRatio="none">
                          <path
                            d={SHAPE_SPEECH_PATH}
                            fill={el.backgroundColor || "#EDCF5D"}
                            stroke={el.borderColor || "transparent"}
                            strokeWidth={el.borderWidth || 0}
                          />
                        </svg>
                        {el.text && (
                          <span
                            style={{
                              color: el.color || "#000000",
                              fontSize: `${el.fontSize || 12}px`,
                              fontWeight: el.fontWeight || "black",
                              fontFamily: el.fontFamily || undefined,
                              fontStyle: el.fontStyle || "normal",
                              textDecoration: el.textDecoration || "none",
                              textTransform: el.textTransform || "none",
                              paddingBottom: "12%",
                            }}
                            className="relative z-10 text-center tracking-wider px-2 max-w-[85%] truncate select-none"
                          >
                            {el.text}
                          </span>
                        )}
                      </div>
                    );

                  case "cloud":
                    return (
                      <div
                        style={{
                          filter: shadowStyle.filter || "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
                        }}
                        className="w-full h-full relative flex items-center justify-center select-none"
                      >
                        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 80" preserveAspectRatio="none">
                          <path
                            d={SHAPE_CLOUD_PATH}
                            fill={el.backgroundColor || "#EDCF5D"}
                            stroke={el.borderColor || "transparent"}
                            strokeWidth={el.borderWidth || 0}
                          />
                        </svg>
                        {el.text && (
                          <span
                            style={{
                              color: el.color || "#000000",
                              fontSize: `${el.fontSize || 12}px`,
                              fontWeight: el.fontWeight || "black",
                              fontFamily: el.fontFamily || undefined,
                              fontStyle: el.fontStyle || "normal",
                              textDecoration: el.textDecoration || "none",
                              textTransform: el.textTransform || "none",
                              paddingBottom: "10%",
                            }}
                            className="relative z-10 text-center tracking-wider px-2 max-w-[80%] truncate select-none"
                          >
                            {el.text}
                          </span>
                        )}
                      </div>
                    );

                  case "arrow":
                    return (
                      <div
                        style={{
                          filter: shadowStyle.filter || "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
                        }}
                        className="w-full h-full relative flex items-center justify-center select-none"
                      >
                        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 70" preserveAspectRatio="none">
                          <path
                            d={SHAPE_ARROW_PATH}
                            fill={el.backgroundColor || "#EDCF5D"}
                            stroke={el.borderColor || "transparent"}
                            strokeWidth={el.borderWidth || 0}
                          />
                        </svg>
                        {el.text && (
                          <span
                            style={{
                              color: el.color || "#000000",
                              fontSize: `${el.fontSize || 12}px`,
                              fontWeight: el.fontWeight || "black",
                              fontFamily: el.fontFamily || undefined,
                              fontStyle: el.fontStyle || "normal",
                              textDecoration: el.textDecoration || "none",
                              textTransform: el.textTransform || "none",
                              paddingRight: "15%",
                            }}
                            className="relative z-10 text-center tracking-wider px-1 max-w-[65%] truncate select-none"
                          >
                            {el.text}
                          </span>
                        )}
                      </div>
                    );

                  default:
                    return null;
                }
              };

              return (
                <div
                  ref={bannerRef}
                  onDragOver={(e) => {
                    if (
                      e.dataTransfer.types.includes("application/gts-element-type") ||
                      e.dataTransfer.types.includes("text/plain") ||
                      e.dataTransfer.types.includes("Files")
                    ) {
                      e.preventDefault();
                      e.stopPropagation(); // don't let dragOver bubble to outer <main>
                      e.dataTransfer.dropEffect = "copy";
                      if (!isDragOverBanner) setIsDragOverBanner(true);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setIsDragOverBanner(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // prevent event bubbling to outer <main> onDrop — would double-add the element
                    setIsDragOverBanner(false);
                    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
                      f.type.startsWith("image/")
                    );
                    if (files.length > 0 && bannerRef.current) {
                      const rect = bannerRef.current.getBoundingClientRect();
                      const dropX = (e.clientX - rect.left) / zoom;
                      const dropY = (e.clientY - rect.top) / zoom;
                      handleDropImageFiles(files, { x: dropX, y: dropY });
                      return;
                    }
                    const type = (e.dataTransfer.getData("application/gts-element-type") ||
                      e.dataTransfer.getData("text/plain")) as any;
                    if (!type || !bannerRef.current) return;
                    const rect = bannerRef.current.getBoundingClientRect();
                    const dropX = (e.clientX - rect.left) / zoom;
                    const dropY = (e.clientY - rect.top) / zoom;
                    let preset: Partial<CanvasElement> | undefined = undefined;
                    const presetData = e.dataTransfer.getData("application/gts-element-preset");
                    if (presetData) {
                      try {
                        preset = JSON.parse(presetData);
                      } catch {}
                    }
                    handleAddElement(type, { x: dropX, y: dropY }, preset);
                  }}
                  style={{
                    borderRadius: `${borderRadius}px`,
                    width: "380px",
                    height: "475px",
                  }}
                  className={`relative shadow-2xl text-white transition-all select-none ${
                    isFrameless
                      ? "border-0 shadow-xl"
                      : "border border-white/20 ring-1 ring-black/80"
                  } ${isDragOverBanner ? "ring-2 ring-[#EDCF5D] ring-offset-4 ring-offset-black" : ""}`}
                >
                  {/* ── 0. UNCLIPPED SELECTED ELEMENT BLEED (Shows excess parts outside dialog viewport when ANY element is selected) ── */}
                  {selectedElement && (
                    <div
                      onMouseDown={(e) => startMove(e, selectedElement)}
                      onClick={(e) => handleSelectElement(selectedElement.id, e)}
                      style={{
                        position: "absolute",
                        left: `${selectedElement.x}px`,
                        top: `${selectedElement.y}px`,
                        width: selectedElement.width ? `${selectedElement.width}px` : "auto",
                        height: selectedElement.height ? `${selectedElement.height}px` : "auto",
                        transform: `rotate(${selectedElement.rotation || 0}deg) scale(${selectedElement.flipX ? -1 : 1}, ${selectedElement.flipY ? -1 : 1})`,
                        transformOrigin: "center center",
                        zIndex: 5,
                      }}
                      className="banner-element selection-overlay-control cursor-move select-none opacity-65 hover:opacity-90 transition-opacity animate-in fade-in duration-150"
                    >
                      {renderCanvasElementContent(selectedElement, true)}
                    </div>
                  )}

                  {/* ── 1. POSTER BOX SURFACE (Sitting on top like an aperture window) ── */}
                  <div
                    style={{
                      borderRadius: `${Math.max(0, borderRadius - 1)}px`,
                      backgroundColor: bgColor || "#010101",
                    }}
                    className="absolute inset-0 overflow-hidden select-none z-10"
                  >
                    {/* Drag-over indicator overlay */}
                    {isDragOverBanner && (
                      <div className="absolute inset-0 z-50 pointer-events-none border-2 border-dashed border-[#EDCF5D] bg-[#EDCF5D]/15 backdrop-blur-[1px] flex items-center justify-center transition-all animate-pulse">
                        <div className="px-3.5 py-1.5 rounded-full bg-black/90 border border-[#EDCF5D] text-[#EDCF5D] text-xs font-black shadow-2xl flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          <span>Drop component or image layer here</span>
                        </div>
                      </div>
                    )}

                    {/* Background image slice showing at 100% full opacity inside the poster box */}
                    {bgElement && bgElement.imageUrl && (
                      <div
                        data-canvas-element-id={bgElement.id}
                        onMouseDown={(e) => startMove(e, bgElement)}
                        onClick={(e) => handleSelectElement(bgElement.id, e)}
                        style={{
                          position: "absolute",
                          left: `${bgElement.x}px`,
                          top: `${bgElement.y}px`,
                          width: `${bgElement.width || 380}px`,
                          height: `${bgElement.height || 475}px`,
                          transform: `rotate(${bgElement.rotation || 0}deg) scale(${bgElement.flipX ? -1 : 1}, ${bgElement.flipY ? -1 : 1})`,
                          transformOrigin: "center center",
                          zIndex: 1,
                          borderRadius: "0px",
                        }}
                        className="banner-element cursor-move select-none"
                      >
                        <img
                          src={bgElement.imageUrl}
                          alt={bgElement.text || "Background Graphic"}
                          className="w-full h-full object-cover select-none pointer-events-none opacity-100"
                          style={{ borderRadius: "0px" }}
                          draggable={false}
                        />
                      </div>
                    )}

                    {/* Fallback Bottom Shadow / Vignette ONLY if no shadow_overlay element exists in layers */}
                    {showBottomShadow && !elements.some((el) => el.type === "shadow_overlay" || el.id === "bottom-shadow-overlay") && (
                      <div
                        className="absolute inset-x-0 bottom-0 h-[65%] pointer-events-none z-[8]"
                        style={{
                          background: "linear-gradient(to top, rgba(1,1,1,0.95) 0%, rgba(1,1,1,0.7) 40%, rgba(1,1,1,0.2) 75%, transparent 100%)",
                        }}
                      />
                    )}

                    {/* Canvas Foreground Elements Layer */}
                    {foregroundElements.map((el, elemIdx) => {
                      const isSelected = selectedElementIds.includes(el.id) || el.id === selectedElementId;
                      const rot = el.rotation || 0;
                      const contentSize = measureElementContentSize(el);
                      const effectiveWidth = el.type === "custom_text"
                        ? Math.max(el.width || 0, contentSize.width)
                        : (el.width || contentSize.width);
                      const effectiveHeight = el.type === "custom_text"
                        ? Math.max(el.height || 0, contentSize.height)
                        : (el.height || contentSize.height);

                      return (
                        <div
                          key={`${el.id}-${elemIdx}`}
                          data-canvas-element-id={el.id}
                          onMouseDown={(e) => startMove(e, el)}
                          onClick={(e) => handleSelectElement(el.id, e)}
                          onDoubleClick={(e) => handleDoubleClickElement(el.id, e)}
                          style={{
                            position: "absolute",
                            left: `${el.x}px`,
                            top: `${el.y}px`,
                            width: `${effectiveWidth}px`,
                            height: `${effectiveHeight}px`,
                            transform: `rotate(${rot}deg) scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`,
                            transformOrigin: "center center",
                            zIndex: isSelected ? 40 : 10 + elemIdx,
                            pointerEvents: "auto",
                          }}
                          className={`banner-element group/elem cursor-move transition-shadow flex ${
                            isSelected
                              ? "ring-0"
                              : "hover:outline hover:outline-[1px] hover:outline-blue-400/50 rounded-none"
                          }`}
                        >
                          {renderCanvasElementContent(el)}
                        </div>
                      );
                    })}

                    {/* 3. Fixed Close Button Mockup */}
                    <div
                      aria-hidden="true"
                      className="absolute top-3.5 right-3.5 z-30 w-9 h-9 rounded-full bg-black/60 text-white/90 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg cursor-not-allowed pointer-events-none"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>

                  {/* ── CANVA-STYLE SMART ALIGNMENT RULER LINES ── */}
                  {activeGuides.length > 0 && (
                    <svg
                      className="absolute inset-0 pointer-events-none z-[55] overflow-visible"
                      width="380"
                      height="475"
                      viewBox="0 0 380 475"
                    >
                      {activeGuides.map((g) => (
                        <line
                          key={g.id}
                          x1={g.type === "vertical" ? g.coord : g.start}
                          y1={g.type === "vertical" ? g.start : g.coord}
                          x2={g.type === "vertical" ? g.coord : g.end}
                          y2={g.type === "vertical" ? g.end : g.coord}
                          stroke="#E00096"
                          strokeWidth={1.2}
                          strokeDasharray={g.isCanvasGuide ? undefined : "4 4"}
                        />
                      ))}
                    </svg>
                  )}

                  {/* Faint Dotted Outline Around Parent Group When a Group Child is Isolated via Double-Click */}
                  {selectedElement && selectedElementIds.length <= 1 && selectedElement.groupId && (() => {
                    const groupMembers = elements.filter((el) => el.groupId === selectedElement.groupId);
                    if (groupMembers.length <= 1) return null;
                    const gMinX = Math.min(...groupMembers.map((el) => el.x));
                    const gMinY = Math.min(...groupMembers.map((el) => el.y));
                    const gMaxX = Math.max(...groupMembers.map((el) => el.x + (el.width || 200)));
                    const gMaxY = Math.max(...groupMembers.map((el) => el.y + (el.height || 40)));
                    return (
                      <div
                        style={{
                          position: "absolute",
                          left: `${gMinX}px`,
                          top: `${gMinY}px`,
                          width: `${gMaxX - gMinX}px`,
                          height: `${gMaxY - gMinY}px`,
                          zIndex: 35,
                          pointerEvents: "none",
                        }}
                      >
                        <div className="absolute inset-0 border border-dashed border-[#2563EB]/40 bg-[#2563EB]/[0.015] rounded-none pointer-events-none" />
                      </div>
                    );
                  })()}

                  {/* ── 2. UNCLIPPED SELECTION OVERLAY, 8 HANDLES, ROTATION BUTTON & FLOATING PILL TOOLBAR (Single Item) ── */}
                  {selectedElement && selectedElementIds.length <= 1 && (() => {
                    const selContentSize = measureElementContentSize(selectedElement);
                    const selEffectiveW = selectedElement.type === "custom_text"
                      ? Math.max(selectedElement.width || 0, selContentSize.width)
                      : (selectedElement.width || selContentSize.width);
                    const selEffectiveH = selectedElement.type === "custom_text"
                      ? Math.max(selectedElement.height || 0, selContentSize.height)
                      : (selectedElement.height || selContentSize.height);

                    return (
                      <div
                        style={{
                          position: "absolute",
                          left: `${selectedElement.x}px`,
                          top: `${selectedElement.y}px`,
                          width: `${selEffectiveW}px`,
                          height: `${selEffectiveH}px`,
                          transform: `rotate(${selectedElement.rotation || 0}deg)`,
                          transformOrigin: "center center",
                          zIndex: 60,
                          pointerEvents: "none",
                        }}
                      >
                      {/* Blue Selection Border Line (1px, square corners) */}
                      <div className="absolute inset-0 border border-[#2563EB] rounded-none pointer-events-none" />

                      {/* Floating Pill Toolbar on top (Image 1 & Image 2) */}
                      <div
                        style={{
                          transform: `translate(-50%, 0) rotate(-${selectedElement.rotation || 0}deg)`,
                          transformOrigin: "center center",
                        }}
                        className="selection-overlay-control absolute -top-10 left-1/2 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-white text-gray-700 shadow-xl border border-gray-200/90 pointer-events-auto z-50 select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Duplicate Button */}
                        <button
                          type="button"
                          onClick={() => handleDuplicateElement(selectedElement.id)}
                          title="Duplicate (Ctrl+D)"
                          className="p-1.5 rounded-full text-gray-600 hover:text-gray-950 hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <rect x="8" y="8" width="12" height="12" rx="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            <path d="M14 11v6m-3-3h6" strokeLinecap="round" />
                          </svg>
                        </button>

                        {/* Delete Trash Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteElement(selectedElement.id)}
                          title="Delete layer (Delete / Backspace)"
                          className="p-1.5 rounded-full text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>

                        {/* If element belongs to a group, show Ungroup button in single pill */}
                        {selectedElement.groupId && (
                          <button
                            type="button"
                            onClick={handleUngroupElements}
                            title="Ungroup this item (Ctrl+Shift+G)"
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer text-[11px] font-semibold"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <rect x="3" y="3" width="7" height="7" rx="1.5" strokeDasharray="2 2" />
                              <rect x="14" y="14" width="7" height="7" rx="1.5" strokeDasharray="2 2" />
                              <path d="M10 7h4a2 2 0 012 2v4" strokeLinecap="round" />
                            </svg>
                            <span>Ungroup</span>
                          </button>
                        )}

                        {/* More Options Dropdown Button (Image 2) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsToolbarMenuOpen(!isToolbarMenuOpen)}
                            title="More actions"
                            className={`p-1 rounded-full transition-colors cursor-pointer ${
                              isToolbarMenuOpen ? "text-gray-950 bg-gray-100" : "text-gray-600 hover:text-gray-950 hover:bg-gray-100"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="5" cy="12" r="1.75" />
                              <circle cx="12" cy="12" r="1.75" />
                              <circle cx="19" cy="12" r="1.75" />
                            </svg>
                          </button>

                          {/* Dropdown Menu (Image 2) */}
                          {isToolbarMenuOpen && (
                            <div
                              className="selection-overlay-control absolute top-full left-0 mt-1.5 py-1 px-1 rounded-xl bg-white shadow-2xl border border-gray-200/90 min-w-[170px] z-50 text-xs font-medium text-gray-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  handleCopyElement(selectedElement);
                                  setIsToolbarMenuOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="11" height="11" rx="2" />
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                  </svg>
                                  <span>Copy</span>
                                </div>
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">Ctrl+C</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handlePasteElement();
                                  setIsToolbarMenuOpen(false);
                                }}
                                disabled={!clipboardElement}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left ${
                                  clipboardElement ? "hover:bg-gray-100 cursor-pointer text-gray-800" : "opacity-40 cursor-not-allowed text-gray-400"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                                  </svg>
                                  <span>Paste</span>
                                </div>
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">Ctrl+V</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleDuplicateElement(selectedElement.id);
                                  setIsToolbarMenuOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="8" y="8" width="12" height="12" rx="2" />
                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                    <path d="M14 11v6m-3-3h6" strokeLinecap="round" />
                                  </svg>
                                  <span>Duplicate</span>
                                </div>
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">Ctrl+D</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedElement({ flipX: !selectedElement.flipX });
                                  setIsToolbarMenuOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M4.5 7.5L8.5 12l-4 4.5V7.5zm15 0L15.5 12l4 4.5V7.5z" />
                                  </svg>
                                  <span>Flip Horizontal</span>
                                </div>
                                {selectedElement.flipX && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedElement({ flipY: !selectedElement.flipY });
                                  setIsToolbarMenuOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M7.5 4.5L12 8.5 16.5 4.5H7.5zm0 15L12 15.5 16.5 19.5H7.5z" />
                                  </svg>
                                  <span>Flip Vertical</span>
                                </div>
                                {selectedElement.flipY && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                )}
                              </button>

                              <div className="my-1 border-t border-gray-100" />

                              <button
                                type="button"
                                onClick={() => {
                                  handleCenterElement(selectedElement.id, true);
                                  setIsToolbarMenuOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-7-9h14M8 8h8m-8 8h8" />
                                  </svg>
                                  <span>Center</span>
                                </div>
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">P</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  handleDeleteElement(selectedElement.id);
                                  setIsToolbarMenuOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>Delete</span>
                                </div>
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[10px]">Del</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rotation Circular Button on the LEFT (Image 1) */}
                      {!selectedElement.isLocked && (
                        <div
                          onMouseDown={(e) => startRotate(e, selectedElement)}
                          style={{
                            position: "absolute",
                            left: "-42px",
                            top: "50%",
                            transform: `translate(0, -50%) rotate(-${selectedElement.rotation || 0}deg)`,
                            transformOrigin: "center center",
                            width: "28px",
                            height: "28px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #D1D5DB",
                            borderRadius: "9999px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            cursor: "grab",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#374151",
                            zIndex: 40,
                            pointerEvents: "auto",
                          }}
                          title="Rotate element (drag)"
                          className="selection-overlay-control hover:text-[#2563EB] hover:border-[#2563EB] hover:scale-110 active:scale-95 transition-transform active:cursor-grabbing"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                        </div>
                      )}

                      {/* 4 Circular Corner Handles (Image 1) */}
                      {!selectedElement.isLocked && (
                        <>
                          {/* Top-Left */}
                          <div
                            onMouseDown={(e) => startResize(e, "nw", selectedElement)}
                            style={{
                              position: "absolute",
                              top: "-7px",
                              left: "-7px",
                              width: "14px",
                              height: "14px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #2563EB",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                              cursor: "nwse-resize",
                              pointerEvents: "auto",
                              zIndex: 40,
                            }}
                            className="selection-overlay-control hover:scale-125 transition-transform"
                          />
                          {/* Top-Right */}
                          <div
                            onMouseDown={(e) => startResize(e, "ne", selectedElement)}
                            style={{
                              position: "absolute",
                              top: "-7px",
                              right: "-7px",
                              width: "14px",
                              height: "14px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #2563EB",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                              cursor: "nesw-resize",
                              pointerEvents: "auto",
                              zIndex: 40,
                            }}
                            className="selection-overlay-control hover:scale-125 transition-transform"
                          />
                          {/* Bottom-Left */}
                          <div
                            onMouseDown={(e) => startResize(e, "sw", selectedElement)}
                            style={{
                              position: "absolute",
                              bottom: "-7px",
                              left: "-7px",
                              width: "14px",
                              height: "14px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #2563EB",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                              cursor: "nesw-resize",
                              pointerEvents: "auto",
                              zIndex: 40,
                            }}
                            className="selection-overlay-control hover:scale-125 transition-transform"
                          />
                          {/* Bottom-Right */}
                          <div
                            onMouseDown={(e) => startResize(e, "se", selectedElement)}
                            style={{
                              position: "absolute",
                              bottom: "-7px",
                              right: "-7px",
                              width: "14px",
                              height: "14px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #2563EB",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                              cursor: "nwse-resize",
                              pointerEvents: "auto",
                              zIndex: 40,
                            }}
                            className="selection-overlay-control hover:scale-125 transition-transform"
                          />

                          {/* 4 Rounded Pill Edge Handles (Image 1) */}
                          {/* Top Edge */}
                          <div
                            onMouseDown={(e) => startResize(e, "n", selectedElement)}
                            style={{
                              position: "absolute",
                              top: "-4px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: "22px",
                              height: "8px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #2563EB",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                              cursor: "ns-resize",
                              pointerEvents: "auto",
                              zIndex: 40,
                            }}
                            className="selection-overlay-control hover:scale-125 transition-transform"
                          />
                          {/* Bottom Edge */}
                          <div
                            onMouseDown={(e) => startResize(e, "s", selectedElement)}
                            style={{
                              position: "absolute",
                              bottom: "-4px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: "22px",
                              height: "8px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #2563EB",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                              cursor: "ns-resize",
                              pointerEvents: "auto",
                              zIndex: 40,
                            }}
                            className="selection-overlay-control hover:scale-125 transition-transform"
                          />
                          {/* Left Edge */}
                          <div
                            onMouseDown={(e) => startResize(e, "w", selectedElement)}
                            style={{
                              position: "absolute",
                              left: "-4px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: "8px",
                              height: "22px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #2563EB",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                              cursor: "ew-resize",
                              pointerEvents: "auto",
                              zIndex: 40,
                            }}
                            className="selection-overlay-control hover:scale-125 transition-transform"
                          />
                          {/* Right Edge */}
                          <div
                            onMouseDown={(e) => startResize(e, "e", selectedElement)}
                            style={{
                              position: "absolute",
                              right: "-4px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: "8px",
                              height: "22px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #2563EB",
                              borderRadius: "9999px",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                              cursor: "ew-resize",
                              pointerEvents: "auto",
                              zIndex: 40,
                            }}
                            className="selection-overlay-control hover:scale-125 transition-transform"
                          />
                        </>
                      )}
                      </div>
                    );
                  })()}

                  {/* Multi-Selection Combined Bounding Box & Floating Pill */}
                  {selectedElementIds.length > 1 && (() => {
                    const selectedElems = elements.filter((el) => selectedElementIds.includes(el.id));
                    if (selectedElems.length <= 1) return null;

                    const minX = Math.min(...selectedElems.map((el) => el.x));
                    const minY = Math.min(...selectedElems.map((el) => el.y));
                    const maxX = Math.max(...selectedElems.map((el) => {
                      const cs = measureElementContentSize(el);
                      const w = el.type === "custom_text" ? Math.max(el.width || 0, cs.width) : (el.width || cs.width);
                      return el.x + w;
                    }));
                    const maxY = Math.max(...selectedElems.map((el) => {
                      const cs = measureElementContentSize(el);
                      const h = el.type === "custom_text" ? Math.max(el.height || 0, cs.height) : (el.height || cs.height);
                      return el.y + h;
                    }));
                    const combW = maxX - minX;
                    const combH = maxY - minY;

                    const firstGId = selectedElems[0]?.groupId;
                    const isFullyGrouped = Boolean(
                      firstGId && selectedElems.every((el) => el.groupId === firstGId)
                    );

                    return (
                      <div
                        style={{
                          position: "absolute",
                          left: `${minX}px`,
                          top: `${minY}px`,
                          width: `${combW}px`,
                          height: `${combH}px`,
                          zIndex: 60,
                          pointerEvents: "none",
                        }}
                      >
                        {/* Regular selection box outline around collective selection */}
                        <div className="absolute inset-0 border border-[#2563EB] rounded-none pointer-events-none" />

                        {/* 4 Circular Corner Handles */}
                        {/* Top-Left */}
                        <div
                          onMouseDown={(e) => startMultiResize(e, "nw", { minX, minY, combW, combH })}
                          style={{
                            position: "absolute",
                            top: "-7px",
                            left: "-7px",
                            width: "14px",
                            height: "14px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #2563EB",
                            borderRadius: "9999px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            cursor: "nwse-resize",
                            pointerEvents: "auto",
                            zIndex: 40,
                          }}
                          className="selection-overlay-control hover:scale-125 transition-transform"
                        />
                        {/* Top-Right */}
                        <div
                          onMouseDown={(e) => startMultiResize(e, "ne", { minX, minY, combW, combH })}
                          style={{
                            position: "absolute",
                            top: "-7px",
                            right: "-7px",
                            width: "14px",
                            height: "14px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #2563EB",
                            borderRadius: "9999px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            cursor: "nesw-resize",
                            pointerEvents: "auto",
                            zIndex: 40,
                          }}
                          className="selection-overlay-control hover:scale-125 transition-transform"
                        />
                        {/* Bottom-Left */}
                        <div
                          onMouseDown={(e) => startMultiResize(e, "sw", { minX, minY, combW, combH })}
                          style={{
                            position: "absolute",
                            bottom: "-7px",
                            left: "-7px",
                            width: "14px",
                            height: "14px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #2563EB",
                            borderRadius: "9999px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            cursor: "nesw-resize",
                            pointerEvents: "auto",
                            zIndex: 40,
                          }}
                          className="selection-overlay-control hover:scale-125 transition-transform"
                        />
                        {/* Bottom-Right */}
                        <div
                          onMouseDown={(e) => startMultiResize(e, "se", { minX, minY, combW, combH })}
                          style={{
                            position: "absolute",
                            bottom: "-7px",
                            right: "-7px",
                            width: "14px",
                            height: "14px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #2563EB",
                            borderRadius: "9999px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            cursor: "nwse-resize",
                            pointerEvents: "auto",
                            zIndex: 40,
                          }}
                          className="selection-overlay-control hover:scale-125 transition-transform"
                        />

                        {/* 4 Rounded Pill Edge Handles */}
                        {/* Top Edge */}
                        <div
                          onMouseDown={(e) => startMultiResize(e, "n", { minX, minY, combW, combH })}
                          style={{
                            position: "absolute",
                            top: "-4px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "22px",
                            height: "8px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #2563EB",
                            borderRadius: "9999px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            cursor: "ns-resize",
                            pointerEvents: "auto",
                            zIndex: 40,
                          }}
                          className="selection-overlay-control hover:scale-125 transition-transform"
                        />
                        {/* Bottom Edge */}
                        <div
                          onMouseDown={(e) => startMultiResize(e, "s", { minX, minY, combW, combH })}
                          style={{
                            position: "absolute",
                            bottom: "-4px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "22px",
                            height: "8px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #2563EB",
                            borderRadius: "9999px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            cursor: "ns-resize",
                            pointerEvents: "auto",
                            zIndex: 40,
                          }}
                          className="selection-overlay-control hover:scale-125 transition-transform"
                        />
                        {/* Left Edge */}
                        <div
                          onMouseDown={(e) => startMultiResize(e, "w", { minX, minY, combW, combH })}
                          style={{
                            position: "absolute",
                            left: "-4px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: "8px",
                            height: "22px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #2563EB",
                            borderRadius: "9999px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            cursor: "ew-resize",
                            pointerEvents: "auto",
                            zIndex: 40,
                          }}
                          className="selection-overlay-control hover:scale-125 transition-transform"
                        />
                        {/* Right Edge */}
                        <div
                          onMouseDown={(e) => startMultiResize(e, "e", { minX, minY, combW, combH })}
                          style={{
                            position: "absolute",
                            right: "-4px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: "8px",
                            height: "22px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #2563EB",
                            borderRadius: "9999px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                            cursor: "ew-resize",
                            pointerEvents: "auto",
                            zIndex: 40,
                          }}
                          className="selection-overlay-control hover:scale-125 transition-transform"
                        />

                        {/* Floating Pill Toolbar on top */}
                        <div
                          style={{
                            transform: "translate(-50%, 0)",
                            transformOrigin: "center center",
                          }}
                          className="selection-overlay-control absolute -top-10 left-1/2 flex items-center gap-1 px-1.5 py-1 rounded-full bg-white text-gray-700 shadow-xl border border-gray-200/90 pointer-events-auto z-50 select-none text-xs font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Group / Ungroup Button */}
                          {isFullyGrouped ? (
                            <button
                              type="button"
                              onClick={handleUngroupElements}
                              title="Ungroup selection (Ctrl+Shift+G)"
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-blue-50 hover:text-blue-700 text-gray-700 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <rect x="3" y="3" width="7" height="7" rx="1.5" strokeDasharray="2 2" />
                                <rect x="14" y="14" width="7" height="7" rx="1.5" strokeDasharray="2 2" />
                                <path d="M10 7h4a2 2 0 012 2v4" strokeLinecap="round" />
                              </svg>
                              <span>Ungroup</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleGroupElements}
                              title="Group selection (Ctrl+G)"
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-blue-50 hover:text-blue-700 text-gray-700 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                                <path d="M14 7h4a2 2 0 012 2v4" strokeLinecap="round" />
                                <path d="M7 14v4a2 2 0 002 2h4" strokeLinecap="round" />
                              </svg>
                              <span>Group</span>
                            </button>
                          )}

                          <div className="h-3.5 w-px bg-gray-200" />

                          {/* Duplicate Group */}
                          <button
                            type="button"
                            onClick={() => handleDuplicateElement()}
                            title="Duplicate selection (Ctrl+D)"
                            className="p-1 rounded-full text-gray-600 hover:text-gray-950 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <rect x="8" y="8" width="12" height="12" rx="2" />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                              <path d="M14 11v6m-3-3h6" strokeLinecap="round" />
                            </svg>
                          </button>

                          {/* Delete Group */}
                          <button
                            type="button"
                            onClick={() => handleDeleteElement()}
                            title="Delete selection (Delete / Backspace)"
                            className="p-1 rounded-full text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              );
            })()}

          </div>

          {/* ── FLOATING OVERLAY BOTTOM RIGHT: UNDO/REDO, PAN & ZOOM CONTROLS ── */}
          <div className="absolute bottom-3 right-4 z-40 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#141414]/90 backdrop-blur-md border border-[#2C2C2C] shadow-2xl">
            {/* Undo Button */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              title="Undo (Ctrl+Z)"
              className={`p-2 rounded-xl transition-all ${
                historyPast.length > 0
                  ? "text-gray-300 hover:text-white hover:bg-[#222] cursor-pointer active:scale-95"
                  : "text-gray-600 opacity-40 cursor-not-allowed"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>

            {/* Redo Button */}
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyFuture.length === 0}
              title="Redo (Ctrl+Shift+Z)"
              className={`p-2 rounded-xl transition-all ${
                historyFuture.length > 0
                  ? "text-gray-300 hover:text-white hover:bg-[#222] cursor-pointer active:scale-95"
                  : "text-gray-600 opacity-40 cursor-not-allowed"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>

            {/* Selected Element Quick Controls (When an item is selected) */}
            {selectedElement && (
              <>
                <div className="h-4 w-px bg-[#2C2C2C]" />

                {/* Text Formatting Controls */}
                {selectedElement.type !== "image" && (
                  <>
                    {/* Font Size Stepper */}
                    <div className="flex items-center rounded-xl bg-[#1E1E1E] border border-[#2E2E2E] px-1 py-0.5 text-gray-300">
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedElement({
                            fontSize: Math.max(8, (selectedElement.fontSize || 16) - 1),
                          })
                        }
                        className="w-5 h-5 rounded-lg hover:bg-[#2A2A2A] hover:text-white flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                        title="Decrease font size"
                      >
                        -
                      </button>
                      <span className="font-mono text-xs font-bold px-1.5 min-w-[22px] text-center text-white">
                        {selectedElement.fontSize || 16}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedElement({
                            fontSize: Math.min(120, (selectedElement.fontSize || 16) + 1),
                          })
                        }
                        className="w-5 h-5 rounded-lg hover:bg-[#2A2A2A] hover:text-white flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                        title="Increase font size"
                      >
                        +
                      </button>
                    </div>

                    {/* Bold Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedElement({
                          fontWeight:
                            selectedElement.fontWeight === "bold" || selectedElement.fontWeight === "black"
                              ? "normal"
                              : "bold",
                        })
                      }
                      title="Toggle Bold (B)"
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black transition-all cursor-pointer ${
                        selectedElement.fontWeight === "bold" || selectedElement.fontWeight === "black"
                          ? "bg-[#EDCF5D] text-black shadow-xs font-black"
                          : "text-gray-400 hover:text-white hover:bg-[#222]"
                      }`}
                    >
                      B
                    </button>

                    {/* Italic Toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedElement({
                          fontStyle: selectedElement.fontStyle === "italic" ? "normal" : "italic",
                        })
                      }
                      title="Toggle Italic (I)"
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs italic font-serif font-bold transition-all cursor-pointer ${
                        selectedElement.fontStyle === "italic"
                          ? "bg-[#EDCF5D] text-black shadow-xs"
                          : "text-gray-400 hover:text-white hover:bg-[#222]"
                      }`}
                    >
                      I
                    </button>

                    {/* Text Alignment Cycle Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        const current = selectedElement.textAlign || "left";
                        const next = current === "left" ? "center" : current === "center" ? "right" : "left";
                        updateSelectedElement({ textAlign: next });
                      }}
                      title={`Text Alignment: ${selectedElement.textAlign || "left"} (click to switch)`}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#222] transition-colors cursor-pointer"
                    >
                      {(selectedElement.textAlign || "left") === "center" ? (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M6.75 12h10.5m-13.5 5.25h16.5" />
                        </svg>
                      ) : (selectedElement.textAlign || "left") === "right" ? (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M9.75 12h10.5m-16.5 5.25h16.5" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h16.5" />
                        </svg>
                      )}
                    </button>

                    {/* Text Color A button with color indicator */}
                    <label
                      className="relative flex flex-col items-center justify-center w-7 h-7 rounded-xl text-gray-300 hover:text-white hover:bg-[#222] cursor-pointer transition-colors"
                      title="Change text color"
                    >
                      <span className="text-xs font-bold leading-none">A</span>
                      <span
                        className="w-3.5 h-0.5 rounded-full mt-0.5"
                        style={{ backgroundColor: selectedElement.color || "#EDCF5D" }}
                      />
                      <input
                        type="color"
                        value={selectedElement.color || "#FFFFFF"}
                        onChange={(e) => updateSelectedElement({ color: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  </>
                )}

                {/* Replace image button if image */}
                {selectedElement.type === "image" && (
                  <button
                    type="button"
                    onClick={() => layerReplaceInputRef.current?.click()}
                    title="Replace Image File"
                    className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#222] transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </button>
                )}

                {/* Fill color picker for shapes / containers / badges / buttons */}
                {(selectedElement.type === "badge" ||
                  selectedElement.type === "button" ||
                  selectedElement.type === "container" ||
                  selectedElement.type === "circle" ||
                  ["seal", "burst", "speech", "cloud", "arrow"].includes(selectedElement.type)) && (
                  <label
                    className="relative flex items-center justify-center w-7 h-7 rounded-xl hover:bg-[#222] cursor-pointer transition-colors"
                    title="Change shape fill color"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-md border border-[#3A3A3A]"
                      style={{ backgroundColor: selectedElement.color || "#EDCF5D" }}
                    />
                    <input
                      type="color"
                      value={selectedElement.color || "#EDCF5D"}
                      onChange={(e) => updateSelectedElement({ color: e.target.value })}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                )}

                {/* Flip Horizontal */}
                <button
                  type="button"
                  onClick={() => updateSelectedElement({ flipX: !selectedElement.flipX })}
                  title={selectedElement.flipX ? "Unflip Horizontal" : "Flip Horizontal"}
                  className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                    selectedElement.flipX
                      ? "bg-[#EDCF5D] text-black shadow-xs"
                      : "text-gray-400 hover:text-white hover:bg-[#222]"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M4.5 7.5L8.5 12l-4 4.5V7.5zm15 0L15.5 12l4 4.5V7.5z" />
                  </svg>
                </button>

                {/* Flip Vertical */}
                <button
                  type="button"
                  onClick={() => updateSelectedElement({ flipY: !selectedElement.flipY })}
                  title={selectedElement.flipY ? "Unflip Vertical" : "Flip Vertical"}
                  className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                    selectedElement.flipY
                      ? "bg-[#EDCF5D] text-black shadow-xs"
                      : "text-gray-400 hover:text-white hover:bg-[#222]"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M7.5 4.5L12 8.5 16.5 4.5H7.5zm0 15L12 15.5 16.5 19.5H7.5z" />
                  </svg>
                </button>
              </>
            )}

            <div className="h-4 w-px bg-[#2C2C2C]" />

            {/* Pan Toggle Button */}
            <button
              type="button"
              onClick={() => setIsPanMode(!isPanMode)}
              title={isPanMode ? "Disable Pan Mode" : "Enable Pan Mode (drag canvas)"}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isPanMode
                  ? "bg-[#EDCF5D] text-black shadow-xs"
                  : "text-gray-400 hover:text-white hover:bg-[#222]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </button>

            <div className="h-4 w-px bg-[#2C2C2C]" />

            {/* Zoom Out */}
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
              title="Zoom Out"
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#222] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>

            {/* Zoom Reset */}
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              title="Reset Zoom to 100%"
              className="px-2.5 py-1 text-xs font-mono font-bold text-gray-300 hover:text-[#EDCF5D] cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
              title="Zoom In"
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#222] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Marquee Lasso Selection Box Overlay */}
          {marqueeBox && (
            <div
              style={{
                position: "fixed",
                left: `${marqueeBox.x}px`,
                top: `${marqueeBox.y}px`,
                width: `${marqueeBox.w}px`,
                height: `${marqueeBox.h}px`,
                pointerEvents: "none",
                zIndex: 9999,
              }}
              className="border border-[#2563EB] bg-[#2563EB]/15 rounded-none"
            />
          )}

        </main>

      </div>

    </div>
  );
}

export default function BroadcastEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#0E0E0E] flex items-center justify-center text-white font-mono text-sm">
          Loading Visual Broadcast Studio...
        </div>
      }
    >
      <BroadcastEditorInner />
    </Suspense>
  );
}
