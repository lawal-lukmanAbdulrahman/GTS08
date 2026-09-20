"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Read auth token and user object
    const token = localStorage.getItem("gts_token");
    const userStr = localStorage.getItem("gts_user");

    if (!token || !userStr) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role === "admin") {
        router.replace("/admin");
      } else if (user.role === "cashier") {
        router.replace("/pos");
      } else if (user.role === "inventory_staff") {
        router.replace("/inventory");
      } else if (user.role === "pending") {
        router.replace("/pending");
      } else {
        router.replace("/admin");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white flex items-center justify-center p-8 font-sans transition-colors">
      <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
        <svg className="w-5 h-5 animate-spin text-[#EDCF5D]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Redirecting to your workspace...</span>
      </div>
    </div>
  );
}
