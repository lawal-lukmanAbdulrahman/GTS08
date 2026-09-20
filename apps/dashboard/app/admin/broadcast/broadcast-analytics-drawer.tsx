"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BroadcastItem,
  computeElementShadow,
  SHAPE_SEAL_POINTS,
  SHAPE_BURST_POINTS,
  SHAPE_SPEECH_PATH,
  SHAPE_CLOUD_PATH,
  SHAPE_ARROW_PATH,
} from "../../../lib/notifications";

interface BroadcastAnalyticsDrawerProps {
  broadcast: BroadcastItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleStatus: (broadcast: BroadcastItem) => void;
  onArchive: (broadcast: BroadcastItem) => void;
  onEdit: (broadcast: BroadcastItem) => void;
  onRebroadcast?: (broadcast: BroadcastItem) => void;
  onDelete?: (broadcast: BroadcastItem) => void;
  onRefresh?: () => void;
}

export default function BroadcastAnalyticsDrawer({
  broadcast,
  isOpen,
  onClose,
  onToggleStatus,
  onArchive,
  onEdit,
  onRebroadcast,
  onDelete,
  onRefresh,
}: BroadcastAnalyticsDrawerProps) {
  const [isRebroadcasting, setIsRebroadcasting] = useState(false);
  const [recentlyRebroadcasted, setRecentlyRebroadcasted] = useState(false);

  if (!isOpen || !broadcast) return null;

  const analytics = broadcast.analytics || {
    impressions: 0,
    uniqueVisitors: 0,
    avgAttentionSeconds: 0,
    clicks: 0,
    ctrPct: 0,
    dismissals: 0,
    desktopPct: 50,
    mobilePct: 50,
    retentionBreakdown: { under2s: 0, twoTo5s: 0, fiveTo10s: 0, over10s: 0 },
  };
  const retention = analytics.retentionBreakdown || { under2s: 0, twoTo5s: 0, fiveTo10s: 0, over10s: 0 };
  const dismissalPct = Math.round(
    (analytics.dismissals / Math.max(1, analytics.impressions)) * 100
  );

  const design = broadcast.designConfig;

  // Expiry helpers
  const expiryDate = broadcast.expiresAt ? new Date(broadcast.expiresAt) : null;
  const expiryDiffMs = expiryDate ? expiryDate.getTime() - Date.now() : null;
  const expiryDiffHrs = expiryDiffMs !== null ? expiryDiffMs / 3600000 : null;
  const isExpired = expiryDiffMs !== null && expiryDiffMs <= 0;
  const isExpiringSoon = !isExpired && expiryDiffHrs !== null && expiryDiffHrs <= 24;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Slide-over WIDER Side-by-Side Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-12">
        <div className="w-screen max-w-5xl lg:max-w-6xl xl:max-w-7xl bg-white dark:bg-[#151515] border-l border-gray-200 dark:border-[#262626] shadow-2xl flex flex-col md:flex-row animate-slideLeft">

          {/* ══════════════════════════════════════════════════════════════
              LEFT PANE (50%): EXACT STOREFRONT BROADCAST DIALOG
              Independently scrollable — never clips the card
              ══════════════════════════════════════════════════════════════ */}
          <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-[#262626] bg-gray-100/70 dark:bg-[#0D0D0D] overflow-hidden">
            {/* Scrollable area — allows card to be seen in full on small screens */}
            <div className="flex-1 overflow-y-auto flex items-start justify-center p-6 md:p-10 min-h-0">
              {/* Live Storefront Broadcast Modal Card */}
              <div
                style={{
                  borderRadius: design?.borderRadius !== undefined ? `${design.borderRadius}px` : undefined,
                  backgroundColor: design?.backgroundColor || "#010101",
                }}
                className={`relative w-full max-w-[340px] sm:max-w-[390px] overflow-hidden bg-[#010101] text-white shadow-2xl border border-white/10 ${
                  design?.borderRadius === undefined ? "rounded-3xl" : ""
                } ${design?.isFrameless ? "border-0" : ""}`}
              >
                {/* Close Button Mockup */}
                <div
                  aria-hidden="true"
                  className="absolute top-3.5 right-3.5 z-30 w-9 h-9 rounded-full bg-black/60 text-white/90 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg cursor-default"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                {/* Poster Artwork & Overlay Content — gold-standard renderer */}
                <div
                  style={{ backgroundColor: design?.backgroundColor || "#010101" }}
                  className="relative w-full aspect-[4/5] overflow-hidden"
                >
                  {/* Legacy background image fallback */}
                  {broadcast.imageUrl && broadcast.imageUrl.trim() !== "" && (!design?.elements || !design.elements.some((el) => el.id === "bg-image" || el.isBackground)) && (
                    <div className="w-full h-full relative">
                      <Image
                        src={broadcast.imageUrl}
                        alt={broadcast.title || "Promotional Announcement"}
                        fill
                        priority
                        unoptimized
                        className="object-cover object-center"
                      />
                    </div>
                  )}

                  {/* Bottom shadow vignette fallback */}
                  {(design?.showBottomShadow !== false) && (!design?.elements || !design.elements.some((el) => el.type === "shadow_overlay" || el.id === "bottom-shadow-overlay")) && (
                    <div
                      className="absolute inset-x-0 bottom-0 h-[65%] pointer-events-none z-10"
                      style={{
                        background: "linear-gradient(to top, rgba(1,1,1,0.95) 0%, rgba(1,1,1,0.7) 40%, rgba(1,1,1,0.2) 75%, transparent 100%)",
                      }}
                    />
                  )}

                  {/* Render Elements (gold-standard: same renderer as storefront) */}
                  {design?.elements && design.elements.length > 0 ? (
                    design.elements.map((el, elemIdx) => {
                      const rot = el.rotation || 0;
                      const leftPct = (el.x / 380) * 100;
                      const topPct = (el.y / 475) * 100;
                      const widthPct = el.width ? (el.width / 380) * 100 : undefined;
                      const heightPct = el.height ? (el.height / 475) * 100 : undefined;
                      const isBg = el.isBackground || el.id === "bg-image";
                      const shadowStyle = isBg ? {} : computeElementShadow(el);

                      return (
                        <div
                          key={el.id}
                          style={{
                            position: "absolute",
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: widthPct ? `${widthPct}%` : "auto",
                            height: heightPct ? `${heightPct}%` : "auto",
                            transform: `rotate(${rot}deg) scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`,
                            transformOrigin: "center center",
                            zIndex: isBg ? 5 : 10 + elemIdx,
                          }}
                        >
                          {el.type === "badge" && (
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
                                boxShadow: shadowStyle.boxShadow || undefined,
                              }}
                              className={`w-full h-full flex items-center px-3 tracking-wider font-mono shadow-md whitespace-nowrap leading-none select-none ${
                                (el.textAlign || "center") === "left" ? "justify-start text-left" :
                                (el.textAlign || "center") === "right" ? "justify-end text-right" :
                                "justify-center text-center"
                              }`}
                            >
                              {el.text}
                            </div>
                          )}

                          {el.type === "title" && (
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
                                (el.textAlign || "left") === "center" ? "justify-center text-center" :
                                (el.textAlign || "left") === "right" ? "justify-end text-right" :
                                "justify-start text-left"
                              }`}
                            >
                              {el.text}
                            </h2>
                          )}

                          {el.type === "subtitle" && (
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
                                (el.textAlign || "left") === "center" ? "justify-center text-center" :
                                (el.textAlign || "left") === "right" ? "justify-end text-right" :
                                "justify-start text-left"
                              }`}
                            >
                              {el.text}
                            </p>
                          )}

                          {el.type === "button" && (
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
                                boxShadow: shadowStyle.boxShadow || undefined,
                              }}
                              className={`w-full h-full px-5 py-3 flex items-center gap-2 tracking-wider select-none font-sans ${
                                (el.textAlign || "center") === "left" ? "justify-start text-left" :
                                (el.textAlign || "center") === "right" ? "justify-end text-right" :
                                "justify-center text-center"
                              }`}
                            >
                              <span>{el.text}</span>
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                              </svg>
                            </div>
                          )}

                          {el.type === "custom_text" && (
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
                              }}
                              className={`w-full h-full flex items-center leading-snug select-none ${
                                (el.textAlign || "left") === "center" ? "justify-center text-center" :
                                (el.textAlign || "left") === "right" ? "justify-end text-right" :
                                "justify-start text-left"
                              }`}
                            >
                              {el.text}
                            </div>
                          )}

                          {el.type === "container" && (
                            <div
                              style={{
                                backgroundColor: el.backgroundColor || "rgba(0, 0, 0, 0.4)",
                                border: `${el.borderWidth ?? 1}px solid ${el.borderColor || "rgba(255,255,255,0.2)"}`,
                                borderRadius: `${el.borderRadius ?? 12}px`,
                                color: el.color || "#FFFFFF",
                                fontFamily: el.fontFamily || undefined,
                                fontSize: `${el.fontSize || 13}px`,
                                fontWeight: el.fontWeight || "normal",
                                fontStyle: el.fontStyle || "normal",
                                textDecoration: el.textDecoration || "none",
                                textTransform: el.textTransform || "none",
                                textAlign: el.textAlign || "center",
                                boxShadow: shadowStyle.boxShadow || undefined,
                              }}
                              className={`w-full h-full p-3 backdrop-blur-md flex items-center select-none overflow-hidden ${
                                (el.textAlign || "center") === "left" ? "justify-start text-left" :
                                (el.textAlign || "center") === "right" ? "justify-end text-right" :
                                "justify-center text-center"
                              }`}
                            >
                              {el.text}
                            </div>
                          )}

                          {el.type === "circle" && (
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
                                textTransform: el.textTransform || "uppercase",
                                textAlign: el.textAlign || "center",
                                boxShadow: shadowStyle.boxShadow || undefined,
                              }}
                              className={`w-full h-full rounded-full flex items-center p-2 tracking-wider select-none leading-tight font-sans ${
                                (el.textAlign || "center") === "left" ? "justify-start text-left" :
                                (el.textAlign || "center") === "right" ? "justify-end text-right" :
                                "justify-center text-center"
                              }`}
                            >
                              {el.text}
                            </div>
                          )}

                          {el.type === "seal" && (
                            <div
                              style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}
                              className="w-full h-full relative flex items-center justify-center select-none"
                            >
                              <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <polygon points={SHAPE_SEAL_POINTS} fill={el.backgroundColor || "#EDCF5D"} stroke={el.borderColor || "transparent"} strokeWidth={el.borderWidth || 0} />
                              </svg>
                              {el.text && (
                                <span style={{ color: el.color || "#000000", fontSize: `${el.fontSize || 10}px`, fontWeight: el.fontWeight || "black", fontFamily: el.fontFamily || undefined }} className="relative z-10 text-center tracking-wider px-1 max-w-[80%] truncate select-none">{el.text}</span>
                              )}
                            </div>
                          )}

                          {el.type === "burst" && (
                            <div
                              style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}
                              className="w-full h-full relative flex items-center justify-center select-none"
                            >
                              <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <polygon points={SHAPE_BURST_POINTS} fill={el.backgroundColor || "#EDCF5D"} stroke={el.borderColor || "transparent"} strokeWidth={el.borderWidth || 0} />
                              </svg>
                              {el.text && (
                                <span style={{ color: el.color || "#000000", fontSize: `${el.fontSize || 13}px`, fontWeight: el.fontWeight || "black", fontFamily: el.fontFamily || undefined }} className="relative z-10 text-center tracking-wider px-1 max-w-[75%] truncate select-none">{el.text}</span>
                              )}
                            </div>
                          )}

                          {el.type === "speech" && (
                            <div style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }} className="w-full h-full relative flex items-center justify-center select-none">
                              <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 80" preserveAspectRatio="none">
                                <path d={SHAPE_SPEECH_PATH} fill={el.backgroundColor || "#EDCF5D"} stroke={el.borderColor || "transparent"} strokeWidth={el.borderWidth || 0} />
                              </svg>
                              {el.text && <span style={{ color: el.color || "#000000", fontSize: `${el.fontSize || 12}px`, fontWeight: el.fontWeight || "black", paddingBottom: "12%" }} className="relative z-10 text-center tracking-wider px-2 max-w-[85%] truncate select-none">{el.text}</span>}
                            </div>
                          )}

                          {el.type === "cloud" && (
                            <div style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }} className="w-full h-full relative flex items-center justify-center select-none">
                              <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 80" preserveAspectRatio="none">
                                <path d={SHAPE_CLOUD_PATH} fill={el.backgroundColor || "#EDCF5D"} stroke={el.borderColor || "transparent"} strokeWidth={el.borderWidth || 0} />
                              </svg>
                              {el.text && <span style={{ color: el.color || "#000000", fontSize: `${el.fontSize || 12}px`, fontWeight: el.fontWeight || "black", paddingBottom: "10%" }} className="relative z-10 text-center tracking-wider px-2 max-w-[80%] truncate select-none">{el.text}</span>}
                            </div>
                          )}

                          {el.type === "arrow" && (
                            <div style={{ filter: shadowStyle.filter || "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }} className="w-full h-full relative flex items-center justify-center select-none">
                              <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 70" preserveAspectRatio="none">
                                <path d={SHAPE_ARROW_PATH} fill={el.backgroundColor || "#EDCF5D"} stroke={el.borderColor || "transparent"} strokeWidth={el.borderWidth || 0} />
                              </svg>
                              {el.text && <span style={{ color: el.color || "#000000", fontSize: `${el.fontSize || 13}px`, fontWeight: el.fontWeight || "black", paddingRight: "15%" }} className="relative z-10 text-center tracking-wider px-1 max-w-[65%] truncate select-none">{el.text}</span>}
                            </div>
                          )}

                          {el.type === "image" && el.imageUrl && el.imageUrl.trim() !== "" && (
                            <div
                              style={{
                                borderRadius: el.borderRadius ? `${el.borderRadius}px` : "0px",
                                boxShadow: isBg ? undefined : (shadowStyle.boxShadow || undefined),
                              }}
                              className="w-full h-full relative overflow-hidden select-none"
                            >
                              <Image src={el.imageUrl} alt={el.text || "Poster graphic"} fill unoptimized className="object-cover object-center pointer-events-none" />
                            </div>
                          )}

                          {el.type === "shadow_overlay" && (
                            <div
                              style={{
                                background: el.backgroundColor || "linear-gradient(to top, rgba(1,1,1,0.95) 0%, rgba(1,1,1,0.7) 40%, rgba(1,1,1,0.2) 75%, transparent 100%)",
                                opacity: el.opacity ?? 1,
                                borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                              }}
                              className="w-full h-full pointer-events-none"
                            />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    // Default Classic Fallback Layout
                    <>
                      {(broadcast.title || broadcast.subtitle) && (
                        <div className="absolute inset-x-0 bottom-20 p-5 text-center space-y-2 z-10">
                          {broadcast.title && (
                            <span className="inline-block px-3 py-1 rounded-full bg-[#EDCF5D] text-[#010101] font-mono text-[11px] font-black uppercase tracking-widest shadow-md">{broadcast.title}</span>
                          )}
                          {broadcast.subtitle && (
                            <p className="text-xs sm:text-sm text-white/95 font-medium max-w-xs mx-auto drop-shadow-md leading-relaxed">{broadcast.subtitle}</p>
                          )}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 bg-gradient-to-t from-[#010101] to-transparent z-20">
                        <div className="w-full py-3.5 px-6 rounded-2xl bg-[#EDCF5D] text-[#010101] font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 font-sans select-none">
                          <span>{broadcast.ctaLabel || "Visit"}</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT PANE (50%): CAMPAIGN ANALYTICS, METRICS & ACTIONS
              Fixed header + independently scrollable body + fixed footer
              ══════════════════════════════════════════════════════════════ */}
          <div className="w-full md:w-1/2 flex flex-col bg-white dark:bg-[#151515] min-h-0">

            {/* 1. RIGHT TOOLBAR (fixed) */}
            <div className="h-16 px-6 border-b border-gray-200 dark:border-[#242424] flex items-center justify-between bg-white dark:bg-[#151515] shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">{broadcast.title}</h2>
                <p className="text-[11px] text-gray-500 dark:text-[#888888]">ID: {broadcast.id}</p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-[#242424] dark:hover:bg-[#2f2f2f] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                    title="Sync Latest Analytics"
                    aria-label="Sync Latest Analytics"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onEdit(broadcast)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#EDCF5D] hover:bg-[#dfbe46] text-black font-bold text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#242424] text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close drawer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 2. RIGHT INFO: INDEPENDENTLY SCROLLABLE ANALYTICS */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">

              {/* Core Engagement Metrics (4 Grid) */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E8E]">
                    <span>Total Impressions</span>
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white">{analytics.impressions.toLocaleString()}</div>
                  <div className="text-[11px] text-gray-500 dark:text-[#888] font-mono">{analytics.uniqueVisitors.toLocaleString()} unique shoppers</div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E8E]">
                    <span>Attention Span</span>
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white flex items-baseline gap-1">
                    <span>{analytics.avgAttentionSeconds.toFixed(1)}</span>
                    <span className="text-sm font-normal text-gray-500">sec</span>
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    {analytics.avgAttentionSeconds >= 5 ? "★ High Engagement" : "Standard Glance"}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E8E]">
                    <span>Action Clicks</span>
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white">{analytics.clicks.toLocaleString()}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold font-mono">{analytics.ctrPct.toFixed(1)}% conversion rate</div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E8E]">
                    <span>Dismissals</span>
                    <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white">{analytics.dismissals.toLocaleString()}</div>
                  <div className="text-[11px] text-gray-500 dark:text-[#888] font-mono">{dismissalPct}% tapped 'X' close</div>
                </div>
              </div>

              {/* Attention Span Retention Breakdown */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Attention Span Distribution</h4>
                  <span className="text-[11px] text-gray-400 font-mono">Duration on modal</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  {[
                    { label: "< 2s (Fast Dismiss)", value: retention.under2s, color: "bg-rose-400" },
                    { label: "2s – 5s (Casual Glance)", value: retention.twoTo5s, color: "bg-amber-400" },
                    { label: "5s – 10s (Copy Reading)", value: retention.fiveTo10s, color: "bg-blue-500" },
                    { label: "> 10s (High-Intent Shoppers)", value: retention.over10s, color: "bg-emerald-500", bold: true },
                  ].map(({ label, value, color, bold }) => (
                    <div key={label}>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-1">
                        <span>{label}</span>
                        <span className={`font-mono font-bold ${bold ? "text-emerald-500" : ""}`}>{value}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-[#282828] overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Device Split */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Device Split</h4>
                  <span className="text-[11px] text-gray-400 font-mono">Mobile vs Desktop</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-600 dark:text-[#A0A0A0]">
                        <svg className="w-3.5 h-3.5 text-[#EDCF5D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                          <rect x="6" y="2" width="12" height="20" rx="2.5" />
                          <circle cx="12" cy="18" r="0.75" fill="currentColor" />
                        </svg>
                        <span>Mobile</span>
                      </span>
                      <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{analytics.mobilePct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-[#282828] overflow-hidden">
                      <div className="h-full rounded-full bg-[#EDCF5D]" style={{ width: `${analytics.mobilePct}%` }} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-600 dark:text-[#A0A0A0]">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                          <rect x="3" y="4" width="18" height="12" rx="2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 20h20" />
                        </svg>
                        <span>Desktop</span>
                      </span>
                      <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{analytics.desktopPct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-[#282828] overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${analytics.desktopPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Campaign Metadata */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#282828] space-y-1 text-xs">
                <div className="flex justify-between py-1.5 border-b border-gray-200/50 dark:border-[#262626]">
                  <span className="text-gray-500">Destination</span>
                  <Link href={broadcast.ctaLink} target="_blank" className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                    <span>{broadcast.ctaLink}</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>

                <div className="flex justify-between py-1.5 border-b border-gray-200/50 dark:border-[#262626]">
                  <span className="text-gray-500">Created At</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {new Date(broadcast.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>

                {expiryDate && (
                  <div className="flex justify-between py-1.5 border-b border-gray-200/50 dark:border-[#262626]">
                    <span className="text-gray-500">Expires At</span>
                    <span className={`font-mono font-semibold ${isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-gray-700 dark:text-gray-300"}`}>
                      {expiryDate.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {isExpired && " (expired)"}
                      {isExpiringSoon && ` (~${Math.ceil(expiryDiffHrs!)}h left)`}
                    </span>
                  </div>
                )}

                {broadcast.rebroadcastedAt && (
                  <div className="flex justify-between py-1.5 border-b border-gray-200/50 dark:border-[#262626]">
                    <span className="text-gray-500">Last Rebroadcast</span>
                    <span className="font-mono text-violet-600 dark:text-violet-400">
                      {new Date(broadcast.rebroadcastedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Last Synced</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {new Date(broadcast.updatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>

            </div>

            {/* 3. RIGHT BOTTOM ACTION BAR (fixed) */}
            <div className="px-6 py-3.5 border-t border-gray-200 dark:border-[#242424] flex items-center justify-between gap-3 bg-gray-50/80 dark:bg-[#181818] shrink-0 flex-wrap gap-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onToggleStatus(broadcast)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    broadcast.status === "active"
                      ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                  }`}
                >
                  {broadcast.status === "active" ? "Disable Broadcast" : "Activate Broadcast"}
                </button>

                {onRebroadcast && (
                  <button
                    type="button"
                    disabled={isRebroadcasting}
                    onClick={async () => {
                      if (!onRebroadcast) return;
                      setIsRebroadcasting(true);
                      try {
                        await onRebroadcast(broadcast);
                        setRecentlyRebroadcasted(true);
                        setTimeout(() => setRecentlyRebroadcasted(false), 3000);
                      } finally {
                        setIsRebroadcasting(false);
                      }
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      recentlyRebroadcasted
                        ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50"
                        : "bg-violet-600/15 hover:bg-violet-600/25 text-violet-700 dark:text-violet-400 border border-violet-500/30"
                    }`}
                    title="Rebroadcast — all users (including those who dismissed it) will see this again"
                  >
                    {recentlyRebroadcasted ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Rebroadcasted!</span>
                      </>
                    ) : isRebroadcasting ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Rebroadcasting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 01-1.683-.977V8.69z" />
                        </svg>
                        <span>Rebroadcast</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onArchive(broadcast)}
                  className="px-3.5 py-2 rounded-lg border border-gray-300 dark:border-[#383838] text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
                >
                  {broadcast.status === "archived" ? "Unarchive" : "Archive"}
                </button>

                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(broadcast)}
                    className="px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-900/40 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Synced {new Date(broadcast.updatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
