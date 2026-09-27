/* =====================================================================
   03-domain.js — business model, presets, costing, cart, checkout, void,
   reports, migration, backup validation, plan/licence, PIN.
   No DOM access here except toast()/render() calls at the edges.
   ===================================================================== */

/* ---------- Business types & terminology ---------- */
const BIZ = {
  coffee: { label: "Kedai Kopi / Minuman", em: "☕", hint: "Resep, HPP otomatis, stok bahan", stock: "Bahan Baku", stockLong: "Bahan Baku & Resep", usage: "Resep", usageHint: "Pemakaian bahan per 1 porsi", cost: "HPP", itemWord: "bahan", model: "recipe" },
  food: { label: "Kuliner / Makanan", em: "🍜", hint: "Resep, HPP otomatis, stok bahan", stock: "Bahan Baku", stockLong: "Bahan Baku & Resep", usage: "Resep", usageHint: "Pemakaian bahan per 1 porsi", cost: "HPP", itemWord: "bahan", model: "recipe" },
  retail: { label: "Toko Kelontong / Retail", em: "🛒", hint: "Stok grosir → jual eceran", stock: "Stok Grosir", stockLong: "Stok Grosir / Kemasan", usage: "Sumber Stok", usageHint: "Isi eceran yang terjual per 1 penjualan", cost: "Harga Modal", itemWord: "barang", model: "stock" },
  service: { label: "Jasa / Laundry / Salon", em: "🧺", hint: "Perlengkapan & biaya modal", stock: "Perlengkapan", stockLong: "Perlengkapan / Bahan", usage: "Pemakaian Bahan", usageHint: "Bahan yang terpakai per 1 layanan", cost: "Biaya Modal", itemWord: "perlengkapan", model: "recipe" },
};
function T() { return BIZ[state.settings.type] || BIZ.coffee; }
const UNITS = ["gram", "kg", "ml", "liter", "pcs", "butir", "sachet", "botol", "lembar", "pack", "porsi", "meter"];
const PACKS = ["karton", "karung", "dus", "pak", "renteng", "bal", "galon", "krat", "lusin", "pcs"];
const METHODS = [["Tunai", "wallet", "Tunai"], ["QRIS", "qr", "QRIS"], ["Transfer", "transfer", "Transfer"], ["Kartu", "card", "Debit/Kredit"]];
function methodLabel(m) { return (METHODS.find(x => x[0] === m) || [m, "", m === "Debit-Kredit" ? "Debit/Kredit" : m])[2]; }
function methodIcon(m) { return (METHODS.find(x => x[0] === m) || [0, "card"])[1]; }

/* ---------- Presets (demo catalogues) ---------- */
const PRESETS = {
  coffee: {
    cats: ["Kopi", "Non-Kopi", "Makanan"],
    items: [
      { id: 1, name: "Biji Kopi Arabika", price: 150000, buyQty: 1000, unit: "gram", stock: 1000, minStock: 200 },
      { id: 2, name: "Susu Fresh Milk", price: 20000, buyQty: 1000, unit: "ml", stock: 6000, minStock: 1000 },
      { id: 3, name: "Gula Aren Cair", price: 45000, buyQty: 1000, unit: "ml", stock: 1000, minStock: 200 },
      { id: 4, name: "Cup + Tutup", price: 15000, buyQty: 50, unit: "pcs", stock: 150, minStock: 30 },
      { id: 5, name: "Bubuk Matcha", price: 120000, buyQty: 500, unit: "gram", stock: 500, minStock: 100 },
      { id: 6, name: "Croissant Beku", price: 90000, buyQty: 10, unit: "pcs", stock: 10, minStock: 4 },
    ],
    optionGroups: [
      { id: "g-size", name: "Ukuran", type: "single", required: true, choices: [{ id: "reg", name: "Regular", price: 0, cost: 0 }, { id: "lg", name: "Large", price: 4000, cost: 0, recipe: [{ itemId: 2, qty: 60 }, { itemId: 1, qty: 6 }] }] },
      { id: "g-sugar", name: "Level gula", type: "single", required: true, choices: [{ id: "normal", name: "Normal", price: 0, cost: 0 }, { id: "less", name: "Less sugar", price: 0, cost: 0 }, { id: "no", name: "Tanpa gula", price: 0, cost: 0 }] },
      { id: "g-ice", name: "Es", type: "single", required: true, choices: [{ id: "normal", name: "Normal ice", price: 0, cost: 0 }, { id: "less", name: "Less ice", price: 0, cost: 0 }, { id: "hot", name: "Panas", price: 0, cost: 0 }] },
      { id: "g-add", name: "Tambahan", type: "multi", required: false, choices: [{ id: "shot", name: "Extra shot", price: 5000, cost: 0, recipe: [{ itemId: 1, qty: 18 }] }, { id: "oat", name: "Oat milk", price: 6000, cost: 3500 }, { id: "boba", name: "Boba", price: 4000, cost: 1200 }] },
    ],
    products: [
      { id: 1, name: "Es Kopi Susu Aren", price: 18000, category: "Kopi", img: "kopi", costMode: "recipe", groups: ["g-size", "g-sugar", "g-add"], recipe: [{ itemId: 1, qty: 18 }, { itemId: 2, qty: 120 }, { itemId: 3, qty: 20 }, { itemId: 4, qty: 1 }] },
      { id: 2, name: "Matcha Latte", price: 22000, category: "Non-Kopi", img: "matcha", costMode: "recipe", groups: ["g-size", "g-sugar", "g-ice", "g-add"], recipe: [{ itemId: 5, qty: 10 }, { itemId: 2, qty: 150 }, { itemId: 4, qty: 1 }] },
      { id: 3, name: "Americano Cold", price: 15000, category: "Kopi", img: "americano", costMode: "recipe", groups: ["g-size", "g-ice", "g-add"], recipe: [{ itemId: 1, qty: 18 }, { itemId: 4, qty: 1 }] },
      { id: 4, name: "Kopi Susu Klasik", price: 16000, category: "Kopi", costMode: "recipe", groups: ["g-size", "g-sugar", "g-ice", "g-add"], recipe: [{ itemId: 1, qty: 15 }, { itemId: 2, qty: 100 }, { itemId: 4, qty: 1 }], extraCost: 300 },
      { id: 5, name: "Butter Croissant", price: 20000, category: "Makanan", costMode: "recipe", recipe: [{ itemId: 6, qty: 1 }], extraCost: 1000 },
      { id: 6, name: "Air Mineral", price: 6000, category: "Non-Kopi", costMode: "manual", manualHpp: 2500 },
    ],
  },
  food: {
    cats: ["Makanan", "Minuman"],
    optionGroups: [
      { id: "g-spicy", name: "Level pedas", type: "single", required: true, choices: [{ id: "0", name: "Tidak pedas", price: 0, cost: 0 }, { id: "1", name: "Sedang", price: 0, cost: 0 }, { id: "2", name: "Pedas", price: 0, cost: 0 }, { id: "3", name: "Extra pedas", price: 1000, cost: 300 }] },
      { id: "g-top", name: "Tambahan", type: "multi", required: false, choices: [{ id: "egg", name: "Telur ceplok", price: 4000, cost: 2200 }, { id: "cheese", name: "Keju", price: 5000, cost: 2800 }, { id: "krupuk", name: "Kerupuk", price: 2000, cost: 700 }] },
    ],
    items: [
      { id: 201, name: "Beras Premium", price: 75000, buyQty: 5000, unit: "gram", stock: 10000, minStock: 2000 },
      { id: 202, name: "Daging Ayam", price: 38000, buyQty: 1000, unit: "gram", stock: 3000, minStock: 1000 },
      { id: 203, name: "Minyak Goreng", price: 18000, buyQty: 1000, unit: "ml", stock: 2000, minStock: 500 },
      { id: 204, name: "Kemasan Box", price: 20000, buyQty: 100, unit: "pcs", stock: 100, minStock: 20 },
    ],
    products: [
      { id: 101, name: "Nasi Goreng Spesial", price: 22000, category: "Makanan", costMode: "recipe", groups: ["g-spicy", "g-top"], recipe: [{ itemId: 201, qty: 200 }, { itemId: 202, qty: 60 }, { itemId: 203, qty: 20 }, { itemId: 204, qty: 1 }], extraCost: 1500 },
      { id: 102, name: "Mie Ayam Bakso", price: 18000, category: "Makanan", costMode: "manual", manualHpp: 8000, groups: ["g-spicy", "g-top"] },
      { id: 103, name: "Es Teh Manis", price: 5000, category: "Minuman", costMode: "manual", manualHpp: 1500 },
    ],
  },
  retail: {
    cats: ["Sembako", "Minuman", "Jajanan"],
    items: [
      { id: 301, name: "Minyak Goreng 1L", price: 180000, buyQty: 12, unit: "pcs", packName: "karton", stock: 60, minStock: 12 },
      { id: 302, name: "Beras Premium", price: 750000, buyQty: 50, unit: "kg", packName: "karung", stock: 100, minStock: 25 },
      { id: 303, name: "Mi Instan Goreng", price: 120000, buyQty: 40, unit: "pcs", packName: "dus", stock: 160, minStock: 40 },
      { id: 304, name: "Teh Botol 350ml", price: 72000, buyQty: 24, unit: "botol", packName: "krat", stock: 48, minStock: 12 },
    ],
    products: [
      { id: 21, name: "Minyak Goreng 1L", price: 17000, category: "Sembako", costMode: "stock", stockItemId: 301, saleUnits: 1 },
      { id: 22, name: "Beras Premium / kg", price: 18000, category: "Sembako", costMode: "stock", stockItemId: 302, saleUnits: 1 },
      { id: 23, name: "Mi Instan Goreng", price: 3500, category: "Jajanan", costMode: "stock", stockItemId: 303, saleUnits: 1 },
      { id: 24, name: "Mi Instan (5 bungkus)", price: 16500, category: "Jajanan", costMode: "stock", stockItemId: 303, saleUnits: 5 },
      { id: 25, name: "Teh Botol 350ml", price: 4500, category: "Minuman", costMode: "stock", stockItemId: 304, saleUnits: 1 },
    ],
  },
  service: {
    cats: ["Laundry", "Salon"],
    optionGroups: [
      { id: "g-svc", name: "Layanan tambahan", type: "multi", required: false, choices: [{ id: "parfum", name: "Parfum premium", price: 2000, cost: 800 }, { id: "kilat", name: "Kilat 6 jam", price: 5000, cost: 1000 }, { id: "lipat", name: "Lipat rapi + plastik", price: 1500, cost: 500, recipe: [{ itemId: 403, qty: 1 }] }] },
    ],
    items: [
      { id: 401, name: "Deterjen Cair", price: 60000, buyQty: 5000, unit: "ml", stock: 5000, minStock: 1000 },
      { id: 402, name: "Pewangi Pakaian", price: 45000, buyQty: 5000, unit: "ml", stock: 5000, minStock: 1000 },
      { id: 403, name: "Plastik Laundry", price: 25000, buyQty: 100, unit: "pcs", stock: 100, minStock: 20 },
    ],
    products: [
      { id: 31, name: "Cuci Kiloan / kg", price: 8000, category: "Laundry", costMode: "recipe", groups: ["g-svc"], recipe: [{ itemId: 401, qty: 40 }, { itemId: 402, qty: 20 }], extraCost: 1200 },
      { id: 32, name: "Cuci Express / kg", price: 12000, category: "Laundry", costMode: "recipe", recipe: [{ itemId: 401, qty: 40 }, { itemId: 402, qty: 25 }, { itemId: 403, qty: 1 }], extraCost: 2000 },
      { id: 33, name: "Potong Rambut", price: 25000, category: "Salon", costMode: "manual", manualHpp: 7000 },
    ],
  },
};

/* ---------- Default state ---------- */
function defaultSettings(type = "coffee") {
  return {
    storeName: "", ownerName: "", address: "", phone: "", footer: "Terima kasih, sampai jumpa lagi!",
    type, logoId: null,
    methods: { Tunai: true, QRIS: true, Transfer: true, Kartu: true },
    qrisImageId: null, transferInfo: "",
    taxBp: 0, taxLabel: "Pajak", serviceBp: 0,
    stockEnabled: true, blockOversell: false, askCustomer: true,
    paper: "58", sound: true, haptic: true,
    pinHash: null, pinSalt: null, lockOnOpen: false, staffMode: false,
    license: null,
    roundingStep: 0,            // 0 | 100 | 500 | 1000 — total dibulatkan ke BAWAH (menguntungkan pelanggan)
    dailyTarget: 0,             // target omzet harian (Rp), 0 = tidak ada
    stamp: { enabled: false, minSpend: 15000, target: 10, reward: 20000 }, // kartu stamp digital
    promos: [],                 // promo otomatis (happy hour): {id,name,bp,days[],from,to,cats[],active}
    theme: "auto",              // auto | light | dark
  };
}
function emptyCart() { return { lines: [], discount: null, customer: "", customerId: null, redeem: false }; }
function defaultMeta() {
  return { schema: APP.schema, installId: uid("i-"), firstRun: new Date().toISOString(), trialStart: null, seq: { day: "", n: 0 }, lastBackupAt: null, lastSeen: new Date().toISOString(), migratedFrom: null, notices: [] };
}
function uiDefaults() {
  return { tab: "pos", cat: "Semua", search: "", catalogTab: "produk", catSearch: "", period: "today", histLimit: 40, owner: true, locked: false, modal: null, dialog: null, onb: { step: 1, name: "", type: "coffee", demo: true, owner: "" } };
}
var state = { ready: false, settings: defaultSettings(), catalog: { cats: [], products: [], items: [], optionGroups: [] }, cart: emptyCart(), held: [], meta: defaultMeta(), images: new Map(), ui: uiDefaults(), toast: null, storageError: null, report: null, lic: { tier: "FREE" }, customers: [], shift: null };

function buildCatalogFromPreset(type, withDemo = true) {
  const p = PRESETS[type] || PRESETS.coffee;
  if (!withDemo) return { cats: [...p.cats], products: [], items: [], optionGroups: [] };
  return sanitizeCatalog({
    cats: [...p.cats], optionGroups: deepCopy(p.optionGroups || []),
    items: p.items.map(x => ({ ...x })),
    products: p.products.map(x => ({ ...x, imageId: x.img ? "demo-" + x.img : null, recipe: (x.recipe || []).map(r => ({ ...r })) })),
  });
}

/* ---------- Sanitisers (used for presets, migration, restore) ---------- */
function num(v, def = 0) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function sanitizeItem(x) {
  const q = normQty(x.buyQty);
  return {
    id: Math.trunc(num(x.id)), name: cleanText(x.name, 60) || "Tanpa nama",
    price: Math.max(0, money(x.price)), buyQty: q && q > 0 ? q : 1,
    unit: cleanText(x.unit, 16) || "pcs", packName: x.packName ? cleanText(x.packName, 16) : "",
    stock: x.stock === null || x.stock === undefined || x.stock === "" ? null : (normQty(x.stock) ?? null),
    minStock: x.minStock === null || x.minStock === undefined || x.minStock === "" ? null : (normQty(x.minStock) ?? null),
  };
}
function sanitizeProduct(x, itemIds) {
  const mode = ["recipe", "manual", "stock"].includes(x.costMode) ? x.costMode : ((x.recipe || []).length ? "recipe" : "manual");
  const recipe = (Array.isArray(x.recipe) ? x.recipe : []).map(r => ({ itemId: Math.trunc(num(r.itemId ?? r.ingredientId)), qty: normQty(r.qty) })).filter(r => itemIds.has(r.itemId) && r.qty && r.qty > 0);
  const su = normQty(x.saleUnits);
  return {
    id: Math.trunc(num(x.id)), name: cleanText(x.name, 60) || "Produk", price: Math.max(0, money(x.price)),
    category: cleanText(x.category, 30) || "Lainnya", imageId: typeof x.imageId === "string" ? x.imageId.slice(0, 64) : null,
    costMode: mode, manualHpp: Math.max(0, money(x.manualHpp)), recipe, extraCost: Math.max(0, money(x.extraCost)),
    stockItemId: x.stockItemId != null && itemIds.has(Math.trunc(num(x.stockItemId))) ? Math.trunc(num(x.stockItemId)) : null,
    saleUnits: su && su > 0 ? su : 1, active: x.active !== false, fav: !!x.fav,
    groups: (Array.isArray(x.groups) ? x.groups : []).map(g => String(g).slice(0, 24)).filter((g, i, a) => g && a.indexOf(g) === i).slice(0, 8),
    barcode: String(x.barcode ?? "").replace(/[^0-9A-Za-z\-]/g, "").slice(0, 32),
  };
}
/** option group = "Ukuran", "Level gula", "Topping". Choices carry price & cost deltas and optional extra recipe. */
function sanitizeGroup(g, itemIds) {
  const choices = (Array.isArray(g?.choices) ? g.choices : []).slice(0, 12).map((c, i) => ({
    id: String(c.id || ("c" + i + uid().slice(0, 4))).slice(0, 24), name: cleanText(c.name, 30) || "Pilihan",
    price: clamp(money(c.price), -10000000, 10000000), cost: clamp(money(c.cost), -10000000, 10000000),
    recipe: (Array.isArray(c.recipe) ? c.recipe : []).map(r => ({ itemId: Math.trunc(num(r.itemId)), qty: normQty(r.qty) })).filter(r => itemIds.has(r.itemId) && r.qty && r.qty > 0).slice(0, 6),
  }));
  return { id: String(g?.id || uid("g")).slice(0, 24), name: cleanText(g?.name, 30) || "Pilihan", type: g?.type === "multi" ? "multi" : "single", required: g?.type === "multi" ? false : g?.required !== false, choices };
}
function sanitizeCatalog(c) {
  const items = []; const seenI = new Set();
  for (const raw of (Array.isArray(c?.items) ? c.items : [])) { const it = sanitizeItem(raw); if (!it.id || seenI.has(it.id)) it.id = nextId(items.concat([{ id: Math.max(0, ...seenI) }])); seenI.add(it.id); items.push(it); }
  const ids = new Set(items.map(i => i.id));
  const products = []; const seenP = new Set();
  for (const raw of (Array.isArray(c?.products) ? c.products : [])) { const p = sanitizeProduct(raw, ids); if (!p.id || seenP.has(p.id)) p.id = Math.max(0, ...seenP) + 1; seenP.add(p.id); products.push(p); }
  let cats = (Array.isArray(c?.cats) ? c.cats : []).map(x => cleanText(x, 30)).filter(x => x && x !== "Semua");
  for (const p of products) if (!cats.includes(p.category)) cats.push(p.category);
  cats = [...new Set(cats)];
  const optionGroups = (Array.isArray(c?.optionGroups) ? c.optionGroups : []).slice(0, 40).map(g => sanitizeGroup(g, ids)).filter(g => g.choices.length);
  const gids = new Set(optionGroups.map(g => g.id));
  for (const p of products) p.groups = p.groups.filter(g => gids.has(g));
  return { cats, products, items, optionGroups };
}

/* ---------- Costing (exact) ---------- */
function findItem(id) { return state.catalog.items.find(i => i.id === id); }
function findProduct(id) { return state.catalog.products.find(p => p.id === id); }
/** cost of `qty` base units of item as rational */
function itemCostR(item, qty) {
  const q = toScaled(qty), b = toScaled(item?.buyQty);
  if (!item || q === null || b === null || b <= 0n) return R0();
  return { n: BigInt(money(item.price)) * q, d: b };
}
/** unit HPP of one product sale as rational */
function productHppR(p, items = state.catalog.items) {
  if (!p) return R0();
  const byId = id => items.find(i => i.id === id);
  if (p.costMode === "manual") return { n: BigInt(money(p.manualHpp)), d: 1n };
  if (p.costMode === "stock") { const it = byId(p.stockItemId); return it ? rAdd(itemCostR(it, p.saleUnits), { n: BigInt(money(p.extraCost)), d: 1n }) : R0(); }
  let r = R0();
  for (const line of p.recipe || []) { const it = byId(line.itemId); if (it) r = rAdd(r, itemCostR(it, line.qty)); }
  return rAdd(r, { n: BigInt(money(p.extraCost)), d: 1n });
}
function productHpp(p, items) { return rRound(productHppR(p, items)); }
function marginInfo(price, hpp) {
  price = money(price); hpp = money(hpp);
  const profit = price - hpp, pct = price > 0 ? Math.round(profit / price * 100) : 0;
  const level = price <= 0 ? "muted" : pct >= 50 ? "good" : pct >= 30 ? "mid" : "bad";
  return { profit, pct, level };
}
/** suggested price for a target margin (%) rounded up to Rp500 */
function suggestPrice(hpp, marginPct) { if (!(hpp > 0) || !(marginPct > 0 && marginPct < 95)) return 0; return Math.ceil(hpp / (1 - marginPct / 100) / 500) * 500; }
/* ---------- Options (varian & tambahan) ---------- */
function findGroup(id, catalog = state.catalog) { return (catalog.optionGroups || []).find(g => g.id === id); }
/** resolve a cart line's selected options against the product's attached groups (invalid picks are dropped) */
function lineChoices(line, p, catalog = state.catalog) {
  const out = [];
  for (const o of line.opts || []) {
    if (!(p.groups || []).includes(o.g)) continue;
    const g = findGroup(o.g, catalog); const c = g?.choices.find(x => x.id === o.c);
    if (g && c) out.push({ g, c });
  }
  return out;
}
function optionsLabel(ch) { return ch.map(x => x.c.name).join(", "); }
function optsKey(opts) { return (opts || []).map(o => o.g + ":" + o.c).sort().join("|"); }
/** unit HPP of a choice (manual cost + extra recipe) as rational */
function choiceCostR(c, items) {
  let r = { n: BigInt(money(c.cost)), d: 1n };
  for (const x of c.recipe || []) { const it = items.find(i => i.id === x.itemId); if (it) r = rAdd(r, itemCostR(it, x.qty)); }
  return r;
}
function choiceNeeds(c, qtyS, out) {
  for (const x of c.recipe || []) { const s = toScaled(x.qty); if (s === null || s <= 0n) continue; out.set(x.itemId, (out.get(x.itemId) || 0n) + s * qtyS / SCALE); }
  return out;
}
/** stock needs (itemId -> scaled BigInt) for a product sold qtyScaled times */
function productNeeds(p, qtyS, out = new Map()) {
  const add = (id, q) => { const s = toScaled(q); if (s === null || s <= 0n) return; out.set(id, (out.get(id) || 0n) + s * qtyS / SCALE); };
  if (p.costMode === "stock" && p.stockItemId) add(p.stockItemId, p.saleUnits);
  else if (p.costMode === "recipe") for (const r of p.recipe || []) add(r.itemId, r.qty);
  return out;
}
function itemStatus(it) {
  if (it.stock === null || it.stock === undefined) return "untracked";
  if (it.stock <= 0) return "out";
  if (it.minStock !== null && it.minStock !== undefined && it.stock <= it.minStock) return "low";
  return "ok";
}
function stockEnabled() { return isPro() && state.settings.stockEnabled !== false; }
function lowStockItems() { return stockEnabled() ? state.catalog.items.filter(i => ["low", "out"].includes(itemStatus(i))) : []; }
/** how many portions of product can still be made from tracked stock (Infinity if untracked) */
function portionsLeft(p) {
  if (!stockEnabled()) return Infinity;
  const needs = productNeeds(p, SCALE);
  let min = Infinity;
  for (const [id, need] of needs) {
    const it = findItem(id); if (!it || it.stock === null) continue;
    const have = toScaled(it.stock) ?? 0n;
    const n = need > 0n ? Number(have > 0n ? have / need : 0n) : Infinity;
    min = Math.min(min, n);
  }
  return min;
}
function fmtStock(it, value = it.stock) {
  if (value === null || value === undefined) return "Tidak dilacak";
  if (it.packName && it.buyQty > 1) {
    const s = toScaled(value) ?? 0n, pack = toScaled(it.buyQty);
    const neg = s < 0n, a = neg ? -s : s;
    const full = a / pack, rest = a % pack;
    const txt = `${full > 0n ? String(full) + " " + it.packName : ""}${full > 0n && rest > 0n ? " + " : ""}${rest > 0n || full === 0n ? fmtQty(scaledToNumber(rest)) + " " + it.unit : ""}`;
    return (neg ? "−" : "") + txt;
  }
  return `${fmtQty(value)} ${it.unit}`;
}

/* ---------- Cart & totals ---------- */
function cartQtyOf(pid) { const l = state.cart.lines.find(x => x.pid === pid && !x.note); return l ? l.qty : 0; }
function cartQtyAll(pid) { return state.cart.lines.filter(x => x.pid === pid).reduce((a, l) => a + Number(l.qty), 0); }
/* ---------- Promo otomatis (happy hour) ---------- */
function hhmm(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
function sanitizePromo(p) {
  const t = v => /^\d{2}:\d{2}$/.test(v) ? v : null;
  return { id: String(p?.id || uid("p")).slice(0, 20), name: cleanText(p?.name, 30) || "Promo", bp: clamp(money(p?.bp), 0, 9000), days: (Array.isArray(p?.days) ? p.days : []).map(Number).filter(d => d >= 0 && d <= 6).filter((d, i, a) => a.indexOf(d) === i), from: t(p?.from) || "14:00", to: t(p?.to) || "16:00", cats: (Array.isArray(p?.cats) ? p.cats : []).map(c => cleanText(c, 30)).filter(Boolean).slice(0, 20), active: p?.active !== false };
}
/** promos running at `now` (days empty = every day; from>to spans midnight) */
function activePromos(settings = state.settings, now = new Date()) {
  const d = now.getDay(), t = hhmm(now);
  return (settings.promos || []).filter(p => p.active && p.bp > 0 && (!p.days.length || p.days.includes(d)) && (p.from <= p.to ? t >= p.from && t < p.to : t >= p.from || t < p.to));
}
function computeTotals(cart = state.cart, catalog = state.catalog, settings = state.settings, customers = state.customers, now = new Date()) {
  const lines = []; let subtotal = 0, hpp = 0, count = 0; const invalid = [];
  for (const l of cart.lines) {
    const p = catalog.products.find(x => x.id === l.pid);
    const qS = toScaled(l.qty);
    if (!p || qS === null || qS <= 0n) { invalid.push(l); continue; }
    const ch = lineChoices(l, p, catalog);
    const unitPrice = Math.max(0, money(p.price) + ch.reduce((a, x) => a + money(x.c.price), 0));
    let hR = productHppR(p, catalog.items);
    for (const x of ch) hR = rAdd(hR, choiceCostR(x.c, catalog.items));
    const lineTotal = rRound({ n: BigInt(unitPrice) * qS, d: SCALE });
    const lineHpp = Math.max(0, rRound(rMulScaled(hR, qS)));
    subtotal += lineTotal; hpp += lineHpp; count += scaledToNumber(qS);
    lines.push({ line: l, p, qS, ch, unitPrice, lineTotal, unitHpp: Math.max(0, rRound(hR)), lineHpp });
  }
  // best single automatic promo (only when PRO; settings may still hold promos after trial)
  let promo = 0, promoInfo = null;
  if (isPro()) for (const pr of activePromos(settings, now)) {
    const elig = lines.filter(x => !pr.cats.length || pr.cats.includes(x.p.category)).reduce((a, x) => a + x.lineTotal, 0);
    const amt = bpApply(elig, pr.bp);
    if (amt > promo) { promo = amt; promoInfo = { id: pr.id, name: pr.name, bp: pr.bp, amount: amt }; }
  }
  const afterPromo = subtotal - promo;
  let discount = 0; const d = cart.discount;
  if (d && d.value > 0) discount = d.type === "pct" ? bpApply(afterPromo, clamp(d.value, 0, 10000)) : Math.min(money(d.value), afterPromo);
  // stamp reward (kartu stamp digital)
  let reward = 0; const st = settings.stamp || {};
  if (cart.redeem && st.enabled && cart.customerId) {
    const cu = (customers || []).find(c => c.id === cart.customerId);
    if (cu && cu.stamps >= st.target) reward = Math.min(money(st.reward), afterPromo - discount);
  }
  const base = afterPromo - discount - reward;
  const service = bpApply(base, settings.serviceBp || 0);
  const tax = bpApply(base + service, settings.taxBp || 0);
  const gross = base + service + tax;
  const step = [100, 500, 1000].includes(settings.roundingStep) ? settings.roundingStep : 0;
  const rounding = step ? gross % step : 0; // rounded DOWN → customer-friendly
  const total = gross - rounding;
  return { lines, invalid, subtotal, promo, promoInfo, discount, reward, service, tax, rounding, total, hpp, profit: base + service - rounding - hpp, count: Number(count.toFixed(6)) };
}
/** does this purchase earn a stamp? */
function stampEarned(total, settings = state.settings) { const st = settings.stamp || {}; return st.enabled && total >= money(st.minSpend) ? 1 : 0; }

/* ---------- Checkout (atomic) ---------- */
let checkoutBusy = false;
async function checkout(pay) {
  if (checkoutBusy) return { ok: false, msg: "Sedang memproses…" };
  checkoutBusy = true;
  try {
    const tot = computeTotals();
    if (!tot.lines.length) return { ok: false, msg: "Keranjang masih kosong." };
    if (tot.invalid.length) return { ok: false, msg: "Ada produk di keranjang yang sudah dihapus. Periksa keranjang." };
    const method = METHODS.some(m => m[0] === pay.method) ? pay.method : "Tunai";
    const cash = method === "Tunai" ? money(pay.cash) : tot.total;
    if (method === "Tunai" && cash < tot.total) return { ok: false, msg: "Uang diterima belum cukup." };

    // stock needs
    const needs = new Map();
    if (stockEnabled()) for (const x of tot.lines) { productNeeds(x.p, x.qS, needs); for (const c of x.ch) choiceNeeds(c.c, x.qS, needs); }
    const moves = [];
    for (const [id, need] of needs) {
      const it = findItem(id); if (!it || it.stock === null) continue;
      const have = toScaled(it.stock) ?? 0n;
      if (state.settings.blockOversell && have < need) return { ok: false, msg: `Stok ${it.name} tidak cukup (tersisa ${fmtStock(it)}, perlu ${fmtStock(it, scaledToNumber(need))}).` };
      moves.push({ itemId: id, qty: scaledToNumber(need), after: scaledToNumber(have - need) });
    }
    const now = new Date(), day = dayKey(now);
    const seq = state.meta.seq?.day === day ? state.meta.seq.n + 1 : 1;
    const s = state.settings;
    const tx = {
      id: `TRX-${day.replace(/-/g, "")}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}-${uid().slice(0, 5).toUpperCase()}`,
      no: seq, day, date: now.toISOString(),
      store: { name: s.storeName, address: s.address, phone: s.phone, footer: s.footer },
      items: tot.lines.map(x => ({ pid: x.p.id, name: x.p.name, price: x.unitPrice, qty: scaledToNumber(x.qS), lineTotal: x.lineTotal, hpp: x.unitHpp, hppTotal: x.lineHpp, note: x.line.note || "", opts: optionsLabel(x.ch), optIds: x.ch.map(c => c.g.id + ":" + c.c.id), cat: x.p.category })),
      subtotal: tot.subtotal, discount: tot.discount ? { ...state.cart.discount, amount: tot.discount } : null,
      service: tot.service, serviceBp: s.serviceBp || 0, tax: tot.tax, taxBp: s.taxBp || 0, taxLabel: s.taxLabel || "Pajak",
      reward: tot.reward, rounding: tot.rounding, shiftId: state.shift?.id || null, promo: tot.promoInfo,
      total: tot.total, totalHpp: tot.hpp, profit: tot.profit,
      method, cash, change: Math.max(0, cash - tot.total), customer: cleanText(state.cart.customer, 40),
      status: "paid", stockMoves: moves.map(m => ({ itemId: m.itemId, qty: m.qty })), by: state.settings.staffMode && !state.ui.owner ? "kasir" : "pemilik",
    };
    const catalog = deepCopy(state.catalog);
    for (const m of moves) { const it = catalog.items.find(i => i.id === m.itemId); if (it) it.stock = m.after; }
    const logs = moves.map(m => ({ itemId: m.itemId, delta: -m.qty, reason: "sale", ref: tx.id, at: tx.date }));
    const meta = { ...state.meta, seq: { day, n: seq }, lastSeen: tx.date, hasSales: true };
    if (!meta.trialStart) meta.trialStart = tx.date; // trial clock starts at first real sale
    const held = state.cart.heldId ? state.held.filter(h => h.id !== state.cart.heldId) : state.held;
    // customer & stamp card
    let customers = state.customers;
    if (state.cart.customerId) {
      customers = deepCopy(state.customers);
      const cu = customers.find(c => c.id === state.cart.customerId);
      if (cu) {
        const used = tot.reward > 0 ? money(s.stamp.target) : 0, earned = stampEarned(tot.total);
        cu.stamps = Math.max(0, (cu.stamps || 0) - used + earned); cu.visits = (cu.visits || 0) + 1; cu.spent = money(cu.spent) + tot.total; cu.lastAt = tx.date;
        tx.cust = { id: cu.id, name: cu.name, phone: cu.phone, earned, used, stamps: cu.stamps, target: s.stamp?.enabled ? money(s.stamp.target) : 0 };
        if (!tx.customer) tx.customer = cu.name;
      }
    }
    // daily target crossing (for celebration)
    const target = money(s.dailyTarget);
    const before = await todaySales();
    await DB.commit({ tx, catalog, logs, kv: { meta, cart: emptyCart(), held, customers } });
    // only after durable write:
    state.catalog = catalog; state.meta = meta; state.cart = emptyCart(); state.held = held; state.customers = customers;
    state.todaySales = before + tx.total;
    tx._targetHit = !!(target && before < target && before + tx.total >= target);
    state.report = null;
    requestPersistentStorage();
    return { ok: true, tx };
  } catch (e) {
    reportStorageError(e);
    return { ok: false, msg: "Transaksi GAGAL disimpan. Keranjang tidak dihapus — coba lagi." };
  } finally { checkoutBusy = false; }
}

async function voidTx(tx, reason) {
  if (!tx || tx.status === "void") return { ok: false, msg: "Transaksi sudah dibatalkan." };
  const upd = { ...tx, status: "void", voidReason: cleanText(reason, 120), voidAt: new Date().toISOString() };
  const catalog = deepCopy(state.catalog); const logs = [];
  for (const m of tx.stockMoves || []) {
    const it = catalog.items.find(i => i.id === m.itemId);
    if (it && it.stock !== null) { it.stock = scaledToNumber((toScaled(it.stock) ?? 0n) + (toScaled(m.qty) ?? 0n)); logs.push({ itemId: m.itemId, delta: m.qty, reason: "void", ref: tx.id, at: upd.voidAt }); }
  }
  let customers = state.customers;
  if (tx.cust?.id) {
    customers = deepCopy(state.customers); const cu = customers.find(c => c.id === tx.cust.id);
    if (cu) { cu.stamps = Math.max(0, (cu.stamps || 0) - (tx.cust.earned || 0) + (tx.cust.used || 0)); cu.visits = Math.max(0, (cu.visits || 0) - 1); cu.spent = Math.max(0, money(cu.spent) - money(tx.total)); }
  }
  try { await DB.commit({ tx: upd, catalog, logs, kv: { customers } }); state.catalog = catalog; state.customers = customers; state.report = null; state.todaySales = null; return { ok: true, tx: upd }; }
  catch (e) { reportStorageError(e); return { ok: false, msg: "Gagal membatalkan transaksi." }; }
}

async function adjustStock(itemId, delta, reason, newPrice = null, newBuyQty = null) {
  const catalog = deepCopy(state.catalog);
  const it = catalog.items.find(i => i.id === itemId); if (!it) return false;
  const cur = toScaled(it.stock ?? 0) ?? 0n, d = toScaled(delta) ?? 0n;
  it.stock = scaledToNumber(cur + d);
  if (newPrice !== null && newBuyQty) { it.price = money(newPrice); it.buyQty = newBuyQty; }
  try { await DB.commit({ catalog, logs: [{ itemId, delta: scaledToNumber(d), reason, at: new Date().toISOString() }] }); state.catalog = catalog; return true; }
  catch (e) { reportStorageError(e); return false; }
}

/* ---------- Reports ---------- */
const PERIODS = [
  { id: "today", label: "Hari ini", pro: false },
  { id: "yesterday", label: "Kemarin", pro: false },
  { id: "7d", label: "7 hari", pro: false },
  { id: "30d", label: "30 hari", pro: true },
  { id: "month", label: "Bulan ini", pro: true },
  { id: "lastmonth", label: "Bulan lalu", pro: true },
];
function periodRange(id) {
  const t = dayKey();
  const d = new Date();
  if (id === "yesterday") { const y = addDays(t, -1); return [y, y]; }
  if (id === "7d") return [addDays(t, -6), t];
  if (id === "30d") return [addDays(t, -29), t];
  if (id === "month") return [dayKey(new Date(d.getFullYear(), d.getMonth(), 1)), t];
  if (id === "lastmonth") return [dayKey(new Date(d.getFullYear(), d.getMonth() - 1, 1)), dayKey(new Date(d.getFullYear(), d.getMonth(), 0))];
  return [t, t];
}
function summarize(txs, from, to) {
  const paid = txs.filter(t => t.status !== "void");
  const r = { from, to, txs: txs.slice().sort((a, b) => b.date.localeCompare(a.date)), count: paid.length, voids: txs.length - paid.length,
    sales: 0, net: 0, tax: 0, hpp: 0, profit: 0, discount: 0, byMethod: {}, top: [], hours: Array(24).fill(0), days: [] };
  const prod = new Map(); const dayMap = new Map();
  for (const t of paid) {
    r.sales += money(t.total); r.tax += money(t.tax); r.hpp += money(t.totalHpp); r.profit += money(t.profit); r.discount += money(t.discount?.amount) + money(t.reward) + money(t.rounding) + money(t.promo?.amount);
    r.byMethod[t.method] = (r.byMethod[t.method] || 0) + money(t.total);
    r.hours[new Date(t.date).getHours()] += money(t.total);
    dayMap.set(t.day, (dayMap.get(t.day) || 0) + money(t.total));
    for (const i of t.items || []) {
      const k = i.pid + "|" + i.name; const e = prod.get(k) || { name: i.name, qty: 0, revenue: 0, profit: 0 };
      e.qty += Number(i.qty) || 0; e.revenue += money(i.lineTotal ?? i.price * i.qty); e.profit += money(i.lineTotal ?? i.price * i.qty) - money(i.hppTotal ?? i.hpp * i.qty);
      prod.set(k, e);
    }
  }
  r.net = r.sales - r.tax;
  r.margin = r.net > 0 ? Math.round(r.profit / r.net * 100) : 0;
  r.avg = r.count ? Math.round(r.sales / r.count) : 0;
  r.top = [...prod.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 8);
  for (let k = from; k <= to; k = addDays(k, 1)) { r.days.push({ day: k, v: dayMap.get(k) || 0 }); if (r.days.length > 62) break; }
  return r;
}
async function todaySales() {
  if (typeof state.todaySales === "number" && state.todaySalesDay === dayKey()) return state.todaySales;
  const k = dayKey(); const txs = await DB.txRange(k, k);
  state.todaySales = txs.filter(t => t.status !== "void").reduce((a, t) => a + money(t.total), 0); state.todaySalesDay = k;
  return state.todaySales;
}
async function loadReport(force = false) {
  const id = state.ui.period;
  if (!force && state.report && state.report.period === id && state.report.stamp === dayKey()) return state.report;
  const [from, to] = periodRange(id);
  const txs = await DB.txRange(from, to);
  const r = summarize(txs, from, to); r.period = id; r.stamp = dayKey();
  state.report = r; return r;
}

/* ---------- Plan / licence ---------- */
const LICENSE_PUBLIC_JWK = { kty: "EC", crv: "P-256", x: "4g0aUrB-tbBQ48v9stJRvR79sQHX2VCB4Q1l9eT9t7U", y: "tgcnD_Vo3dvCx45_4aZMjctptGzTU3jGJ1Na_jFbsxc" };
function b64urlToBytes(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
async function verifyLicenseKey(key) {
  try {
    key = String(key || "").replace(/\s+/g, "");
    const m = /^NYL1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key);
    if (!m) return { ok: false, msg: "Format kode lisensi tidak dikenali." };
    if (!crypto?.subtle) return { ok: false, msg: "Aktivasi butuh koneksi aman (HTTPS)." };
    const pub = await crypto.subtle.importKey("jwk", LICENSE_PUBLIC_JWK, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64urlToBytes(m[2]), new TextEncoder().encode("NYL1." + m[1]));
    if (!valid) return { ok: false, msg: "Kode lisensi tidak valid." };
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(m[1])));
    if (payload.v !== 1 || payload.p !== "PRO") return { ok: false, msg: "Jenis lisensi tidak didukung versi ini." };
    if (payload.i && APP.revokedOrders.includes(payload.i)) return { ok: false, msg: "Lisensi ini sudah dinonaktifkan penjual." };
    const now = maxSeenDate();
    if (payload.e && dayKey(now) > payload.e) return { ok: false, expired: true, payload, msg: `Lisensi berakhir ${fmtDate(parseDayKey(payload.e))}.` };
    return { ok: true, payload };
  } catch (e) { return { ok: false, msg: "Kode lisensi rusak / tidak lengkap." }; }
}
function maxSeenDate() { const now = new Date(); const seen = state.meta.lastSeen ? new Date(state.meta.lastSeen) : now; return seen > now ? seen : now; } // resists clock roll-back
async function refreshPlan() {
  let lic = { tier: "FREE" };
  if (state.settings.license?.key) {
    const v = await verifyLicenseKey(state.settings.license.key);
    if (v.ok) lic = { tier: "PRO", name: v.payload.n, exp: v.payload.e || null, id: v.payload.i };
    else lic = { tier: "FREE", invalid: v.msg, expired: !!v.expired };
  }
  if (lic.tier === "FREE") {
    const start = state.meta.trialStart ? new Date(state.meta.trialStart) : null;
    if (!start) lic.trialAvailable = true;
    else {
      const left = APP.trialDays - Math.floor((maxSeenDate() - start) / 864e5);
      if (left > 0) { lic.tier = "TRIAL"; lic.daysLeft = left; } else lic.trialEnded = true;
    }
  }
  state.lic = lic; return lic;
}
function isPro() { return state.lic.tier === "PRO" || state.lic.tier === "TRIAL"; }

/* ---------- PIN (PBKDF2-SHA256) ---------- */
async function hashPin(pin, saltB64) {
  if (!crypto?.subtle) throw new Error("PIN butuh koneksi aman (HTTPS).");
  const salt = saltB64 ? b64urlToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  const toB64 = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { hash: toB64(new Uint8Array(bits)), salt: toB64(salt) };
}
async function checkPin(pin) {
  if (!state.settings.pinHash) return true;
  try { const h = await hashPin(pin, state.settings.pinSalt); return h.hash === state.settings.pinHash; } catch (_) { return false; }
}

/* ---------- Migration from V12/V13 (localStorage) ---------- */
function migrateLegacy(raw) {
  const type = PRESETS[raw.type] ? raw.type : "coffee";
  const retail = type === "retail";
  const items = (raw.ingredients || []).map(i => retail ? {
    id: i.id, name: i.name, price: i.price, buyQty: num(i.packSize, 1) || 1, unit: i.contentUnit || "pcs", packName: i.unit || "",
    stock: scaledToNumber((toScaled(i.qty) ?? 0n) * (toScaled(i.packSize || 1) ?? SCALE) / SCALE), minStock: null,
  } : { id: i.id, name: i.name, price: i.price, buyQty: i.buyQty ?? i.qty, unit: i.unit, stock: i.qty, minStock: null });
  const images = {};
  const products = (raw.products || []).map(p => {
    let imageId = null;
    if (typeof p.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p.image)) { imageId = "img-" + p.id; images[imageId] = p.image; }
    const packSize = num((raw.ingredients || []).find(i => i.id === Number(p.stockItemId))?.packSize, 1) || 1;
    return retail && p.stockItemId ? { id: p.id, name: p.name, price: p.price, category: p.category, imageId, costMode: "stock", stockItemId: Number(p.stockItemId), saleUnits: Number((num(p.stockUsageQty, 0) * packSize).toFixed(3)) || 1 }
      : { id: p.id, name: p.name, price: p.price, category: p.category, imageId, costMode: (p.recipe || []).length ? "recipe" : "manual", manualHpp: p.manualHpp, recipe: (p.recipe || []).map(r => ({ itemId: r.ingredientId, qty: r.qty })) };
  });
  const catalog = sanitizeCatalog({ cats: raw.cats, items, products });
  const tx = (raw.transactions || []).filter(t => t && t.id && t.date).map(t => {
    const its = (t.items || []).map(i => ({ pid: i.id, name: cleanText(i.name, 60), price: money(i.price), qty: num(i.qty, 0), lineTotal: roundDiv(money(i.price) * Math.round(num(i.qty) * 1000), 1000), hpp: money(i.hpp), hppTotal: roundDiv(money(i.hpp) * Math.round(num(i.qty) * 1000), 1000), note: "" }));
    return { id: String(t.id), no: null, day: dayKey(t.date), date: new Date(t.date).toISOString(), store: { name: cleanText(t.store || raw.store, 60) }, items: its,
      subtotal: money(t.total), discount: null, service: 0, tax: 0, total: money(t.total), totalHpp: money(t.totalHpp), profit: money(t.netProfit ?? (t.total - t.totalHpp)),
      method: t.method === "Debit-Kredit" ? "Kartu" : cleanText(t.method, 20) || "Tunai", cash: money(t.cashReceived), change: money(t.change), customer: "", status: "paid", stockMoves: [], legacy: true };
  });
  const settings = { ...defaultSettings(type), storeName: cleanText(raw.store, 60) || "Toko Saya" };
  const cart = { ...emptyCart(), lines: (raw.cart || []).map(l => ({ id: uid("l"), pid: l.productId, qty: num(l.qty, 1), note: "" })).filter(l => catalog.products.some(p => p.id === l.pid)) };
  return { settings, catalog, cart, tx, images };
}

/* ---------- Backup ---------- */
async function buildBackup() {
  const [tx, imgKeys, stocklog, exp, shifts] = await Promise.all([DB.all("tx"), DB.allKeys("images"), DB.all("stocklog"), DB.all("exp"), DB.all("shifts")]);
  const images = {}; for (const k of imgKeys) images[k] = await DB.get("images", k);
  return { format: "nyala-backup", schema: APP.schema, app: APP.version, exportedAt: new Date().toISOString(),
    counts: { products: state.catalog.products.length, items: state.catalog.items.length, tx: tx.length },
    kv: { settings: state.settings, catalog: state.catalog, cart: state.cart, held: state.held, meta: state.meta, customers: state.customers, shift: state.shift }, tx, images, stocklog, exp, shifts };
}
/* ---------- Restore sanitisers: every field that reaches the UI gets its proper type (BUG-SEC1) ---------- */
const DAYRE = /^\d{4}-\d{2}-\d{2}$/;
function isoOr(v, def = null) { const d = new Date(v); return typeof v === "string" && !isNaN(d) ? d.toISOString() : def; }
function sanitizeTx(t) {
  const date = isoOr(t.date); if (!date || typeof t.id !== "string") return null;
  const items = (Array.isArray(t.items) ? t.items : []).slice(0, 500).map(i => ({ pid: Math.trunc(num(i.pid)), name: cleanText(i.name, 60), price: money(i.price), qty: normQty(i.qty) ?? 0, lineTotal: money(i.lineTotal ?? money(i.price) * num(i.qty)), hpp: money(i.hpp), hppTotal: money(i.hppTotal ?? money(i.hpp) * num(i.qty)), note: cleanText(i.note, 60), opts: cleanText(i.opts, 120), optIds: Array.isArray(i.optIds) ? i.optIds.map(x => String(x).slice(0, 50)).slice(0, 12) : [], cat: cleanText(i.cat, 30) }));
  const cu = t.cust && typeof t.cust === "object" ? { id: String(t.cust.id || "").slice(0, 24), name: cleanText(t.cust.name, 40), phone: String(t.cust.phone || "").replace(/\D/g, "").slice(0, 15), earned: Math.max(0, money(t.cust.earned)), used: Math.max(0, money(t.cust.used)), stamps: Math.max(0, money(t.cust.stamps)), target: Math.max(0, money(t.cust.target)) } : null;
  const st = t.store && typeof t.store === "object" ? t.store : {};
  const m = METHODS.some(x => x[0] === t.method) ? t.method : "Tunai";
  const disc = t.discount && typeof t.discount === "object" ? { type: t.discount.type === "amt" ? "amt" : "pct", value: money(t.discount.value), amount: money(t.discount.amount) } : null;
  return { id: String(t.id).slice(0, 60), no: t.no == null ? null : Math.max(0, money(t.no)), day: DAYRE.test(t.day) ? t.day : dayKey(date), date,
    store: { name: cleanText(st.name, 60), address: cleanText(st.address, 120), phone: cleanText(st.phone, 30), footer: cleanText(st.footer, 120) },
    items, subtotal: money(t.subtotal ?? t.total), discount: disc, service: money(t.service), serviceBp: money(t.serviceBp), tax: money(t.tax), taxBp: money(t.taxBp), taxLabel: cleanText(t.taxLabel, 20) || "Pajak",
    reward: money(t.reward), rounding: money(t.rounding), promo: t.promo && typeof t.promo === "object" ? { id: String(t.promo.id || "").slice(0, 20), name: cleanText(t.promo.name, 30), bp: money(t.promo.bp), amount: money(t.promo.amount) } : null, shiftId: t.shiftId ? String(t.shiftId).slice(0, 30) : null,
    total: money(t.total), totalHpp: money(t.totalHpp), profit: money(t.profit), method: m, cash: money(t.cash), change: money(t.change), customer: cleanText(t.customer, 40),
    status: t.status === "void" ? "void" : "paid", voidReason: cleanText(t.voidReason, 120), voidAt: isoOr(t.voidAt), stockMoves: (Array.isArray(t.stockMoves) ? t.stockMoves : []).map(x => ({ itemId: Math.trunc(num(x.itemId)), qty: normQty(x.qty) ?? 0 })), by: cleanText(t.by, 12), cust: cu, legacy: !!t.legacy };
}
function sanitizeExp(e) {
  const date = isoOr(e.date); if (!date || typeof e.id !== "string") return null;
  const cat = cleanText(e.cat, 40) || "Lain-lain";
  return { id: e.id.slice(0, 40), day: DAYRE.test(e.day) ? e.day : dayKey(date), date, cat, type: ["op", "stock", "owner"].includes(e.type) ? e.type : expType(cat), amount: Math.max(0, money(e.amount)), note: cleanText(e.note, 60), method: e.method === "Tunai" ? "Tunai" : "Non-tunai", shiftId: e.shiftId ? String(e.shiftId).slice(0, 30) : null, by: cleanText(e.by, 12) };
}
function sanitizeShift(x, closed = true) {
  const openAt = isoOr(x.openAt); if (!openAt || typeof x.id !== "string") return null;
  const out = { id: x.id.slice(0, 40), day: DAYRE.test(x.day) ? x.day : dayKey(openAt), openAt, openingCash: money(x.openingCash), openedBy: cleanText(x.openedBy, 12) };
  if (!closed) return out;
  const closeAt = isoOr(x.closeAt); if (!closeAt) return null;
  const byMethod = {}; for (const [k, v] of Object.entries(x.byMethod || {})) if (METHODS.some(mm => mm[0] === k)) byMethod[k] = money(v);
  return { ...out, closeAt, closedBy: cleanText(x.closedBy, 12), count: Math.max(0, money(x.count)), voids: Math.max(0, money(x.voids)), sales: money(x.sales), profit: money(x.profit), byMethod, cashSales: money(x.cashSales), cashOut: money(x.cashOut), expected: money(x.expected), counted: money(x.counted), diff: money(x.diff), note: cleanText(x.note, 80), denoms: null };
}
function sanitizeHeldOne(h) {
  return { id: String(h.id || uid("h")).slice(0, 30), name: cleanText(h.name, 30) || "Pesanan", customer: cleanText(h.customer, 40), customerId: h.customerId ? String(h.customerId).slice(0, 24) : null, redeem: false, discount: h.discount && typeof h.discount === "object" ? { type: h.discount.type === "amt" ? "amt" : "pct", value: money(h.discount.value) } : null, at: isoOr(h.at, new Date().toISOString()), lines: h.lines.slice(0, 200).map(l => ({ id: String(l.id || uid("l")).slice(0, 30), pid: Math.trunc(num(l.pid)), qty: normQty(l.qty) ?? 1, note: cleanText(l.note, 60), opts: (Array.isArray(l.opts) ? l.opts : []).map(o => ({ g: String(o.g).slice(0, 24), c: String(o.c).slice(0, 24) })) })) };
}
function sanitizeCustomer(c) {
  return { id: String(c.id).slice(0, 24), name: cleanText(c.name, 40) || "Pelanggan", phone: normPhone(c.phone), stamps: Math.max(0, money(c.stamps)), visits: Math.max(0, money(c.visits)), spent: Math.max(0, money(c.spent)), lastAt: c.lastAt || null, createdAt: c.createdAt || null };
}
function validateBackup(b) {
  if (!b || typeof b !== "object") throw new Error("File bukan cadangan yang valid.");
  if (b.format !== "nyala-backup") throw new Error("File ini bukan cadangan " + APP.name + ".");
  if (!(b.schema >= 1 && b.schema <= APP.schema)) throw new Error("Versi cadangan lebih baru dari aplikasi ini. Perbarui aplikasi dulu.");
  const kv = b.kv || {};
  const catalog = sanitizeCatalog(kv.catalog || {});
  const settings = { ...defaultSettings(kv.settings?.type), ...(kv.settings || {}) };
  settings.stamp = { ...defaultSettings().stamp, ...(kv.settings?.stamp || {}) };
  settings.storeName = cleanText(settings.storeName, 60); settings.address = cleanText(settings.address, 120); settings.phone = cleanText(settings.phone, 30); settings.footer = cleanText(settings.footer, 120);
  if (!BIZ[settings.type]) settings.type = "coffee";
  const tx = (Array.isArray(b.tx) ? b.tx : []).filter(t => t && typeof t === "object").map(sanitizeTx).filter(Boolean);
  const images = {};
  for (const [k, v] of Object.entries(b.images || {})) if (typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 2_000_000) images[String(k).slice(0, 64)] = v;
  const held = (Array.isArray(kv.held) ? kv.held.slice(0, 50) : []).filter(h => h && Array.isArray(h.lines)).map(sanitizeHeldOne);
  const meta = { ...defaultMeta(), ...(kv.meta || {}), schema: APP.schema };
  const stocklog = Array.isArray(b.stocklog) ? b.stocklog.filter(l => l && Number.isFinite(Number(l.itemId))) : [];
  const customers = (Array.isArray(kv.customers) ? kv.customers : []).filter(c => c && c.id).slice(0, 5000).map(sanitizeCustomer);
  const exp = (Array.isArray(b.exp) ? b.exp : []).filter(x => x && typeof x === "object").map(sanitizeExp).filter(Boolean);
  const shifts = (Array.isArray(b.shifts) ? b.shifts : []).filter(x => x && typeof x === "object").map(x => sanitizeShift(x)).filter(Boolean);
  const shift = kv.shift && typeof kv.shift === "object" ? sanitizeShift(kv.shift, false) : null;
  // numeric settings that feed arithmetic & markup
  settings.taxBp = clamp(money(settings.taxBp), 0, 5000); settings.serviceBp = clamp(money(settings.serviceBp), 0, 5000); settings.taxLabel = cleanText(settings.taxLabel, 20) || "Pajak";
  settings.roundingStep = [0, 100, 500, 1000].includes(Number(settings.roundingStep)) ? Number(settings.roundingStep) : 0; settings.dailyTarget = Math.max(0, money(settings.dailyTarget));
  settings.stamp = { enabled: !!settings.stamp.enabled, minSpend: Math.max(0, money(settings.stamp.minSpend)), target: clamp(money(settings.stamp.target) || 10, 2, 50), reward: Math.max(0, money(settings.stamp.reward)) };
  settings.promos = (Array.isArray(settings.promos) ? settings.promos : []).slice(0, 10).map(sanitizePromo); settings.theme = ["auto", "light", "dark"].includes(settings.theme) ? settings.theme : "auto";
  settings.paper = settings.paper === "80" ? "80" : "58"; settings.transferInfo = cleanText(settings.transferInfo, 80); settings.ownerName = cleanText(settings.ownerName, 40);
  meta.notices = (Array.isArray(meta.notices) ? meta.notices : []).slice(0, 5).map(n => ({ id: cleanText(n.id, 20), text: cleanText(n.text, 300) }));
  meta.seq = { day: DAYRE.test(meta.seq?.day) ? meta.seq.day : "", n: Math.max(0, money(meta.seq?.n)) };
  return { kv: { settings, catalog, cart: emptyCart(), held, meta, customers, shift }, tx, images, stocklog, exp, shifts, summary: { products: catalog.products.length, items: catalog.items.length, tx: tx.length, exportedAt: b.exportedAt, store: settings.storeName } };
}
async function requestPersistentStorage() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (_) {}
}
