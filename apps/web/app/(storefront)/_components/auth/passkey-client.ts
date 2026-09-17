import {
  bufferToBase64URL,
  base64URLToBuffer,
  getDeviceFriendlyName,
} from "./webauthn-utils";

export interface PasskeyItem {
  id: string;
  credential_id: string;
  device_name: string;
  created_at: string;
  last_used_at: string;
}

/**
 * Initiates the WebAuthn registration ceremony to create a new Passkey.
 */
export async function registerPasskey(customDeviceName?: string): Promise<{
  success: boolean;
  passkey?: PasskeyItem;
  error?: string;
}> {
  try {
    if (typeof window === "undefined" || !navigator.credentials) {
      return { success: false, error: "WebAuthn is not supported on this browser or platform." };
    }

    // Step 1: Request registration options & challenge from server
    const optionsRes = await fetch("/api/v1/auth/passkeys/register-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!optionsRes.ok) {
      const err = await optionsRes.json().catch(() => ({}));
      return { success: false, error: err.error || "Failed to initialize passkey registration." };
    }

    const { options } = await optionsRes.json();

    // Step 2: Format options into PublicKeyCredentialCreationOptions
    const creationOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64URLToBuffer(options.challenge),
      rp: {
        name: options.rp.name,
        id: options.rp.id,
      },
      user: {
        id: new TextEncoder().encode(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams || [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      timeout: options.timeout || 60000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "preferred",
        requireResidentKey: true,
      },
      attestation: "none",
    };

    if (options.excludeCredentials && options.excludeCredentials.length > 0) {
      creationOptions.excludeCredentials = options.excludeCredentials.map((c: any) => ({
        id: base64URLToBuffer(c.id),
        type: "public-key",
      }));
    }

    // Step 3: Trigger native OS biometric prompt (Face ID / Touch ID / Windows Hello)
    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: "Registration ceremony was cancelled or not completed." };
    }

    const response = credential.response as AuthenticatorAttestationResponse;
    const clientDataJSON = bufferToBase64URL(response.clientDataJSON);
    const attestationObject = bufferToBase64URL(response.attestationObject);
    const rawId = bufferToBase64URL(credential.rawId);

    const deviceName = customDeviceName || getDeviceFriendlyName();

    // Step 4: Verify and persist credential on server
    const verifyRes = await fetch("/api/v1/auth/passkeys/register-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: credential.id,
        rawId,
        clientDataJSON,
        attestationObject,
        deviceName,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success) {
      return { success: false, error: verifyData.error || "Passkey verification failed on server." };
    }

    return {
      success: true,
      passkey: verifyData.passkey,
    };
  } catch (err: any) {
    console.error("Passkey registration failed:", err);
    if (err.name === "NotAllowedError") {
      return { success: false, error: "Passkey setup was cancelled or timed out." };
    }
    if (err.name === "InvalidStateError") {
      return { success: false, error: "This device is already registered as a passkey on your account." };
    }
    return { success: false, error: err.message || "An unexpected error occurred during passkey setup." };
  }
}

/**
 * Initiates WebAuthn authentication ceremony to log in with a Passkey.
 */
export async function authenticateWithPasskey(): Promise<{
  success: boolean;
  user?: any;
  error?: string;
}> {
  try {
    if (typeof window === "undefined" || !navigator.credentials) {
      return { success: false, error: "WebAuthn is not supported on this browser or platform." };
    }

    // Step 1: Request authentication challenge
    const optionsRes = await fetch("/api/v1/auth/passkeys/auth-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!optionsRes.ok) {
      const err = await optionsRes.json().catch(() => ({}));
      return { success: false, error: err.error || "Failed to initialize passkey sign in." };
    }

    const { options } = await optionsRes.json();

    // Step 2: Format options into PublicKeyCredentialRequestOptions
    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64URLToBuffer(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout || 60000,
      userVerification: "preferred",
    };

    if (options.allowCredentials && options.allowCredentials.length > 0) {
      requestOptions.allowCredentials = options.allowCredentials.map((c: any) => ({
        id: base64URLToBuffer(c.id),
        type: "public-key",
      }));
    }

    // Step 3: Trigger native OS biometric authentication
    const assertion = (await navigator.credentials.get({
      publicKey: requestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: "Passkey authentication was cancelled." };
    }

    const response = assertion.response as AuthenticatorAssertionResponse;
    const clientDataJSON = bufferToBase64URL(response.clientDataJSON);
    const authenticatorData = bufferToBase64URL(response.authenticatorData);
    const signature = bufferToBase64URL(response.signature);
    const userHandle = response.userHandle ? bufferToBase64URL(response.userHandle) : undefined;
    const rawId = bufferToBase64URL(assertion.rawId);

    // Step 4: Verify assertion on server and authenticate
    const verifyRes = await fetch("/api/v1/auth/passkeys/auth-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: assertion.id,
        rawId,
        clientDataJSON,
        authenticatorData,
        signature,
        userHandle,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success) {
      return { success: false, error: verifyData.error || "Passkey verification failed." };
    }

    return {
      success: true,
      user: verifyData.user,
    };
  } catch (err: any) {
    console.error("Passkey authentication failed:", err);
    if (err.name === "NotAllowedError") {
      return { success: false, error: "Passkey prompt was dismissed." };
    }
    return { success: false, error: err.message || "Passkey login failed." };
  }
}

/**
 * Fetches the user's registered passkeys.
 */
export async function fetchUserPasskeys(): Promise<PasskeyItem[]> {
  try {
    const res = await fetch("/api/v1/auth/passkeys/list");
    if (!res.ok) return [];
    const data = await res.json();
    return data.passkeys || [];
  } catch {
    return [];
  }
}

/**
 * Revokes/removes a registered passkey.
 */
export async function deleteUserPasskey(passkeyId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/auth/passkeys/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passkeyId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
