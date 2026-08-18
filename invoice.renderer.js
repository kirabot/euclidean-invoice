const $ = (id) => document.getElementById(id);

const TEMPLATE_URL = "invoice.template.html";

// Hardcoded invariants
const DEFAULTS = {
  seller: {
    company_name: "Euclidean Studios DOO Beograd",
    address_lines: [
      "Partizanske Avijacije 19",
      "11070 Novi Beograd, Serbia"
    ],
    tax_id: "PIB 114224573",
    registration_id: "MB 21990663",
    phone: "+381 64 100 7006",
    email: "euclideanstudios@gmail.com",
    website: "",
    bank: {
      beneficiary: "Euclidean Studios DOO Beograd",
      bank_name: "",
      iban: "",
      swift: "",
      account_no_rsd: "325-9500700211227-21",
      account_no_eur: "325-9601700085970-91",
      bank_address: ""
    }
  },
  branding: {
    accent: "#8b1e1e",
    logo_path: "NazSkull.webp"
  },
  invoice: {
    notes: "Thank you for your business."
  }
};

const INVOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["invoice", "buyer", "line_items"],
  properties: {
    invoice: {
      type: "object",
      additionalProperties: false,
      required: ["number", "issue_date", "due_date", "currency"],
      properties: {
        number: { type: "string", minLength: 1 },
        issue_date: { type: "string", minLength: 1 },
        due_date: { type: "string", minLength: 1 },
        currency: { type: "string", minLength: 1 },
        notes: { type: "string" }
      }
    },
    buyer: {
      type: "object",
      additionalProperties: false,
      required: ["company_name", "address_lines"],
      properties: {
        company_name: { type: "string", minLength: 1 },
        address_lines: {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 }
        },
        tax_id: { type: "string" },
        contact_name: { type: "string" },
        email: { type: "string" }
      }
    },
    line_items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "qty", "unit_price"],
        properties: {
          description: { type: "string", minLength: 1 },
          qty: { type: "number" },
          unit: { type: "string" },
          unit_price: { type: "number" },
          tax_rate: { type: "number" }
        }
      }
    },
    totals: {
      type: "object",
      additionalProperties: false,
      properties: {
        discount: { type: "number" },
        shipping: { type: "number" },
        tax_included: { type: "boolean" }
      }
    },
    ips: {
      type: "object",
      additionalProperties: false,
      properties: {
        sf: { type: "string" },
        s: { type: "string" }
      }
    },
    branding: {
      type: "object",
      additionalProperties: false,
      properties: {
        accent: { type: "string" },
        logo_path: { type: "string" }
      }
    },
    seller: {
      type: "object",
      additionalProperties: false,
      properties: {
        company_name: { type: "string" },
        address_lines: {
          type: "array",
          items: { type: "string" }
        },
        tax_id: { type: "string" },
        registration_id: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        website: { type: "string" },
        bank: {
          type: "object",
          additionalProperties: false,
          properties: {
            beneficiary: { type: "string" },
            bank_name: { type: "string" },
            iban: { type: "string" },
            swift: { type: "string" },
            account_no_rsd: { type: "string" },
            account_no_eur: { type: "string" },
            bank_address: { type: "string" }
          }
        }
      }
    }
  }
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(INVOICE_SCHEMA);

let templateHtml = null;

async function loadTemplate() {
  if (templateHtml) return templateHtml;
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error(`Template fetch failed (${res.status})`);
  templateHtml = await res.text();
  return templateHtml;
}

function deepMerge(a, b) {
  if (!b) return structuredClone(a);
  const out = Array.isArray(a) ? [...a] : { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function getValue(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function setText(el, value) {
  el.textContent = value ?? "";
}

function money(n, ccy) {
  const x = Number(n || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy || "EUR" }).format(x);
}

function lineTotal(it) {
  const qty = Number(it.qty || 0);
  const unit = Number(it.unit_price || 0);
  const base = qty * unit;
  const taxRate = Number(it.tax_rate || 0);
  const tax = base * taxRate;
  return { base, tax, gross: base + tax };
}

function defaultInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const seq = "0001";
  return `EU-${year}-${month}-${seq}`;
}

function computeTotals(doc) {
  const items = doc.line_items || [];
  let sub = 0;
  let tax = 0;
  for (const it of items) {
    const t = lineTotal(it);
    sub += t.base;
    tax += t.tax;
  }
  const discount = Number(doc.totals?.discount || 0);
  const shipping = Number(doc.totals?.shipping || 0);
  const afterDiscount = sub - discount;
  const grand = afterDiscount + shipping + (doc.totals?.tax_included ? 0 : tax);
  return { sub, tax, discount, shipping, grand };
}

function pickAccountNo(doc) {
  const bank = doc.seller?.bank || {};
  const ccy = (doc.invoice?.currency || "EUR").toUpperCase();
  if (ccy === "RSD") return bank.account_no_rsd || bank.account_no_eur || "";
  return bank.account_no_eur || bank.account_no_rsd || "";
}

function stripOrgIdPrefix(value, prefix) {
  return String(value || "").replace(new RegExp(`^\\s*${prefix}\\s+`, "i"), "").trim();
}

function orgIdDisplay(value, rsdLabel, eurLabel, ccy) {
  const raw = String(value || "").trim();
  const isRsd = ccy === "RSD";
  return {
    label: isRsd ? rsdLabel : eurLabel,
    value: isRsd ? stripOrgIdPrefix(raw, rsdLabel) : stripOrgIdPrefix(stripOrgIdPrefix(raw, rsdLabel), "MB")
  };
}

function normalizeR18(account) {
  const digits = String(account || "").replaceAll("-", "").replaceAll(" ", "");
  return digits;
}

function formatRsdForI(amountNumber) {
  const amt = Number(amountNumber || 0);
  const fixed = amt.toFixed(2);
  const withComma = fixed.replace(".", ",");
  return "RSD" + withComma;
}

function buildIpsString(doc, totals) {
  const bank = doc.seller?.bank || {};
  const account = normalizeR18(bank.account_no_rsd);

  const payeeName = doc.seller?.company_name || "";
  const amount = totals.grand;

  const sf = String(doc.ips?.sf ?? "221").trim();
  const purpose = String(doc.ips?.s ?? "Usluge 3D dizajna i proizvodnje").trim().slice(0, 35);

  const inv = String(doc.invoice?.number || "").replaceAll(" ", "");
  const roDefault = ("00" + inv).slice(0, 25);
  const ro = roDefault;

  const parts = [
    "K:PR",
    "V:01",
    "C:1",
    `R:${account}`,
    `N:${payeeName}`,
    `I:${formatRsdForI(amount)}`,
    `SF:${sf}`
  ];

  if (purpose) parts.push(`S:${purpose}`);
  if (ro) parts.push(`RO:${ro}`);

  return parts.join("|");
}

async function renderQrInto(canvas, text) {
  await QRCode.toCanvas(canvas, text, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6
  });
}

function formatAjvErrors(errors) {
  if (!errors?.length) return "";
  return errors
    .map((err) => {
      const path = err.instancePath ? err.instancePath.slice(1) : "(root)";
      return `• ${path} ${err.message}`;
    })
    .join("\n");
}

function applyOptionalFields(root, ctx) {
  root.querySelectorAll("[data-optional]").forEach((el) => {
    const path = el.dataset.optional;
    const value = getValue(ctx, path);
    if (value === undefined || value === null || value === "") {
      el.remove();
    }
  });
}

function applyVisibility(root, showIps) {
  root.querySelectorAll("[data-show]").forEach((el) => {
    if (el.dataset.show === "ips") {
      if (!showIps) el.remove();
    }
  });
  root.querySelectorAll("[data-hide]").forEach((el) => {
    if (el.dataset.hide === "ips") {
      if (showIps) el.remove();
    }
  });
  root.querySelectorAll("[data-class-if-no-ips]").forEach((el) => {
    if (!showIps) el.classList.add(el.dataset.classIfNoIps);
  });
}

function fillFields(root, ctx) {
  root.querySelectorAll("[data-field]").forEach((el) => {
    const path = el.dataset.field;
    const value = getValue(ctx, path);
    if (value !== undefined && value !== null) {
      setText(el, value);
    }
  });
}

function renderAddressLines(root, ctx, path) {
  const container = root.querySelector(`[data-list="${path}"]`);
  if (!container) return;
  const template = container.querySelector("template");
  if (!template) return;
  const list = getValue(ctx, path) || [];
  container.innerHTML = "";
  list.forEach((value) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelectorAll("[data-field]").forEach((el) => {
      setText(el, value);
    });
    container.appendChild(fragment);
  });
}

function renderLineItems(root, items, ccy) {
  const container = root.querySelector('[data-list="line_items"]');
  if (!container) return;
  const template = container.querySelector("template");
  container.innerHTML = "";
  if (!items?.length) {
    container.innerHTML = `<tr><td colspan="5" class="muted">No line items.</td></tr>`;
    return;
  }
  items.forEach((it, idx) => {
    const fragment = template.content.cloneNode(true);
    const lt = lineTotal(it);
    const ctx = {
      index: idx + 1,
      description: it.description || "",
      qty: it.qty ?? "",
      unit: it.unit || "",
      unit_price: money(it.unit_price, ccy),
      amount: money(lt.base, ccy)
    };
    fragment.querySelectorAll("[data-field]").forEach((el) => {
      const value = ctx[el.dataset.field];
      setText(el, value);
    });
    container.appendChild(fragment);
  });
}

async function render(docRaw) {
  const doc = deepMerge(DEFAULTS, docRaw);

  document.documentElement.style.setProperty("--accent", doc.branding?.accent || "#8b1e1e");

  const ccy = (doc.invoice?.currency || "EUR").toUpperCase();
  if (!doc.invoice?.number) {
    doc.invoice = { ...doc.invoice, number: defaultInvoiceNumber() };
  }
  const totals = computeTotals(doc);
  const accountNo = pickAccountNo(doc);
  const showIps = ccy === "RSD";
  const ipsString = showIps ? buildIpsString(doc, totals) : "";
  const sellerTax = orgIdDisplay(doc.seller?.tax_id, "PIB", "Tax ID", ccy);
  const sellerRegistration = orgIdDisplay(doc.seller?.registration_id, "MB", "Registration ID", ccy);
  const buyerTax = orgIdDisplay(doc.buyer?.tax_id, "PIB", "Tax ID", ccy);

  const ctx = {
    ...doc,
    invoice: {
      ...doc.invoice,
      currency: ccy
    },
    computed: {
      account_no: accountNo,
      ips_string: ipsString,
      seller_tax_label: sellerTax.label,
      seller_tax_id: sellerTax.value,
      seller_registration_label: sellerRegistration.label,
      seller_registration_id: sellerRegistration.value,
      buyer_tax_label: buyerTax.label,
      buyer_tax_id: buyerTax.value,
      totals: {
        sub: money(totals.sub, ccy),
        discount_display: totals.discount ? `-${money(totals.discount, ccy)}` : "",
        shipping: totals.shipping ? money(totals.shipping, ccy) : "",
        tax_display: !doc.totals?.tax_included && totals.tax ? money(totals.tax, ccy) : "",
        grand: money(totals.grand, ccy)
      }
    }
  };

  const sheet = $("sheet");
  sheet.innerHTML = await loadTemplate();

  const logoBox = sheet.querySelector("[data-logo]");
  const logoImg = sheet.querySelector("[data-logo-img]");
  if (doc.branding?.logo_path) {
    logoImg.src = doc.branding.logo_path;
    logoImg.alt = "Euclidean Logo";
    logoBox.style.display = "";
  } else {
    logoBox.innerHTML = `<span style="font-weight:900;color:var(--accent)">E</span>`;
  }

  fillFields(sheet, ctx);
  renderAddressLines(sheet, ctx, "seller.address_lines");
  renderAddressLines(sheet, ctx, "buyer.address_lines");
  renderLineItems(sheet, doc.line_items || [], ccy);
  applyOptionalFields(sheet, ctx);
  applyVisibility(sheet, showIps);

  if (showIps) {
    const canvas = document.getElementById("ipsQr");
    try {
      await renderQrInto(canvas, ipsString);
    } catch (e) {
      const err = document.createElement("div");
      err.className = "small";
      err.style.color = "#b00020";
      err.textContent = "QR generation failed: " + (e?.message || e);
      canvas.parentElement.replaceWith(err);
    }
  }
}

function loadSample() {
  const sample = {
    invoice: {
      number: defaultInvoiceNumber(),
      issue_date: "2026-02-04",
      due_date: "2026-02-18",
      currency: "RSD",
      notes: "Thank you for your business."
    },
    buyer: {
      company_name: "Client Company Ltd",
      address_lines: ["Some Street 12", "11000 Belgrade", "Serbia"],
      tax_id: "",
      contact_name: "Someone",
      email: "ap@client.com"
    },
    line_items: [
      { description: "Game Development Services (Feb 2026)", qty: 1, unit: "Lot", unit_price: 300000, tax_rate: 0 }
    ],
    totals: { discount: 0, shipping: 0, tax_included: false },
    ips: {
      sf: "221",
      s: "Usluge 3D dizajna i proizvodnje"
    }
  };

  $("json").value = JSON.stringify(sample, null, 2);
  render(sample);
}

function safeParseJson() {
  $("err").textContent = "";
  try {
    const parsed = JSON.parse($("json").value);
    const valid = validateSchema(parsed);
    if (!valid) {
      $("err").textContent = `Schema validation failed:\n${formatAjvErrors(validateSchema.errors)}`;
      return null;
    }
    return parsed;
  } catch (e) {
    $("err").textContent = "Invalid JSON: " + String(e?.message || e);
    return null;
  }
}

async function importJsonFile(file) {
  $("err").textContent = "";
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const valid = validateSchema(parsed);
    if (!valid) {
      $("err").textContent = `Could not import ${file.name}: schema validation failed:\n${formatAjvErrors(validateSchema.errors)}`;
      return;
    }
    $("json").value = JSON.stringify(parsed, null, 2);
    await render(parsed);
  } catch (e) {
    $("err").textContent = `Could not import ${file.name}: ${String(e?.message || e)}`;
  } finally {
    $("importFile").value = "";
  }
}

$("renderBtn").addEventListener("click", async () => {
  const obj = safeParseJson();
  if (!obj) return;
  await render(obj);
});

$("sampleBtn").addEventListener("click", loadSample);

$("importBtn")?.addEventListener("click", () => $("importFile").click());

$("importFile")?.addEventListener("change", async (event) => {
  await importJsonFile(event.target.files?.[0]);
});

$("pdfBtn").addEventListener("click", async () => {
  const obj = safeParseJson();
  if (!obj) return;

  await render(obj);

  await new Promise((r) => setTimeout(r, 120));
  window.print();
});

loadSample();
