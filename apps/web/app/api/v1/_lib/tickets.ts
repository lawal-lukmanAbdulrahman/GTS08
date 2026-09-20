import { isUuid } from "@gts/utils";
import { isPlainObject, oneLine } from "./validate";

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["normal", "urgent"] as const;
export const MAX_BODY = 5000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+\-()\s]{3,20}$/;

type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export interface NewTicket {
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  subject: string;
  body: string;
  order_id: string | null;
}

/** A customer's new ticket. Only these fields are ever read, so status, priority and assignee can't be set from outside. */
export function validateNewTicket(input: unknown): Result<NewTicket> {
  if (!isPlainObject(input)) return { ok: false, errors: { _body: "Expected a JSON object." } };
  const errors: Record<string, string> = {};

  const email = typeof input.customer_email === "string" ? oneLine(input.customer_email).toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 255) errors.customer_email = "Enter a valid email address.";

  let name: string | null = null;
  if (input.customer_name !== undefined && input.customer_name !== null) {
    if (typeof input.customer_name !== "string" || oneLine(input.customer_name).length > 255) errors.customer_name = "Name must be 255 characters or fewer.";
    else name = oneLine(input.customer_name) || null;
  }

  let phone: string | null = null;
  if (input.customer_phone !== undefined && input.customer_phone !== null && input.customer_phone !== "") {
    if (typeof input.customer_phone !== "string" || !PHONE.test(input.customer_phone.trim())) errors.customer_phone = "Enter a valid phone number.";
    else phone = input.customer_phone.trim();
  }

  const subject = typeof input.subject === "string" ? oneLine(input.subject) : "";
  if (!subject) errors.subject = "Give your message a subject.";
  else if (subject.length > 255) errors.subject = "Subject must be 255 characters or fewer.";

  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body) errors.body = "Tell us how we can help.";
  else if (body.length > MAX_BODY) errors.body = `Please keep your message under ${MAX_BODY} characters.`;

  let orderId: string | null = null;
  if (input.order_id !== undefined && input.order_id !== null) {
    if (!isUuid(input.order_id)) errors.order_id = "That order isn't valid.";
    else orderId = input.order_id;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { customer_email: email, customer_name: name, customer_phone: phone, subject, body, order_id: orderId } };
}

export interface TicketPatch {
  status?: (typeof TICKET_STATUSES)[number];
  priority?: (typeof TICKET_PRIORITIES)[number];
  assigned_to?: string | null;
  tags?: string[];
}

export function validateTicketPatch(input: unknown): Result<TicketPatch> {
  if (!isPlainObject(input)) return { ok: false, errors: { _body: "Expected a JSON object." } };
  const value: TicketPatch = {};
  const errors: Record<string, string> = {};

  if ("status" in input) {
    if (!(TICKET_STATUSES as readonly unknown[]).includes(input.status)) errors.status = `Status must be one of: ${TICKET_STATUSES.join(", ")}.`;
    else value.status = input.status as TicketPatch["status"];
  }
  if ("priority" in input) {
    if (!(TICKET_PRIORITIES as readonly unknown[]).includes(input.priority)) errors.priority = `Priority must be one of: ${TICKET_PRIORITIES.join(", ")}.`;
    else value.priority = input.priority as TicketPatch["priority"];
  }
  if ("assigned_to" in input) {
    if (input.assigned_to === null) value.assigned_to = null;
    else if (!isUuid(input.assigned_to)) errors.assigned_to = "Choose a staff member.";
    else value.assigned_to = input.assigned_to;
  }
  if ("tags" in input) {
    const tags = input.tags;
    if (!Array.isArray(tags) || tags.length > 10 || tags.some((t) => typeof t !== "string" || !oneLine(t) || oneLine(t).length > 30)) errors.tags = "Use up to 10 short tags (30 characters each).";
    else value.tags = [...new Set((tags as string[]).map(oneLine))];
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (Object.keys(value).length === 0) return { ok: false, errors: { _body: "Nothing to update." } };
  return { ok: true, value };
}
