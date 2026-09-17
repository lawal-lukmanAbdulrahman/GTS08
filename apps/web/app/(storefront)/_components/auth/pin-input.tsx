"use client";

import React, { useRef, useEffect } from "react";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  idPrefix?: string;
}

export function PinInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  disabled = false,
  idPrefix = "pin",
}: PinInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, [autoFocus]);

  const digits = value.split("").slice(0, length);
  while (digits.length < length) {
    digits.push("");
  }

  const handleChange = (index: number, char: string) => {
    const cleaned = char.replace(/\D/g, "");
    if (!cleaned) {
      // Clear current digit
      const newDigits = [...digits];
      newDigits[index] = "";
      onChange(newDigits.join(""));
      return;
    }

    if (cleaned.length > 1) {
      // User pasted or typed multiple digits
      const newDigits = [...digits];
      for (let i = 0; i < cleaned.length && index + i < length; i++) {
        newDigits[index + i] = cleaned[i]!;
      }
      onChange(newDigits.join(""));
      const nextIdx = Math.min(index + cleaned.length, length - 1);
      inputsRef.current[nextIdx]?.focus();
      return;
    }

    // Single digit entry
    const newDigits = [...digits];
    newDigits[index] = cleaned;
    onChange(newDigits.join(""));

    // Auto-advance to next box
    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted) {
      onChange(pasted);
      const targetIdx = Math.min(pasted.length, length - 1);
      inputsRef.current[targetIdx]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {digits.map((digit, idx) => {
        const isFocused = false;
        return (
          <input
            key={`${idPrefix}-${idx}`}
            ref={(el) => {
              inputsRef.current[idx] = el;
            }}
            type="password"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            disabled={disabled}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            className="w-10 h-12 sm:w-12 sm:h-14 text-center font-bold text-lg sm:text-xl rounded-lg border border-gray-300 bg-white text-[#010101] shadow-2xs outline-none transition-all focus:border-[#EDCF5D] focus:ring-2 focus:ring-[#EDCF5D]/40 focus:scale-105 disabled:opacity-50"
          />
        );
      })}
    </div>
  );
}
