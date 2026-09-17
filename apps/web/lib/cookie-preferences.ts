export type CookieConsentType = "essential" | "optional";

export interface CookiePreferences {
  type: CookieConsentType;
  advertising: boolean;
  analytics: boolean;
  personalization: boolean;
  updatedAt?: number;
}

export const COOKIE_STORAGE_KEY = "gts_cookie_preferences";

export const DEFAULT_OPTIONAL_PREFERENCES: CookiePreferences = {
  type: "optional",
  advertising: true,
  analytics: true,
  personalization: true,
};

export const DEFAULT_ESSENTIAL_PREFERENCES: CookiePreferences = {
  type: "essential",
  advertising: false,
  analytics: false,
  personalization: false,
};

/**
 * Retrieves the user's stored cookie preferences from localStorage (or null if not yet consented)
 */
export function getStoredCookiePreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves the user's cookie preferences to localStorage and broadcasts the update event
 */
export function saveCookiePreferences(prefs: CookiePreferences): void {
  if (typeof window === "undefined") return;
  try {
    const dataToSave: CookiePreferences = {
      ...prefs,
      updatedAt: Date.now(),
    };
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(dataToSave));
    window.dispatchEvent(
      new CustomEvent("gts-cookie-preferences-changed", { detail: dataToSave })
    );
  } catch (err) {
    console.error("Failed to save cookie preferences:", err);
  }
}
