"use client";

import React, { useState, useEffect } from "react";

export const DAYS_OF_WEEK = [
  { short: "Mon", label: "Monday" },
  { short: "Tue", label: "Tuesday" },
  { short: "Wed", label: "Wednesday" },
  { short: "Thu", label: "Thursday" },
  { short: "Fri", label: "Friday" },
  { short: "Sat", label: "Saturday" },
  { short: "Sun", label: "Sunday" },
];

export interface OperatingHoursState {
  fromDay: string;
  toDay: string;
  openTime: string; // "09:00" (24h)
  closeTime: string; // "18:00" (24h)
  hasSunday: boolean;
  sunOpenTime: string; // "12:00" (24h)
  sunCloseTime: string; // "17:00" (24h)
}

export function normalizeDay(day: string): string {
  const map: Record<string, string> = {
    mon: "Mon",
    monday: "Mon",
    tue: "Tue",
    tues: "Tue",
    tuesday: "Tue",
    wed: "Wed",
    wednesday: "Wed",
    thu: "Thu",
    thur: "Thu",
    thurs: "Thu",
    thursday: "Thu",
    fri: "Fri",
    friday: "Fri",
    sat: "Sat",
    saturday: "Sat",
    sun: "Sun",
    sunday: "Sun",
  };
  return map[day.trim().toLowerCase()] || "Mon";
}

export function parseTimeTo24h(str?: string | null): string {
  if (!str) return "09:00";
  const clean = str.trim();
  const m = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m || !m[1]) return "09:00";
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();

  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;

  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

export function formatTime12h(time24: string): string {
  if (!time24) return "9:00 AM";
  const parts = time24.split(":");
  const h = parts[0] !== undefined ? parseInt(parts[0], 10) : 9;
  const m = parts[1] !== undefined ? parseInt(parts[1], 10) : 0;
  if (isNaN(h)) return "9:00 AM";
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minStr = (isNaN(m) ? 0 : m).toString().padStart(2, "0");
  return `${hour12}:${minStr} ${ampm}`;
}

export function parseOperatingHours(str?: string | null): OperatingHoursState {
  const fallback: OperatingHoursState = {
    fromDay: "Mon",
    toDay: "Sat",
    openTime: "09:00",
    closeTime: "18:00",
    hasSunday: false,
    sunOpenTime: "12:00",
    sunCloseTime: "17:00",
  };

  if (!str || !str.trim()) return fallback;

  try {
    const parts = str.split(/[,|]\s*(?=Sun)/i);
    const mainPart = (parts[0] || "").trim();
    const sunPart = parts[1]?.trim();

    const match = mainPart.match(/^(?:([A-Za-z]{3,9})\s*(?:-|to)\s*([A-Za-z]{3,9})[:\s]*)?(.+)$/i);
    let fromDay = "Mon";
    let toDay = "Sat";
    let timeStr = mainPart;

    if (match && match[1] && match[2]) {
      fromDay = normalizeDay(match[1]);
      toDay = normalizeDay(match[2]);
      timeStr = match[3]?.replace(/^:\s*/, "") || "";
    }

    const timeMatch = timeStr.match(/(.+?)\s*(?:-|to)\s*(.+)/i);
    let openTime = "09:00";
    let closeTime = "18:00";
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
      openTime = parseTimeTo24h(timeMatch[1]);
      closeTime = parseTimeTo24h(timeMatch[2]);
    }

    let hasSunday = false;
    let sunOpenTime = "12:00";
    let sunCloseTime = "17:00";

    if (sunPart) {
      const sunMatch = sunPart.match(/Sun(?:\w*)?[:\s]+(.+)/i);
      if (sunMatch && sunMatch[1]) {
        hasSunday = true;
        const sunTimeMatch = sunMatch[1].match(/(.+?)\s*(?:-|to)\s*(.+)/i);
        if (sunTimeMatch && sunTimeMatch[1] && sunTimeMatch[2]) {
          sunOpenTime = parseTimeTo24h(sunTimeMatch[1]);
          sunCloseTime = parseTimeTo24h(sunTimeMatch[2]);
        }
      }
    }

    return {
      fromDay,
      toDay,
      openTime,
      closeTime,
      hasSunday,
      sunOpenTime,
      sunCloseTime,
    };
  } catch {
    return fallback;
  }
}

export function buildOperatingHoursString(state: OperatingHoursState): string {
  const main = `${state.fromDay} - ${state.toDay}: ${formatTime12h(state.openTime)} - ${formatTime12h(state.closeTime)}`;
  if (state.hasSunday && state.sunOpenTime && state.sunCloseTime) {
    return `${main}, Sun: ${formatTime12h(state.sunOpenTime)} - ${formatTime12h(state.sunCloseTime)}`;
  }
  return main;
}

interface OperatingHoursPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function OperatingHoursPicker({ value, onChange }: OperatingHoursPickerProps) {
  const [state, setState] = useState<OperatingHoursState>(() => parseOperatingHours(value));

  // Sync internal state when external value changes drastically
  useEffect(() => {
    const parsed = parseOperatingHours(value);
    const rebuilt = buildOperatingHoursString(parsed);
    // If the rebuilt matches value, sync it
    if (rebuilt === value || !value) {
      setState(parsed);
    }
  }, [value]);

  const updateState = (updates: Partial<OperatingHoursState>) => {
    const next = { ...state, ...updates };
    setState(next);
    onChange(buildOperatingHoursString(next));
  };

  const currentFormatted = buildOperatingHoursString(state);

  const isPresetMonSat = state.fromDay === "Mon" && state.toDay === "Sat" && !state.hasSunday;
  const isPresetMonFri = state.fromDay === "Mon" && state.toDay === "Fri" && !state.hasSunday;
  const isPresetDaily = state.fromDay === "Mon" && state.toDay === "Sun" && !state.hasSunday;

  return (
    <div className="space-y-3 p-3.5 rounded-2xl border border-gray-200 dark:border-[#2C2C2C] bg-gray-50/50 dark:bg-[#141414]/50">
      <div className="flex items-center justify-between">
        <label className="block font-bold text-gray-800 dark:text-gray-200 text-xs">
          Collection / Operating Schedule *
        </label>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => updateState({ fromDay: "Mon", toDay: "Sat", hasSunday: false })}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isPresetMonSat
              ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
              : "bg-white dark:bg-[#202020] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#333] hover:border-gray-400"
          }`}
        >
          Mon - Sat
        </button>

        <button
          type="button"
          onClick={() => updateState({ fromDay: "Mon", toDay: "Fri", hasSunday: false })}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isPresetMonFri
              ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
              : "bg-white dark:bg-[#202020] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#333] hover:border-gray-400"
          }`}
        >
          Mon - Fri
        </button>

        <button
          type="button"
          onClick={() => updateState({ fromDay: "Mon", toDay: "Sun", hasSunday: false })}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isPresetDaily
              ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
              : "bg-white dark:bg-[#202020] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#333] hover:border-gray-400"
          }`}
        >
          Daily (Mon - Sun)
        </button>
      </div>

      {/* Day Range Selectors */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Opening Day</span>
          <select
            value={state.fromDay}
            onChange={(e) => updateState({ fromDay: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white cursor-pointer"
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.short} value={d.short}>
                {d.label} ({d.short})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Closing Day</span>
          <select
            value={state.toDay}
            onChange={(e) => updateState({ toDay: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:border-black dark:focus:border-white cursor-pointer"
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.short} value={d.short}>
                {d.label} ({d.short})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Opening & Closing Time Pickers */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Opens At</span>
            <span className="text-[10px] font-mono text-gray-400">{formatTime12h(state.openTime)}</span>
          </div>
          <input
            type="time"
            value={state.openTime}
            onChange={(e) => updateState({ openTime: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-black dark:focus:border-white cursor-pointer"
          />
          {/* Quick preset buttons for opening time */}
          <div className="flex gap-1 pt-0.5">
            {["08:00", "09:00", "10:00"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateState({ openTime: t })}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono cursor-pointer ${
                  state.openTime === t
                    ? "bg-black text-white dark:bg-white dark:text-black font-bold"
                    : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                }`}
              >
                {formatTime12h(t)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Closes At</span>
            <span className="text-[10px] font-mono text-gray-400">{formatTime12h(state.closeTime)}</span>
          </div>
          <input
            type="time"
            value={state.closeTime}
            onChange={(e) => updateState({ closeTime: e.target.value })}
            className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-black dark:focus:border-white cursor-pointer"
          />
          {/* Quick preset buttons for closing time */}
          <div className="flex gap-1 pt-0.5">
            {["17:00", "18:00", "19:00", "20:00"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateState({ closeTime: t })}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono cursor-pointer ${
                  state.closeTime === t
                    ? "bg-black text-white dark:bg-white dark:text-black font-bold"
                    : "bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                }`}
              >
                {formatTime12h(t)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sunday / Weekend Hours Option */}
      <div className="pt-2 border-t border-gray-200 dark:border-[#262626]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.hasSunday}
            onChange={(e) => updateState({ hasSunday: e.target.checked })}
            className="rounded accent-black cursor-pointer"
          />
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            Open on Sunday with different hours
          </span>
        </label>

        {state.hasSunday && (
          <div className="grid grid-cols-2 gap-2.5 pt-2 pl-5">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-gray-500">Sunday Opens</span>
              <input
                type="time"
                value={state.sunOpenTime}
                onChange={(e) => updateState({ sunOpenTime: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-gray-500">Sunday Closes</span>
              <input
                type="time"
                value={state.sunCloseTime}
                onChange={(e) => updateState({ sunCloseTime: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Clean Live Output Banner */}
      <div className="p-2.5 rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#262626] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 overflow-hidden">
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white truncate">
            {currentFormatted}
          </span>
        </div>
      </div>
    </div>
  );
}
