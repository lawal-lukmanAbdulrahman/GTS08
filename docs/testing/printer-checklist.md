# Receipt printer checklist

Receipts are laid out as fixed-width text for 58 mm, 80 mm and A4 paper, and the
layout is unit-tested. What software can't check is how a real printer and browser
turn that into paper. Run this once per printer model, and again after any change
to `apps/dashboard/app/pos/receipt-layout.ts` or its print CSS.

Record the result at the bottom.

## Before you start
- Use the real till computer and browser (Chrome or Edge), signed in as a cashier.
- Have a test sale ready: one item, cash, so the receipt shows a change line.
- In the print dialog: **Margins: None (or Default)**, **Scale: 100%**, **Headers and footers: off**.

## For each paper size (58 mm, 80 mm, A4)
1. On the receipt screen choose the paper size, then **Print Receipt**.
2. Tick each line when it is true on the paper:

| Check | 58 mm | 80 mm | A4 |
|---|---|---|---|
| Nothing is cut off at the left or right edge | ☐ | ☐ | ☐ |
| Store name, address and phone are at the top | ☐ | ☐ | ☐ |
| Order number and date are readable | ☐ | ☐ | ☐ |
| Long product names wrap onto the next line, not off the page | ☐ | ☐ | ☐ |
| Amounts line up on the right | ☐ | ☐ | ☐ |
| Subtotal, discount (if any), total, payment, cash received and change are all there | ☐ | ☐ | ☐ |
| Only the receipt prints: no buttons, menus or browser header/footer | ☐ | ☐ | ☐ |
| The page is not blank and there is no extra blank page after it | ☐ | ☐ | ☐ |
| The paper cuts (or feeds) after the last line, not in the middle | ☐ | ☐ | ☐ |
| Text is dark and readable for a customer | ☐ | ☐ | ☐ |

## Also check
- [ ] A **reprint** (Find a sale → Reprint) shows `*** DUPLICATE ***` under the title.
- [ ] A WhatsApp sale shows the customer's name and phone.
- [ ] **Share via WhatsApp** opens WhatsApp with the receipt text readable.
- [ ] A very long order (10+ lines) prints without overlapping.

## Result
| Date | Printer model | Paper | Browser | Passed | Notes | Tested by |
|---|---|---|---|---|---|---|
| | | | | | | |
