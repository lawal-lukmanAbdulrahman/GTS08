"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";

export function DemoStoreBanner() {
  const { user, signOut } = useAuth();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const userStr = localStorage.getItem("gts_customer_user");
        const isDemoStored =
          localStorage.getItem("gts_demo_mode") === "true" ||
          document.cookie.includes("gts_demo_mode=true") ||
          (userStr ? JSON.parse(userStr)?.is_demo === true : false);
        setIsDemo(Boolean((user as any)?.is_demo || isDemoStored));
      } catch {
        setIsDemo(false);
      }
    }
  }, [user]);

  if (!isDemo) return null;

  const handleExit = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 bg-[#010101]/90 backdrop-blur-md text-white text-xs font-medium px-4 py-2 rounded-full shadow-2xl border border-white/10"
    >
      <span className="w-2 h-2 rounded-full bg-[#EDCF5D] animate-pulse" />
      <span>Demo Store &middot; Sample Products</span>
      <button
        type="button"
        onClick={handleExit}
        className="ml-1 text-[11px] font-bold text-[#EDCF5D] hover:underline cursor-pointer"
      >
        Exit Demo
      </button>
    </div>
  );
}
