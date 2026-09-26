const PHONE_CHARS = /^[0-9+\-()\s]+$/;

export type PhoneResult = { ok: true; value: string | null } | { ok: false; error: string };

/** A staff member's own phone number: optional, digits with + - ( ) and spaces, 7-20 characters. */
export function validatePhoneNumber(raw: unknown): PhoneResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Phone number must be text." };

  const value = raw.replace(/\s+/g, " ").trim();
  if (!value) return { ok: true, value: null };
  if (!PHONE_CHARS.test(value)) {
    return { ok: false, error: "Phone number can only contain digits, spaces, +, - and brackets." };
  }
  const digits = value.replace(/\D/g, "").length;
  if (digits < 7 || value.length > 20) return { ok: false, error: "Enter a valid phone number." };
  return { ok: true, value };
}

export type PasswordChangeResult = { ok: true } | { ok: false; errors: Record<string, string> };

/**
 * Rules for a staff password change. Shared by the profile form (instant
 * feedback) and the API (the authority).
 */
export function validatePasswordChange(input: { current: string; next: string; confirm: string }): PasswordChangeResult {
  const errors: Record<string, string> = {};

  if (!input.current) errors.current_password = "Enter your current password.";

  if (input.next.length < 8) errors.new_password = "Use at least 8 characters.";
  else if (input.next.length > 72) errors.new_password = "Use 72 characters or fewer.";
  else if (!/[A-Za-z]/.test(input.next) || !/\d/.test(input.next)) errors.new_password = "Include at least one letter and one number.";
  else if (input.current && input.next === input.current) errors.new_password = "Choose a password different from your current one.";

  if (input.confirm !== input.next) errors.confirm_password = "The passwords don't match.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

/** The rules for choosing a password with no current one to compare (a reset link). Same limits as a change. */
export function validateNewPassword(next: string, confirm: string): PasswordChangeResult {
  const errors: Record<string, string> = {};
  if (next.length < 8) errors.new_password = "Use at least 8 characters.";
  else if (next.length > 72) errors.new_password = "Use 72 characters or fewer.";
  else if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) errors.new_password = "Include at least one letter and one number.";
  if (confirm !== next) errors.confirm_password = "The passwords don't match.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}
