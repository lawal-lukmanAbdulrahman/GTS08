"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthModal } from "./auth-modal-context";
import { useAuth } from "./auth-context";
import { authenticateWithPasskey } from "./auth/passkey-client";
import { checkPasskeySupport } from "./auth/webauthn-utils";
import { PinInput } from "./auth/pin-input";

// ── 4 Auto-advancing Story Items for GTS (E-Commerce Marketplace) ──
const STORIES = [
  {
    id: "groceries",
    category: "Supermarket & Groceries",
    src: "/stories/groceries.avif",
    quote:
      "GTS is Nigeria's premier online marketplace providing everything from fresh groceries, food, and daily pantry staples to electronics and appliances.",
  },
  {
    id: "appliances",
    category: "Home & Appliances",
    src: "/stories/appliances.jpg",
    quote:
      "Upgrade your living space with top-tier refrigerators, smart TVs, kitchen appliances, and modern home electronics delivered straight to your door.",
  },
  {
    id: "back_to_sch",
    category: "Back To School",
    src: "/stories/back_to_sch.jpg",
    quote:
      "Gear up for the new academic term with school supplies, books, backpacks, stationery, laptops, and student tech essentials.",
  },
  {
    id: "fashion",
    category: "Fashion & Lifestyle",
    src: "/stories/fashion.webp",
    quote:
      "Express your style with trendy fashion, shoes, bags, watches, and luxury accessories for men, women, and kids.",
  },
];

const STORY_DURATION_MS = 3000; // 3 seconds per story bar

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "100%" : "-100%",
  }),
  center: {
    x: "0%",
  },
  exit: (dir: number) => ({
    x: dir > 0 ? "-100%" : "100%",
  }),
};

export function AuthModal() {
  const { isOpen, mode, closeAuthModal, setMode } = useAuthModal();
  const { signInWithPassword, signInWithOtp, signUp } = useAuth();

  const [authMethod, setAuthMethod] = useState<"password" | "magic_link" | "pin">("password");
  const [loginPin, setLoginPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    checkPasskeySupport().then((res) => setPasskeySupported(res.supported));
  }, []);

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setStatusMessage(null);
    try {
      const support = await checkPasskeySupport();
      if (!support.supported) {
        setStatusMessage({
          text: "Passkeys are not supported on this browser or platform. Please sign in with your email or password.",
          type: "error",
        });
        return;
      }

      const res = await authenticateWithPasskey();
      if (res.success) {
        setStatusMessage({ text: "Passkey sign-in successful! Welcome back.", type: "success" });
        setTimeout(() => {
          closeAuthModal();
          window.location.reload();
        }, 800);
      } else {
        setStatusMessage({ text: res.error || "Passkey verification failed.", type: "error" });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to authenticate with passkey.", type: "error" });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const [storyIndex, setStoryIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isJiggling, setIsJiggling] = useState(false);
  const storyStartTimeRef = React.useRef(Date.now());

  // Master time-driven story player (3000ms per story) — mathematically impossible to skip slides!
  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setStatusMessage(null);
      return undefined;
    }

    storyStartTimeRef.current = Date.now();
    setStoryIndex(0);
    setProgress(0);

    const timer = setInterval(() => {
      const elapsed = Date.now() - storyStartTimeRef.current;
      const calcIndex = Math.floor(elapsed / STORY_DURATION_MS) % STORIES.length;
      const calcProgress = ((elapsed % STORY_DURATION_MS) / STORY_DURATION_MS) * 100;

      setStoryIndex((prev) => {
        if (prev !== calcIndex) {
          setDirection(calcIndex > prev || (prev === STORIES.length - 1 && calcIndex === 0) ? 1 : -1);
        }
        return calcIndex;
      });
      setProgress(calcProgress);
    }, 30);

    return () => clearInterval(timer);
  }, [isOpen]);

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

  // Jiggle close button when user tries to dismiss outside or via ESC
  const triggerJiggle = () => {
    setIsJiggling(true);
    setTimeout(() => setIsJiggling(false), 600);
  };

  // Prevent closing on ESC key — trigger close button jiggle feedback
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        triggerJiggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const currentStory = STORIES[storyIndex] || STORIES[0]!;

  const handleManualStorySelect = (idx: number) => {
    setDirection(idx > storyIndex ? 1 : -1);
    storyStartTimeRef.current = Date.now() - idx * STORY_DURATION_MS;
    setStoryIndex(idx);
    setProgress(0);
  };

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [shakingField, setShakingField] = useState<"email" | "password" | null>(null);

  const triggerFieldShake = (field: "email" | "password") => {
    setShakingField(field);
    setTimeout(() => setShakingField(null), 500);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setStatusMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError("Please enter your email address.");
      triggerFieldShake("email");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailError("Invalid email format. Please verify your address.");
      triggerFieldShake("email");
      return;
    }

    setIsSubmitting(true);

    try {
      if (authMethod === "magic_link") {
        const res = await signInWithOtp(cleanEmail);
        if (res.error) {
          setStatusMessage({ text: res.error, type: "error" });
        } else {
          setStatusMessage({
            text: "Magic login link sent! Check your inbox to sign in instantly.",
            type: "success",
          });
        }
      } else if (mode === "login" && authMethod === "pin") {
        if (loginPin.length !== 6 || !/^\d{6}$/.test(loginPin)) {
          setStatusMessage({ text: "Please enter your complete 6-digit PIN.", type: "error" });
          setIsSubmitting(false);
          return;
        }

        const pinRes = await fetch("/api/v1/auth/pin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, pin: loginPin }),
        });
        const pinData = await pinRes.json();
        if (!pinRes.ok || !pinData.success) {
          setStatusMessage({ text: pinData.error || "Incorrect PIN. Please try again.", type: "error" });
        } else {
          setStatusMessage({ text: "Signed in successfully with PIN!", type: "success" });
          setTimeout(() => {
            closeAuthModal();
            window.location.reload();
          }, 600);
        }
      } else if (mode === "login") {
        if (!password) {
          setPasswordError("Please enter your password.");
          triggerFieldShake("password");
          setIsSubmitting(false);
          return;
        }

        const res = await signInWithPassword(cleanEmail, password);
        if (res.error) {
          setStatusMessage({ text: res.error, type: "error" });
        } else {
          setStatusMessage({ text: "Signed in successfully!", type: "success" });
          setTimeout(() => {
            closeAuthModal();
          }, 600);
        }
      } else {
        // Signup mode
        if (!password || password.length < 8) {
          setPasswordError("Password must be at least 8 characters.");
          triggerFieldShake("password");
          setIsSubmitting(false);
          return;
        }

        if (password !== confirmPassword) {
          setPasswordError("Passwords do not match.");
          triggerFieldShake("password");
          setIsSubmitting(false);
          return;
        }

        const res = await signUp(cleanEmail, password, fullName, phone);
        if (res.error) {
          setStatusMessage({ text: res.error, type: "error" });
        } else {
          setStatusMessage({
            text: "Account created successfully! You are now logged in.",
            type: "success",
          });
          setTimeout(() => {
            closeAuthModal();
          }, 800);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto select-none">
          {/* Backdrop Overlay — Clicking here DOES NOT close, it triggers jiggle feedback */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={triggerJiggle}
            className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity cursor-default"
          />

          {/* Modal Card Container — Clicking inside does not close */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl bg-white rounded-[28px] sm:rounded-[36px] shadow-2xl overflow-hidden z-10 border border-gray-100 p-2.5 sm:p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 my-auto select-text"
          >
            {/* ────── LEFT COLUMN: Auto-Advancing Marketplace Story Panel ────── */}
            <div className="md:col-span-6 relative rounded-[22px] sm:rounded-[28px] overflow-hidden min-h-[300px] sm:min-h-[380px] md:min-h-[530px] flex flex-col justify-between p-5 text-white select-none group">
              
              {/* Horizontal Push/Slide Story Image Transition */}
              <AnimatePresence custom={direction} initial={false}>
                <motion.div
                  key={currentStory.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={currentStory.src}
                    alt={currentStory.category}
                    fill
                    className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                    priority
                  />
                </motion.div>
              </AnimatePresence>

              {/* Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20 pointer-events-none z-10" />

              {/* Top 4 Instagram-Story Progress Bars (3s duration each) */}
              <div className="relative z-20 grid grid-cols-4 gap-1.5 w-full pt-1">
                {STORIES.map((story, idx) => {
                  let barWidthPercent = 0;
                  if (idx < storyIndex) barWidthPercent = 100;
                  else if (idx === storyIndex) barWidthPercent = progress;
                  else barWidthPercent = 0;

                  return (
                    <button
                      key={story.id}
                      onClick={() => handleManualStorySelect(idx)}
                      aria-label={`Go to ${story.category} story`}
                      className="h-1 rounded-full overflow-hidden bg-white/30 backdrop-blur-2xs transition-all cursor-pointer"
                    >
                      <div
                        className="h-full bg-white transition-all duration-75"
                        style={{ width: `${barWidthPercent}%` }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Bottom Brand Statement (Chip Removed) */}
              <div className="relative z-20 pb-2">
                <p className="text-xs sm:text-sm font-medium text-white/95 leading-relaxed max-w-xs drop-shadow-sm font-sans">
                  {currentStory.quote}
                </p>
              </div>
            </div>

            {/* ────── RIGHT COLUMN: Auth Form Panel ────── */}
            <div className="md:col-span-6 flex flex-col justify-between p-3 sm:p-5 text-[#010101]">
              <div>
                {/* Header Row: Brand Name & Close Button with Jiggle Feedback */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-sans text-base sm:text-lg font-black tracking-tight text-[#010101]">
                    GTS Marketplace
                  </span>

                  {/* ONLY THIS BUTTON CAN CLOSE THE MODAL */}
                  <motion.button
                    onClick={closeAuthModal}
                    aria-label="Close dialog"
                    animate={
                      isJiggling
                        ? {
                            x: [0, -8, 8, -6, 6, -3, 3, 0],
                            scale: [1, 1.25, 1.25, 1.1, 1.1, 1],
                          }
                        : {}
                    }
                    transition={{ duration: 0.55 }}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                      isJiggling
                        ? "border-red-500 text-red-600 bg-red-50 shadow-md ring-2 ring-red-400"
                        : "border-gray-200/90 hover:border-gray-400 text-gray-500 hover:text-[#010101] hover:bg-gray-50"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>

                {/* Form Title & Auth Method Selector */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="font-sans text-xl sm:text-2xl font-extrabold text-[#010101] tracking-tight">
                    {mode === "login" ? "Welcome Back!" : "Create Your Account!"}
                  </h2>

                  {/* Method Pill Toggle */}
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-full text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setAuthMethod("password")}
                      className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                        authMethod === "password"
                          ? "bg-white text-[#010101] shadow-xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMethod("magic_link")}
                      className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                        authMethod === "magic_link"
                          ? "bg-[#010101] text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Link
                    </button>
                  </div>
                </div>

                {/* Status Notice Banner */}
                {statusMessage && (
                  <div
                    className={`mb-4 px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                      statusMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                    }`}
                  >
                    {statusMessage.type === "success" ? (
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    )}
                    <span>{statusMessage.text}</span>
                  </div>
                )}

                {/* Interactive Form */}
                <form onSubmit={handleFormSubmit} className="space-y-3">
                  {/* Signup Specific: Full Name & Phone */}
                  {mode === "signup" && authMethod === "password" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 font-sans">
                          Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="Micah Okoh"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full rounded-full border border-gray-200/90 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#010101] placeholder-gray-400 focus:border-[#010101] focus:ring-1 focus:ring-[#010101] outline-none shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 font-sans">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          placeholder="+234 800 000 0000"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full rounded-full border border-gray-200/90 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#010101] placeholder-gray-400 focus:border-[#010101] focus:ring-1 focus:ring-[#010101] outline-none shadow-2xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email Field */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 font-sans">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="shopper@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      className={`w-full rounded-full border px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-[#010101] placeholder-gray-400 outline-none transition-all shadow-2xs ${
                        emailError
                          ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/20"
                          : "border-gray-200/90 bg-white focus:border-[#010101] focus:ring-1 focus:ring-[#010101]"
                      }`}
                    />
                    {emailError && (
                      <p className="text-red-600 text-[11px] font-semibold mt-1 px-2 flex items-center gap-1 font-sans">
                        <svg className="w-3.5 h-3.5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <span>{emailError}</span>
                      </p>
                    )}
                  </div>

                  {/* Password Field (Only shown in Password mode) */}
                  {authMethod === "password" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 font-sans">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Type your password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (passwordError) setPasswordError(null);
                          }}
                          className={`w-full rounded-full border px-4 py-2.5 sm:py-3 pr-10 text-xs sm:text-sm font-medium text-[#010101] placeholder-gray-400 outline-none transition-all shadow-2xs ${
                            passwordError
                              ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/20"
                              : "border-gray-200/90 bg-white focus:border-[#010101] focus:ring-1 focus:ring-[#010101]"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                        >
                          {showPassword ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.349-3.638 5.02-6.5 9.964-6.5 4.944 0 8.615 2.862 9.964 6.5-1.349 3.638-5.02 6.5-9.964 6.5-4.944 0-8.615-2.862-9.964-6.5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-red-600 text-[11px] font-semibold mt-1 px-2 flex items-center gap-1 font-sans">
                          <svg className="w-3.5 h-3.5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          <span>{passwordError}</span>
                        </p>
                      )}

                      {/* Alternate Login Links */}
                      {mode === "login" && (
                        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 mt-1.5 px-1">
                          <button
                            type="button"
                            onClick={() => setAuthMethod("pin")}
                            className="hover:text-[#010101] hover:underline transition-colors"
                          >
                            Sign in with 6-digit PIN?
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthMethod("magic_link")}
                            className="hover:text-[#010101] hover:underline transition-colors"
                          >
                            Sign in with Link?
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PIN Field (Only shown in PIN mode) */}
                  {authMethod === "pin" && (
                    <div className="space-y-3 pt-1 text-center">
                      <label className="block text-xs font-bold text-gray-700 font-sans">
                        Enter your 6-Digit PIN
                      </label>
                      <PinInput
                        value={loginPin}
                        onChange={setLoginPin}
                        length={6}
                        autoFocus
                        idPrefix="modal-pin"
                      />
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 pt-2 px-1">
                        <button
                          type="button"
                          onClick={() => setAuthMethod("password")}
                          className="hover:text-[#010101] hover:underline"
                        >
                          Sign in with Password?
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMethod("magic_link")}
                          className="hover:text-[#010101] hover:underline"
                        >
                          Sign in with Link?
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Confirm Password (Signup Mode) */}
                  {mode === "signup" && authMethod === "password" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 font-sans">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-full border border-gray-200/90 bg-white px-4 py-2.5 sm:py-3 pr-10 text-xs sm:text-sm font-medium text-[#010101] placeholder-gray-400 focus:border-[#010101] focus:ring-1 focus:ring-[#010101] outline-none transition-all shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                        >
                          {showConfirmPassword ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.349-3.638 5.02-6.5 9.964-6.5 4.944 0 8.615 2.862 9.964 6.5-1.349 3.638-5.02 6.5-9.964 6.5-4.944 0-8.615-2.862-9.964-6.5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Primary Action Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-full bg-[#010101] text-white py-3 sm:py-3.5 font-bold text-xs sm:text-sm hover:bg-[#EDCF5D] hover:text-[#010101] transition-all shadow-md active:scale-[0.98] mt-4 font-sans disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : authMethod === "magic_link" ? (
                      "Send  Link"
                    ) : authMethod === "pin" ? (
                      "Sign In with PIN"
                    ) : mode === "login" ? (
                      "Sign In"
                    ) : (
                      "Create Account"
                    )}
                  </button>

                  {/* Passkey Login Button */}
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      disabled={passkeyLoading || isSubmitting}
                      className="w-full py-2.5 sm:py-3 rounded-full border border-gray-300 hover:border-[#010101] bg-[#FAF9F6] hover:bg-white text-[#010101] font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs active:scale-[0.98] mt-2.5 group"
                    >
                      {passkeyLoading ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-[#010101] border-t-transparent rounded-full animate-spin" />
                          <span>Verifying Passkey...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-[#010101] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                          <span>Sign in with Passkey</span>
                        </>
                      )}
                    </button>
                  )}
                </form>
              </div>

              {/* ────── Bottom Section: Social Sign In & Mode Toggle ────── */}
              <div className="mt-5 space-y-4">
                {/* Centered Divider Rule */}
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-gray-200 w-full" />
                  <span className="bg-white px-3 text-[10px] sm:text-[11px] font-medium text-gray-400 whitespace-nowrap absolute font-sans">
                    {mode === "login" ? "or sign in with" : "or sign up with"}
                  </span>
                </div>

                {/* Social Button Pair */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {/* Google Login Button */}
                  <button
                    type="button"
                    onClick={() => {
                      alert("Connecting to Google...");
                      closeAuthModal();
                    }}
                    className="w-full py-2.5 rounded-full border border-gray-200 hover:border-gray-400 bg-white font-bold text-xs text-[#010101] flex items-center justify-center gap-2 transition-all shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>

                  {/* Apple ID Login Button */}
                  <button
                    type="button"
                    onClick={() => {
                      alert("Connecting to Apple ID...");
                      closeAuthModal();
                    }}
                    className="w-full py-2.5 rounded-full border border-gray-200 hover:border-gray-400 bg-white font-bold text-xs text-[#010101] flex items-center justify-center gap-2 transition-all shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <svg className="w-4 h-4 fill-current text-[#010101]" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.09c.67-.82 1.13-1.96.99-3.09-1 .04-2.18.67-2.88 1.49-.6.7-1.12 1.86-.98 2.97 1.11.09 2.22-.55 2.87-1.37z" />
                    </svg>
                    <span>Apple ID</span>
                  </button>
                </div>

                {/* Mode Switch Footer Line */}
                <div className="text-center pt-1 text-xs text-gray-500 font-medium">
                  {mode === "login" ? (
                    <>
                      Don&apos;t have account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("signup")}
                        className="font-bold text-[#010101] hover:underline cursor-pointer ml-1"
                      >
                        Create Account
                      </button>
                    </>
                  ) : (
                    <>
                      Already have account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="font-bold text-[#010101] hover:underline cursor-pointer ml-1"
                      >
                        Login
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
