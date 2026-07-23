# Design Tokens

> Extracted from `01-marketing-landing-wireframe.html`. Feeds `packages/config/tailwind.config.ts`.

## Colors

| Token | Value | Usage |
|-------|-------|-------|
| `green` | `#2E9E5B` | Primary brand, CTAs, positive states |
| `green-hover` | `#23824A` | Button hover, active nav |
| `green-soft` | `#DCEFE3` | Tint backgrounds, status badges |
| `ink` | `#20261F` | Dark cards, footer, dark buttons |
| `ink-2` | `#2A312A` | Footer inputs, secondary dark |
| `mint` | `#EAF5EE` | Feature cards, CTA band background |
| `page` | `#F6F8F6` | Page background |
| `card` | `#FFFFFF` | Card backgrounds |
| `txt` | `#1A211B` | Primary text |
| `txt-2` | `#5C6A5E` | Secondary text |
| `txt-3` | `#8A968C` | Muted text, labels, eyebrows |
| `line` | `#E3E9E4` | Borders, dividers |
| `amber` | `#E8A23D` | Warning states |
| `orange` | `#E2622B` | Accent (annual pricing tag) |
| `red` | `#D75A4A` | Negative states, destructive |

## Typography

| Token | Font | Usage |
|-------|------|-------|
| `font-display` | Bricolage Grotesque | Headings, display text, logo |
| `font-body` | DM Sans | Body text, UI labels, buttons |
| `font-mono` | IBM Plex Mono | Prices (₦), order numbers, SKUs |

## Border Radius

| Token | Value |
|-------|-------|
| `rounded-lg` | `22px` |
| `rounded-md` | `14px` |
| `rounded-sm` | `9px` |

## Shadows

| Token | Value |
|-------|-------|
| `shadow-gts` | `0 18px 50px -18px rgba(32,38,31,.22)` |
| `shadow-gts-sm` | `0 6px 20px -8px rgba(32,38,31,.14)` |

## Implementation

All tokens are defined in `packages/config/tailwind.config.ts` and consumed via Tailwind utility classes. Font CSS variables (`--font-display`, `--font-body`, `--font-mono`) are set by `next/font/google` in `apps/web/app/layout.tsx`.
