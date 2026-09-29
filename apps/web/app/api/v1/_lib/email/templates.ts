import { formatKobo, receiptBrand } from "@gts/utils";
import { esc } from "./html";

export interface StoreInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const GOLD = "#EDCF5D";
const INK = "#1C1C1C";

/** One shared, plain, inline-styled shell so every message looks like it came from the same shop. */
function shell(store: StoreInfo, title: string, bodyHtml: string): string {
  const footer = [store.name, store.address, store.phone ? `Tel: ${store.phone}` : null].filter(Boolean).map(esc).join(" · ");
  return `<!doctype html><html><body style="margin:0;background:#F8F7F4;font-family:Arial,Helvetica,sans-serif;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${GOLD};padding:18px 24px;font-size:18px;font-weight:800;letter-spacing:.3px;">${esc(store.name)}</td></tr>
<tr><td style="padding:28px 24px 8px;"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px 24px;color:#6b7280;font-size:12px;border-top:1px solid #eee;">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${html}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:20px 0;"><a href="${esc(href)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">${esc(label)}</a></p>`;

export function staffWelcomeEmail(o: { name: string; role: string; email: string; signInUrl: string; oneTimePassword?: string; store: StoreInfo }): Rendered {
  const role = o.role.replace("_", " ");
  const credentials = o.oneTimePassword
    ? p(`Sign in with your email <strong>${esc(o.email)}</strong> and this one-time password:`) +
      `<p style="margin:0 0 14px;"><code style="display:inline-block;background:#F3F4F6;padding:10px 14px;border-radius:6px;font-size:18px;font-weight:700;letter-spacing:.5px;">${esc(o.oneTimePassword)}</code></p>` +
      p("You'll be asked to choose your own new password straight away. Please don't share this one.")
    : p("Your admin will give you your first password. You'll be asked to choose your own new one when you sign in.");
  const text = [
    `Welcome to ${o.store.name}, ${o.name}.`,
    `Your account is ready, with the role: ${role}.`,
    o.oneTimePassword ? `Sign in with ${o.email} and this one-time password: ${o.oneTimePassword}\nYou'll be asked to choose your own new password straight away.` : "Your admin will give you your first password.",
    `Sign in: ${o.signInUrl}`,
  ].join("\n\n");
  return {
    subject: `Welcome to ${o.store.name}: your account is ready`,
    html: shell(o.store, `Welcome, ${o.name}`, p(`Your <strong>${esc(role)}</strong> account at ${esc(o.store.name)} is ready.`) + credentials + button(o.signInUrl, "Sign in")),
    text,
  };
}

export function passwordChangedEmail(o: { name: string; whenText: string; signInUrl: string; store: StoreInfo; account?: "staff" | "customer" }): Rendered {
  const kind = o.account === "customer" ? "account" : "staff account";
  const help = o.store.phone ? `call ${o.store.phone}` : o.account === "customer" ? "reply to this email" : "contact your admin";
  return {
    subject: "Your password was changed",
    html: shell(
      o.store,
      "Your password was changed",
      p(`Hello ${esc(o.name)}, the password on your ${esc(o.store.name)} ${kind} was changed on <strong>${esc(o.whenText)}</strong>.`) +
        p(`If this wasn't you, ${esc(help)} straight away so your account can be secured.`) +
        button(o.signInUrl, "Sign in")
    ),
    text: `Hello ${o.name}, the password on your ${o.store.name} ${kind} was changed on ${o.whenText}.\n\nIf this wasn't you, ${help} straight away.\n\nSign in: ${o.signInUrl}`,
  };
}

/** The greeting after a customer creates an account. */
export function customerWelcomeEmail(o: { store: StoreInfo; name: string; shopUrl: string }): Rendered {
  return {
    subject: `Welcome to ${o.store.name}`,
    html: shell(o.store, `Welcome, ${o.name}`, p(`Your ${esc(o.store.name)} account is ready. You can save your details for faster checkout, keep a wishlist and follow every order from your account.`) + button(o.shopUrl, "Start shopping")),
    text: [`Welcome to ${o.store.name}, ${o.name}.`, "Your account is ready. You can save your details for faster checkout, keep a wishlist and follow every order from your account.", `Start shopping: ${o.shopUrl}`].join("\n\n"),
  };
}

/** The link that lets someone choose a new password. One link, time-limited, and harmless if they never asked for it. */
export function passwordResetEmail(o: { store: StoreInfo; name: string; resetUrl: string; validFor: string }): Rendered {
  return {
    subject: `Reset your ${o.store.name} password`,
    html: shell(
      o.store,
      "Reset your password",
      p(`Hello ${esc(o.name)}. Use the button below to choose a new password for your ${esc(o.store.name)} account. The link works once and expires in ${esc(o.validFor)}.`) +
        button(o.resetUrl, "Choose a new password") +
        p("If you didn't ask for this, you can ignore this email. Your password won't change.")
    ),
    text: [`Hello ${o.name}. Choose a new password for your ${o.store.name} account (the link works once and expires in ${o.validFor}):`, o.resetUrl, "If you didn't ask for this, ignore this email. Your password won't change."].join("\n\n"),
  };
}

interface Line {
  name: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  unitPrice?: number;
  lineTotal: number;
}

const variantOf = (l: Line) => [l.size, l.color].filter(Boolean).join(" / ");

/** Qty / Description / Unit price / Amount, the columns of the shop's handwritten receipt. */
function receiptTable(items: Line[]): string {
  const th = (label: string, align: string) => `<th align="${align}" style="font-size:12px;color:#6b7280;padding-bottom:4px;">${label}</th>`;
  const rows = items
    .map((l) => {
      const v = variantOf(l);
      const unit = l.unitPrice ?? Math.round(l.lineTotal / l.quantity);
      const td = (html: string, align = "left") => `<td align="${align}" style="padding:8px 4px;border-bottom:1px solid #eee;font-size:14px;">${html}</td>`;
      return `<tr>${td(esc(l.quantity))}${td(`${esc(l.name)}${v ? `<br><span style="color:#6b7280;font-size:12px;">${esc(v)}</span>` : ""}`)}${td(esc(formatKobo(unit)), "right")}${td(esc(formatKobo(l.lineTotal)), "right")}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr>${th("Qty", "left")}${th("Description", "left")}${th("Unit price", "right")}${th("Amount", "right")}</tr>${rows}</table>`;
}

const receiptLine = (l: Line) => {
  const v = variantOf(l);
  const unit = l.unitPrice ?? Math.round(l.lineTotal / l.quantity);
  return `${l.quantity} x ${l.name}${v ? ` (${v})` : ""} @ ${formatKobo(unit)} = ${formatKobo(l.lineTotal)}`;
};

const receiptFooterHtml = (b: ReturnType<typeof receiptBrand>) =>
  `<p style="margin:18px 0 4px;text-align:center;font-size:15px;">${esc(b.thanks)}</p><p style="margin:0 0 14px;text-align:center;font-size:15px;font-weight:700;">${esc(b.orderAlso)}</p>`;

const PAYMENT_LABEL = { cash: "Cash", pos_terminal: "Card" } as const;

export function posReceiptEmail(o: {
  store: StoreInfo;
  orderNumber: string;
  dateText: string;
  items: Line[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: keyof typeof PAYMENT_LABEL;
  cashierName: string;
}): Rendered {
  const brand = receiptBrand({ name: o.store.name, phone: o.store.phone, website: o.store.website });
  const store = { ...o.store, name: brand.name, phone: brand.phone };
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:3px 0;font-size:14px;${strong ? "font-weight:800;font-size:16px;" : ""}">${esc(label)}</td><td align="right" style="padding:3px 0;font-size:14px;${strong ? "font-weight:800;font-size:16px;" : ""}">${esc(value)}</td></tr>`;
  const totals =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    (o.discountAmount > 0 ? row("Subtotal", formatKobo(o.subtotal)) + row("Discount", `-${formatKobo(o.discountAmount)}`) : "") +
    row("Total \u2192", formatKobo(o.total), true) +
    row("Paid by", PAYMENT_LABEL[o.paymentMethod]) +
    `</table>`;
  return {
    subject: `Your receipt from ${brand.name}: ${o.orderNumber}`,
    html: shell(
      store,
      "Thank you for your purchase",
      p(`${esc(brand.name)} · ${esc(brand.phone)}`) +
        p(`<strong>Date:</strong> ${esc(o.dateText)}<br><strong>Receipt No:</strong> ${esc(o.orderNumber)}`) +
        receiptTable(o.items) +
        totals +
        p(`<span style="color:#6b7280;font-size:13px;">Served by ${esc(o.cashierName)}.</span>`) +
        receiptFooterHtml(brand)
    ),
    text: [
      brand.name,
      brand.phone,
      "",
      `Date: ${o.dateText}`,
      `Receipt No: ${o.orderNumber}`,
      "",
      ...o.items.map(receiptLine),
      "",
      ...(o.discountAmount > 0 ? [`Subtotal: ${formatKobo(o.subtotal)}`, `Discount: -${formatKobo(o.discountAmount)}`] : []),
      `Total -> ${formatKobo(o.total)}`,
      `Paid by: ${PAYMENT_LABEL[o.paymentMethod]}`,
      `Served by ${o.cashierName}`,
      "",
      brand.thanks,
      brand.orderAlso,
    ].join("\n"),
  };
}

const STATUS_WORDS: Record<string, { subject: (n: string) => string; title: string; line: string }> = {
  confirmed: {
    subject: (n) => `Order ${n} is confirmed`,
    title: "Your order is confirmed",
    line: "We've confirmed your order and are preparing it for pickup.",
  },
  ready_for_pickup: {
    subject: (n) => `Order ${n} is ready for pickup`,
    title: "Your order is ready for pickup",
    line: "Your order is ready for collection at our store. Please bring your order code.",
  },
  collected: {
    subject: (n) => `Order ${n} has been collected`,
    title: "Order collected",
    line: "Your order has been collected. Thank you for shopping with us!",
  },
  cancelled: {
    subject: (n) => `Order ${n} was cancelled`,
    title: "Your order was cancelled",
    line: "Your order has been cancelled.",
  },
  expired: {
    subject: (n) => `Order ${n} pickup window expired`,
    title: "Pickup window expired",
    line: "The pickup window for your order has expired.",
  },
  on_hold: {
    subject: (n) => `Order ${n} is on hold`,
    title: "Your order is on hold",
    line: "Your order has been placed on temporary hold. Our team will contact you shortly.",
  },
};

/** A short update for pickup order lifecycle. */
export function orderStatusEmail(o: {
  store: StoreInfo;
  name: string;
  orderNumber: string;
  status: string;
  trackUrl: string;
  paid?: boolean;
  totalKobo?: number;
  reason?: string | null;
  storeAddress?: string | null;
  pickupDeadlineText?: string | null;
  operatingHours?: string | null;
}): Rendered | null {
  const words = STATUS_WORDS[o.status];
  if (!words) return null;

  const addressText =
    o.status === "ready_for_pickup" && o.storeAddress
      ? p(`Pickup Location: <strong>${esc(o.storeAddress)}</strong>`)
      : "";

  const hoursText =
    o.status === "ready_for_pickup" && o.operatingHours
      ? p(`Collection Hours: <strong>${esc(o.operatingHours)}</strong>`)
      : "";

  const deadlineText =
    o.status === "ready_for_pickup" && o.pickupDeadlineText
      ? p(`Please collect your order by: <strong>${esc(o.pickupDeadlineText)}</strong>`)
      : "";

  const paymentNote =
    o.status === "ready_for_pickup" && !o.paid
      ? p(
          `<strong>Payment due at pickup:</strong> ${esc(
            formatKobo(o.totalKobo ?? 0)
          )}. You can pay with cash, card, or transfer.`
        )
      : "";

  const refund =
    o.status === "cancelled" && o.paid
      ? p("Since you'd already paid, we'll process your refund. It can take a few working days to reach your account.")
      : "";

  const reasonNote = o.reason ? p(`Note: ${esc(o.reason)}`) : "";

  return {
    subject: words.subject(o.orderNumber),
    html: shell(
      o.store,
      words.title,
      p(`Hello ${esc(o.name)}. ${esc(words.line)}`) +
        p(`Order reference: <strong>${esc(o.orderNumber)}</strong>`) +
        addressText +
        hoursText +
        deadlineText +
        paymentNote +
        reasonNote +
        refund +
        button(o.trackUrl, "Track my order")
    ),
    text: [
      `Hello ${o.name}. ${words.line}`,
      `Order reference: ${o.orderNumber}`,
      o.status === "ready_for_pickup" && o.storeAddress ? `Pickup Location: ${o.storeAddress}` : "",
      o.status === "ready_for_pickup" && o.operatingHours ? `Collection Hours: ${o.operatingHours}` : "",
      o.status === "ready_for_pickup" && o.pickupDeadlineText ? `Collect by: ${o.pickupDeadlineText}` : "",
      o.status === "ready_for_pickup" && !o.paid ? `Payment due at pickup: ${formatKobo(o.totalKobo ?? 0)}` : "",
      o.reason ? `Note: ${o.reason}` : "",
      refund ? "Since you'd already paid, we'll process your refund." : "",
      `Track your order: ${o.trackUrl}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/** A marketing message: the admin's text, one button, and always a way to opt out. */
export function campaignEmail(o: { store: StoreInfo; subject: string; preview?: string | null; bodyHtml: string; ctaLabel?: string | null; ctaUrl?: string | null; unsubscribeEmail: string }): Rendered {
  const cta = o.ctaLabel && o.ctaUrl ? button(o.ctaUrl, o.ctaLabel) : "";
  const optOut = `<p style="margin:18px 0 0;font-size:12px;color:#6b7280;">You're getting this because you shopped with ${esc(o.store.name)}. To unsubscribe, email <a href="mailto:${esc(o.unsubscribeEmail)}?subject=Unsubscribe" style="color:#6b7280;">${esc(o.unsubscribeEmail)}</a> and we'll take you off the list.</p>`;
  return {
    subject: o.subject,
    html: shell(o.store, o.subject, (o.preview ? `<span style="display:none;max-height:0;overflow:hidden;">${esc(o.preview)}</span>` : "") + o.bodyHtml + cta + optOut),
    text: [o.subject, "", o.bodyHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim(), o.ctaLabel && o.ctaUrl ? `${o.ctaLabel}: ${o.ctaUrl}` : "", `To unsubscribe, email ${o.unsubscribeEmail} and we'll take you off the list.`].filter((l) => l !== "").join("\n\n"),
  };
}

export function ticketReceivedEmail(o: { store: StoreInfo; name: string; reference: string; subject: string }): Rendered {
  return {
    subject: `We got your message (${o.reference})`,
    html: shell(o.store, "We've got your message", p(`Hello ${esc(o.name || "there")}, thanks for contacting ${esc(o.store.name)}.`) + p(`Your reference is <strong>${esc(o.reference)}</strong> (${esc(o.subject)}). Quote it if you write to us again. We'll reply as soon as we can.`)),
    text: `Hello ${o.name || "there"}, thanks for contacting ${o.store.name}.\n\nYour reference is ${o.reference} (${o.subject}). We'll reply as soon as we can.`,
  };
}

export function ticketReplyEmail(o: { store: StoreInfo; name: string; reference: string; subject: string; reply: string }): Rendered {
  const html = esc(o.reply).replace(/\r?\n/g, "<br>");
  return {
    subject: `Re: ${o.subject} (${o.reference})`,
    html: shell(o.store, `Reply to your message`, p(`Hello ${esc(o.name || "there")},`) + `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${html}</p>` + p(`<span style="color:#6b7280;font-size:13px;">Reference ${esc(o.reference)}. Reply to this email to continue the conversation.</span>`)),
    text: `Hello ${o.name || "there"},\n\n${o.reply}\n\nReference ${o.reference}.`,
  };
}

export function orderPaidEmail(o: { store: StoreInfo; name: string; orderNumber: string; items: Line[]; total: number; trackUrl: string }): Rendered {
  const brand = receiptBrand({ name: o.store.name, phone: o.store.phone, website: o.store.website });
  const store = { ...o.store, name: brand.name, phone: brand.phone };
  return {
    subject: `Payment received: order ${o.orderNumber}`,
    html: shell(
      store,
      "We've received your payment",
      p(`Thank you, ${esc(o.name)}. Your payment for order <strong>${esc(o.orderNumber)}</strong> was successful.`) +
        receiptTable(o.items) +
        p(`<strong>Total paid \u2192 ${esc(formatKobo(o.total))}</strong>`) +
        p("Track your order any time with your order number and this email address.") +
        button(o.trackUrl, "Track my order") +
        receiptFooterHtml(brand)
    ),
    text: `Thank you, ${o.name}. Your payment for order ${o.orderNumber} was successful.\n\n${o.items.map(receiptLine).join("\n")}\n\nTotal paid -> ${formatKobo(o.total)}\n\nTrack your order: ${o.trackUrl}\n\n${brand.thanks}\n${brand.orderAlso}`,
  };
}

/** A pay-on-pickup order: where to collect, what to bring (the amount) and the deadline before it is cancelled. */
export function pickupOrderEmail(o: { store: StoreInfo; name: string; orderNumber: string; items: Line[]; total: number; address: string | null; deadlineText: string; trackUrl: string }): Rendered {
  const brand = receiptBrand({ name: o.store.name, phone: o.store.phone, website: o.store.website });
  const store = { ...o.store, name: brand.name, phone: brand.phone };
  const where = o.address ? `at ${o.address}` : `from ${brand.name} (call ${brand.phone} for directions)`;
  return {
    subject: `Order ${o.orderNumber} is held for pickup`,
    html: shell(
      store,
      "Your order is held for pickup",
      p(`Thank you, ${esc(o.name)}. We're holding order <strong>${esc(o.orderNumber)}</strong> for you. Collect it ${esc(where)} and pay when you collect.`) +
        receiptTable(o.items) +
        p(`<strong>To pay at pickup \u2192 ${esc(formatKobo(o.total))}</strong>`) +
        p(`Please collect by <strong>${esc(o.deadlineText)}</strong>. After that the order is cancelled and the items go back on sale.`) +
        button(o.trackUrl, "Check my order") +
        receiptFooterHtml(brand)
    ),
    text: [
      `Thank you, ${o.name}. We're holding order ${o.orderNumber} for you. Collect it ${where} and pay when you collect.`,
      o.items.map(receiptLine).join("\n"),
      `To pay at pickup -> ${formatKobo(o.total)}`,
      `Please collect by ${o.deadlineText}. After that the order is cancelled and the items go back on sale.`,
      `Check your order: ${o.trackUrl}`,
      `${brand.thanks}\n${brand.orderAlso}`,
    ].join("\n\n"),
  };
}

const FLAG_WORDS: Record<string, { subject: string; line: string }> = {
  in_review: { subject: "is being looked at", line: "An admin is now reviewing" },
  resolved: { subject: "was resolved", line: "An admin marked as resolved" },
  dismissed: { subject: "was closed", line: "An admin closed without changes" },
  open: { subject: "was reopened", line: "An admin reopened" },
};

export function flagUpdatedEmail(o: { store: StoreInfo; name: string; productName: string; status: string; note: string | null }): Rendered {
  const w = FLAG_WORDS[o.status] ?? FLAG_WORDS.in_review!;
  return {
    subject: `Your flag on "${o.productName}" ${w.subject}`,
    html: shell(
      o.store,
      `Your flag ${w.subject}`,
      p(`Hello ${esc(o.name)}. ${esc(w.line)} your flag on <strong>${esc(o.productName)}</strong>.`) +
        (o.note ? `<p style="margin:0 0 14px;padding:10px 14px;border-left:3px solid ${GOLD};background:#FAFAF7;font-size:15px;line-height:1.5;">${esc(o.note)}</p>` : "")
    ),
    text: `Hello ${o.name}. ${w.line} your flag on ${o.productName}.${o.note ? `\n\nAdmin's note: ${o.note}` : ""}`,
  };
}

export function accountAccessEmail(o: { store: StoreInfo; name: string; blocked: boolean; signInUrl?: string }): Rendered {
  const help = o.store.phone ? `Call ${o.store.phone} if you think this is a mistake.` : "Speak to your admin if you think this is a mistake.";
  if (o.blocked) {
    return {
      subject: "Your staff access has been suspended",
      html: shell(o.store, "Your access was suspended", p(`Hello ${esc(o.name)}, an admin has suspended your ${esc(o.store.name)} staff access. You can't sign in until it's restored.`) + p(esc(help))),
      text: `Hello ${o.name}, an admin has suspended your ${o.store.name} staff access. You can't sign in until it's restored. ${help}`,
    };
  }
  return {
    subject: "Your staff access has been restored",
    html: shell(o.store, "Your access is back", p(`Hello ${esc(o.name)}, your ${esc(o.store.name)} staff access has been restored.`) + (o.signInUrl ? button(o.signInUrl, "Sign in") : "")),
    text: `Hello ${o.name}, your ${o.store.name} staff access has been restored.${o.signInUrl ? ` Sign in: ${o.signInUrl}` : ""}`,
  };
}
