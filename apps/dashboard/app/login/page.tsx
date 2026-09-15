"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Prevents and sanitizes input parameters against SQL Injection attacks and malicious payloads.
 */
function sanitizeSqlInput(input: unknown): string {
  if (typeof input !== "string") return "";

  let sanitized = input
    .trim()
    .replace(/\0/g, "")
    .replace(/[\b\t\n\r\x1a]/g, "");

  const sqlKeywordsRegex = /(\b(UNION\s+SELECT|SELECT\s+.*\s+FROM|INSERT\s+INTO|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|UPDATE\s+.*\s+SET|EXEC(\s|\+)+(s|x)p|\bOR\b\s+['"]?1['"]?\s*=\s*['"]?1|--|\/\*|\*\/)\b)/gi;

  return sanitized.replace(sqlKeywordsRegex, "").replace(/['";]/g, "");
}

function sanitizeEmail(email: unknown): string {
  return sanitizeSqlInput(email).toLowerCase();
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Field-specific error states (No Emojis, placed directly beneath fields)
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Shaking field state for weighted tactile jiggle feedback
  const [shakingField, setShakingField] = useState<"email" | "password" | "all" | null>(null);

  const heroBuildingImg = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1600&auto=format&fit=crop";

  const triggerShake = (field: "email" | "password" | "all") => {
    setShakingField(field);
    setTimeout(() => {
      setShakingField(null);
    }, 500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset error states
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    // Client-side SQL Injection Sanitization
    const cleanEmail = sanitizeEmail(email);
    const cleanPassword = sanitizeSqlInput(password);

    // Client-side field validations
    if (!cleanEmail) {
      setEmailError("Please enter your staff email address.");
      triggerShake("email");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailError("Invalid email format. Please check your email address.");
      triggerShake("email");
      return;
    }

    if (!cleanPassword) {
      setPasswordError("Please enter your password.");
      triggerShake("password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errorMsg = json.error || "Authentication failed. Please check credentials.";

        if (res.status === 401 || json.field === "password") {
          setPasswordError("Invalid email address or password. Please verify your credentials.");
          triggerShake("password");
        } else if (res.status === 403) {
          setEmailError("Access denied. Customer accounts cannot access the Staff Portal.");
          triggerShake("email");
        } else if (json.field === "email") {
          setEmailError(errorMsg);
          triggerShake("email");
        } else {
          setGeneralError(errorMsg);
          triggerShake("all");
        }
        return;
      }

      const { user, session } = json.data;

      if (user.role === "customer") {
        setEmailError("Access denied. Customer accounts cannot access the Staff Portal.");
        triggerShake("email");
        return;
      }

      // Store auth session cookie (valid for 7 days)
      document.cookie = `gts_access_token=${session.access_token}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `gts_user_role=${user.role}; path=/; max-age=604800; SameSite=Lax`;
      localStorage.setItem("gts_user", JSON.stringify(user));
      localStorage.setItem("gts_token", session.access_token);

      // Role-based routing
      if (user.role === "admin") {
        router.push(redirectTarget.startsWith("/admin") ? redirectTarget : "/admin");
      } else if (user.role === "cashier") {
        router.push("/pos");
      } else if (user.role === "inventory_staff") {
        router.push("/inventory");
      } else {
        router.push("/pending");
      }
    } catch (err: any) {
      // Clean, professional network failure handling without emojis
      setGeneralError("Unable to connect to the GTS server. Please check your network connection and try again.");
      triggerShake("all");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans overflow-hidden bg-[#0A0A0A]">
      {/* Weighted Jiggle Shake Keyframe Styles */}
      <style jsx global>{`
        @keyframes jiggleShake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-7px); }
          30%, 60%, 90% { transform: translateX(7px); }
        }
        .animate-jiggle {
          animation: jiggleShake 0.48s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      {/* Full-Screen Dark Blurred Background Image */}
      <img
        src={heroBuildingImg}
        alt="Background Architecture"
        className="absolute inset-0 w-full h-full object-cover object-center filter blur-xl scale-110 opacity-40 z-0"
      />
      <div className="absolute inset-0 bg-black/60 z-0" />

      {/* Modal Card Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-[28px] sm:rounded-[36px] shadow-2xl overflow-hidden border border-gray-100/20 p-2.5 sm:p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 my-auto select-text z-10">
        {/* ────── LEFT COLUMN: Corporate Building Panel ────── */}
        <div className="md:col-span-6 relative rounded-[22px] sm:rounded-[28px] overflow-hidden min-h-[300px] sm:min-h-[380px] md:min-h-[530px] flex flex-col justify-end p-6 text-white select-none group">
          <img
            src={heroBuildingImg}
            alt="GTS Corporate Headquarters"
            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none z-10" />

          <div className="relative z-20 space-y-2">
            <p className="text-sm font-medium text-white/90 leading-relaxed max-w-xs drop-shadow-xs font-sans">
              Centralised retail operations, realtime stock synchronisation, and multi-channel commerce management.
            </p>
          </div>
        </div>

        {/* ────── RIGHT COLUMN: Auth Form Component ────── */}
        <div className="md:col-span-6 flex flex-col justify-between p-4 sm:p-6 text-[#010101]">
          <div>
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-sans text-base sm:text-lg font-black tracking-tight text-[#010101]">
                GTS Staff Portal
              </span>
            </div>

            {/* Form Title */}
            <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#010101] tracking-tight mb-2">
              Welcome Back!
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Sign in with your staff account credentials to access your terminal.
            </p>

            {/* General Server/Network Error Banner (No Emojis) */}
            {generalError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200/80 text-red-700 text-xs font-semibold text-center flex items-center justify-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{generalError}</span>
              </div>
            )}

            {/* Interactive Form */}
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              {/* Staff Email Field */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 font-sans">
                  Staff Email
                </label>
                <div
                  className={`relative rounded-full transition-all ${
                    shakingField === "email" || shakingField === "all" ? "animate-jiggle" : ""
                  }`}
                >
                  <input
                    type="email"
                    placeholder="admin@gts.ng"
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
                </div>
                {/* Red Error Message Beneath Email Field */}
                {emailError && (
                  <p className="text-red-600 text-[11px] font-semibold mt-1.5 px-2 flex items-center gap-1.5 font-sans">
                    <svg className="w-3.5 h-3.5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>{emailError}</span>
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 font-sans">
                  Password
                </label>
                <div
                  className={`relative rounded-full transition-all ${
                    shakingField === "password" || shakingField === "all" ? "animate-jiggle" : ""
                  }`}
                >
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1 cursor-pointer"
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
                {/* Red Error Message Beneath Password Field */}
                {passwordError && (
                  <p className="text-red-600 text-[11px] font-semibold mt-1.5 px-2 flex items-center gap-1.5 font-sans">
                    <svg className="w-3.5 h-3.5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#010101] text-white py-3 sm:py-3.5 font-bold text-xs sm:text-sm hover:bg-[#EDCF5D] hover:text-[#010101] transition-all shadow-md active:scale-[0.98] mt-4 font-sans cursor-pointer disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Login to Terminal →"}
              </button>
            </form>
          </div>

          {/* Footer Info */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center text-[11px] text-gray-400 font-medium">
            Accts are added by the admin , check email for the password
          </div>
        </div>
      </div>
    </div>
  );
}
