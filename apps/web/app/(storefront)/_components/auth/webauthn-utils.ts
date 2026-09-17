/**
 * WebAuthn & Passkey Client Utilities
 * Provides base64url encoding/decoding, platform authenticator detection, and device identification.
 */

export function bufferToBase64URL(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Checks if the browser and operating system support WebAuthn Passkeys.
 */
export async function checkPasskeySupport(): Promise<{
  supported: boolean;
  platformAuthenticator: boolean;
}> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return { supported: false, platformAuthenticator: false };
  }

  let platformAuthenticator = false;
  if (
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
    "function"
  ) {
    try {
      platformAuthenticator =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      platformAuthenticator = false;
    }
  }

  return {
    supported: true,
    platformAuthenticator,
  };
}

/**
 * Derives a human-friendly name for the current device/browser.
 */
export function getDeviceFriendlyName(): string {
  if (typeof navigator === "undefined") return "Passkey Device";

  const ua = navigator.userAgent;
  let os = "Device";
  let bioType = "Biometrics";

  if (/iPhone/i.test(ua)) {
    os = "iPhone";
    bioType = "Face ID";
  } else if (/iPad/i.test(ua)) {
    os = "iPad";
    bioType = "Touch/Face ID";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "Mac";
    bioType = "Touch ID";
  } else if (/Windows/i.test(ua)) {
    os = "Windows PC";
    bioType = "Windows Hello";
  } else if (/Android/i.test(ua)) {
    os = "Android Device";
    bioType = "Biometrics / Fingerprint";
  } else if (/Linux/i.test(ua)) {
    os = "Linux Device";
    bioType = "Security Key";
  }

  let browser = "";
  if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";

  return browser ? `${os} (${bioType} · ${browser})` : `${os} (${bioType})`;
}
