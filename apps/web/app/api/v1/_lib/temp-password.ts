import { randomBytes } from "node:crypto";

/** A random one-time password for a new staff account: 12+ characters with a letter, a digit and a symbol. */
export function generateTempPassword(): string {
  return `${randomBytes(9).toString("base64url")}aA1!`;
}
