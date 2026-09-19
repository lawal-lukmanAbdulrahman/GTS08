/**
 * Orders recorded from a WhatsApp chat keep the customer's contact in
 * orders.internal_notes as "WhatsApp customer: Name (phone)". This reads it
 * back, ignoring anything appended later (e.g. a cancellation note).
 */
export function parseWhatsAppContact(notes: string | null | undefined): { name: string; phone: string } | null {
  if (!notes) return null;
  const match = notes.match(/^WhatsApp customer:\s*(.+?)\s*\(([^)]+)\)/m);
  return match ? { name: match[1]!, phone: match[2]! } : null;
}
