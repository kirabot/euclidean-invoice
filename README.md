# Euclidean invoice builder

Static browser app: open index.html through an HTTP server, or use GitHub Pages.
No backend, API key, or external QR service is required. Invoice data stays in the browser.

## For agents
1. Open the hosted page.
2. Replace the Invoice JSON textarea with the JSON below, using the actual buyer, dates, invoice number, currency and line items.
3. Click Render and check the preview.
4. Click Download PDF and use the browser's Save as PDF destination.
This is a browser UI, not an HTTP invoice-generation API. Agents without browser/print support can prepare the JSON for a person to paste.

```json
{
  "invoice": {
    "number": "EU-2026-10-0001",
    "issue_date": "2026-10-18",
    "due_date": "2026-11-01",
    "currency": "EUR",
    "notes": "Thank you for your business."
  },
  "buyer": {
    "company_name": "Client Company Ltd",
    "address_lines": ["Street 12", "City, Country"],
    "tax_id": "",
    "contact_name": "",
    "email": ""
  },
  "line_items": [
    {"description": "Design services", "qty": 1, "unit": "Lot", "unit_price": 1000, "tax_rate": 0}
  ],
  "totals": {"discount": 0, "shipping": 0, "tax_included": false}
}
```

Tax rates are fractions (0.20 for 20%). Check totals and payment details before issuing.
Seller and logo defaults are included; seller and branding objects can override defaults.
RSD invoices generate a payment QR locally; other currencies display bank details without a QR.
Invoice numbers are not persisted or guaranteed unique: supply the correct number yourself.

## GitHub Pages
Settings → Pages → Deploy from a branch → main → / (root).
The entry point is index.html; invoice.html provides the same app.
The legacy Flask server remains optional for previous integrations.

## Third-party code
qrcode.js: QR Code Generator by Kazuhiko Arase, MIT license, vendored from
https://github.com/kazuhikoarase/qrcode-generator (js/dist/qrcode.js).

## Validation and tests
Run `TZ=Europe/Belgrade node --test tests/invoice.test.cjs` (Node 18+).
The editor rejects nonnumeric/negative amounts, empty items, invalid dates and tax rates outside 0–1.
Line amounts and taxes round to the currency's minor units before totaling.
`discount` is a fixed adjustment after line taxes; `shipping` adds no automatic tax.
With `tax_included: true`, prices already include tax and no additional tax is added.
Download PDF opens the browser print dialog; choose Save as PDF, A4 and disable browser headers/footers.
