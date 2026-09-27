/* =====================================================================
   14-v12.js — v1.2 innovations
   - Mode gelap (otomatis / terang / gelap)
   - Promo otomatis "Happy Hour" (hari & jam, per kategori) + banner Kasir
   - Chip "🔥 Terlaris" (urut penjualan 30 hari)
   - Barcode: scanner USB/Bluetooth (ketik + Enter) & kamera (BarcodeDetector)
   - Daftar belanja pintar dari stok menipis/perkiraan → WhatsApp supplier
   - Checklist "Siap jualan" untuk pengguna baru
   ===================================================================== */
const TOP_CAT = "🔥 Terlaris";

/* ---------- Theme ---------- */
const darkMQ = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function applyTheme() {
  const t = state.settings.theme || "auto";
  const dark = t === "dark" || (t === "auto" && darkMQ?.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? "#0b1020" : "#0e142d";
}
darkMQ?.addEventListener?.("change", () => applyTheme());

/* ---------- Popularity (30 hari) ---------- */
let popCache = null;
function popularity() {
  if (popCache && popCache.ver === DB.ver && popCache.day === dayKey()) return popCache.map;
  if (!popCache?.loading) {
    popCache = { ...(popCache || {}), loading: true };
    const v = DB.ver, t = dayKey();
    DB.txRange(addDays(t, -29), t).then(txs => {
      const map = {}; for (const x of txs) if (x.status !== "void") for (const i of x.items || []) map[i.pid] = (map[i.pid] || 0) + (Number(i.qty) || 0);
      popCache = { map, ver: v, day: t }; if (state.ui.tab === "pos" && state.ui.cat === TOP_CAT) refreshGrid();
    }).catch(() => { popCache = { map: {}, ver: v, day: t }; });
  }
  return popCache.map || {};
}

/* ---------- Promo banner & editor ---------- */
function promoBannerHtml() {
  if (!isPro()) return "";
  const act = activePromos();
  if (!act.length) return "";
  const p = act.sort((a, b) => b.bp - a.bp)[0];
  return `<div class="promo-banner" role="status">${icon("zap")}<span><b>${esc(p.name)} −${p.bp / 100}%</b> ${p.cats.length ? esc(p.cats.join(", ")) : "semua menu"} · s.d. ${esc(p.to.replace(":", "."))}</span></div>`;
}
const DAYN = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
SHEETS.promos = () => {
  const list = state.settings.promos || [];
  return { title: "Promo Otomatis", icon: "zap", tall: true, body: `
    <p class="help" style="margin-top:0">Diskon berjalan sendiri di jam & hari tertentu — cocok untuk <b>Happy Hour</b> di jam sepi. Kasir tidak perlu ingat apa pun; struk mencatat nama promo.</p>
    <div class="list">${list.map(p => `<div class="row-card" data-action="promo-edit" data-id="${esc(p.id)}" role="button" tabindex="0"><span class="tx-ico" style="background:var(--amber-soft);color:#b37400">${icon("zap")}</span><div class="row-main"><b>${esc(p.name)} · −${p.bp / 100}%</b><div class="row-sub">${p.days.length ? p.days.map(d => DAYN[d]).join(", ") : "Setiap hari"} · ${esc(p.from.replace(":", "."))}–${esc(p.to.replace(":", "."))} · ${p.cats.length ? esc(p.cats.join(", ")) : "Semua menu"}</div></div>${switchHtml("pr-on-" + p.id, p.active, `data-promo="${esc(p.id)}"`)}</div>`).join("") || emptyState("zap", "Belum ada promo", "Contoh: Happy Hour 20% kopi, Senin–Jumat 14.00–16.00.")}</div>`,
    foot: `<button class="btn primary block" data-action="promo-new">${icon("plus")}Buat promo</button>` };
};
SHEETS.promo = (m) => {
  const d = m.draft;
  return { title: d.isNew ? "Promo Baru" : "Edit Promo", icon: "zap", tall: true, noBackdropClose: true, body: `
    <div class="form-label">Nama promo</div><input id="pr-name" class="input" maxlength="30" value="${esc(d.name)}" placeholder="Happy Hour">
    <div class="form-label">Potongan</div><div class="input-affix suffix"><span>%</span><input id="pr-pct" class="input" inputmode="decimal" value="${d.bp ? String(d.bp / 100).replace(".", ",") : ""}" placeholder="20"></div>
    <div class="form-label">Hari <small>kosong = setiap hari</small></div><div class="opt-chips">${DAYN.map((n, i) => `<button class="opt ${d.days.includes(i) ? "on" : ""}" data-action="pr-day" data-value="${i}" style="min-width:48px;align-items:center"><span>${n}</span></button>`).join("")}</div>
    <div class="form-row"><div><div class="form-label">Mulai</div><input id="pr-from" class="input" type="time" value="${esc(d.from)}"></div><div><div class="form-label">Selesai</div><input id="pr-to" class="input" type="time" value="${esc(d.to)}"></div></div>
    <div class="form-label">Berlaku untuk <small>kosong = semua menu</small></div><div class="opt-chips">${state.catalog.cats.map(c => `<button class="opt ${d.cats.includes(c) ? "on" : ""}" data-action="pr-cat" data-value="${esc(c)}"><span>${esc(c)}</span></button>`).join("")}</div>
    ${m.hint ? `<div class="notice info" style="margin:14px 0 0">${icon("sparkle")}<span>${esc(m.hint)}</span></div>` : ""}
    <div class="help">Jika beberapa promo aktif bersamaan, dipakai yang potongannya paling besar. Diskon manual tetap bisa ditambahkan setelah promo.</div>`,
    foot: `${d.isNew ? "" : `<button class="btn danger-outline" data-action="promo-del">${icon("trash")}</button>`}<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="promo-save">${icon("check")}Simpan</button>` };
};
async function savePromo() {
  const d = state.ui.modal.draft;
  const bp = d.bp;
  if (!cleanText(d.name)) return toast("Isi nama promo.", true);
  if (!bp || bp > 9000) return toast("Potongan harus 1–90%.", true);
  const p = sanitizePromo({ ...d, bp });
  if (p.from === p.to) return toast("Jam mulai dan selesai tidak boleh sama.", true);
  const promos = (state.settings.promos || []).filter(x => x.id !== p.id).concat([p]);
  if (await saveSettings({ promos }, `Promo ${p.name} disimpan`)) openSheet("promos");
}
async function deletePromo() {
  const d = state.ui.modal.draft;
  const ok = await confirmDialog({ title: "Hapus promo?", text: `<b>${esc(d.name)}</b> tidak akan berjalan lagi. Transaksi lama tetap mencatatnya.`, ok: "Hapus", icon: "trash" });
  if (!ok) return;
  if (await saveSettings({ promos: (state.settings.promos || []).filter(x => x.id !== d.id) }, "Promo dihapus")) openSheet("promos");
}
/** quietest 2-hour window among trading hours (for Happy Hour suggestion) */
function quietWindow(hours) {
  const open = hours.map((v, h) => [v, h]).filter(([v]) => v > 0).map(([, h]) => h);
  if (open.length < 4) return null;
  let best = null;
  for (let h = open[0]; h < open[open.length - 1] - 1; h++) { const v = hours[h] + hours[h + 1]; if (best === null || v < best.v) best = { h, v }; }
  return best;
}

/* ---------- Barcode ---------- */
function scanSupported() { return "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia; }
function addByBarcode(code) {
  code = String(code || "").trim(); if (!code) return false;
  const p = state.catalog.products.find(x => x.barcode && x.barcode.toLowerCase() === code.toLowerCase() && x.active !== false);
  if (!p) return false;
  addToCart(p.id); chime(); toast(`${p.name} ditambahkan`);
  return true;
}
let scanStream = null, scanTimer = null;
SHEETS.scan = () => ({ title: "Scan Barcode", icon: "scan", body: `<div class="scan-box"><video id="scan-video" playsinline muted></video><i class="scan-line"></i></div><p class="help" style="text-align:center">Arahkan kamera ke barcode produk. Scanner USB/Bluetooth juga bisa langsung dipakai di kolom cari.</p>`, foot: `<button class="btn soft block" data-action="close-sheet">Selesai</button>` });
async function openScanner() {
  openSheet("scan");
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const v = $("#scan-video"); if (!v) return stopScanner();
    v.srcObject = scanStream; await v.play();
    const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
    let last = "", lastAt = 0;
    const tick = async () => {
      if (state.ui.modal?.type !== "scan") return stopScanner();
      try { const r = await det.detect(v); const code = r[0]?.rawValue; if (code && (code !== last || Date.now() - lastAt > 2000)) { last = code; lastAt = Date.now(); if (!addByBarcode(code)) toast(`Barcode ${code} belum terdaftar di produk mana pun.`, true); } } catch (_) {}
      scanTimer = setTimeout(tick, 250);
    };
    tick();
  } catch (e) { toast("Kamera tidak bisa dibuka. Izinkan akses kamera di browser.", true); closeSheet(); }
}
function stopScanner() { clearTimeout(scanTimer); if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; } }

/* ---------- Daftar belanja pintar ---------- */
async function buildShoppingList() {
  const fc = await stockForecast();
  const byId = new Map(fc.map(f => [f.it.id, f]));
  const rows = [];
  for (const it of state.catalog.items) {
    if (it.stock === null) continue;
    const f = byId.get(it.id); const st = itemStatus(it);
    const need7 = f ? Math.max(0, f.perDay * 7 - Math.max(0, it.stock)) : 0;
    const needMin = it.minStock !== null ? Math.max(0, it.minStock * 2 - Math.max(0, it.stock)) : 0;
    let qty = Math.max(need7, st === "low" || st === "out" ? needMin : 0);
    if (!(qty > 0)) continue;
    // round up to whole purchase packs (the way it is really bought)
    const packs = Math.max(1, Math.ceil(qty / (it.buyQty || 1)));
    rows.push({ it, packs, qty: packs * (it.buyQty || 1), cost: packs * money(it.price), why: f && f.daysLeft < 7 ? `habis ±${Math.max(0, Math.round(f.daysLeft))} hari` : st === "out" ? "habis" : "di bawah batas" });
  }
  return rows.sort((a, b) => b.cost - a.cost);
}
SHEETS.shopping = (m) => {
  if (!m.rows) return { title: "Daftar Belanja", icon: "list", body: `<div class="empty" style="min-height:140px"><b>Menghitung kebutuhan…</b></div>` };
  const sel = m.rows.filter((r, i) => !m.off[i]);
  const total = sel.reduce((a, r) => a + r.cost, 0);
  return { title: "Daftar Belanja", icon: "list", tall: true, body: m.rows.length ? `
    <p class="help" style="margin-top:0">Dihitung dari pemakaian 14 hari terakhir untuk <b>7 hari</b> ke depan & batas minimum, dibulatkan ke kemasan beli.</p>
    <div class="list">${m.rows.map((r, i) => `<label class="shop-row ${m.off[i] ? "off" : ""}"><input type="checkbox" class="shop-cb" data-i="${i}" ${m.off[i] ? "" : "checked"}><span class="row-main"><b>${esc(r.it.name)}</b><span class="row-sub">${r.packs}× ${esc(r.it.packName || (fmtQty(r.it.buyQty) + " " + r.it.unit))} · ${esc(r.why)}</span></span><b class="num">${rp(r.cost)}</b></label>`).join("")}</div>
    <div class="kv total"><span>Perkiraan belanja</span><b>${rp(total)}</b></div>` : emptyState("check", "Stok aman", "Belum ada bahan yang perlu dibeli untuk 7 hari ke depan."),
    foot: m.rows.length ? `<button class="btn success block" data-action="shop-share" ${sel.length ? "" : "disabled"}>${icon("wa")}Kirim ke supplier / catatan</button>` : `<button class="btn primary block" data-action="close-sheet">Tutup</button>` };
};
function shoppingText(m) {
  const sel = m.rows.filter((r, i) => !m.off[i]);
  return [`*Daftar belanja ${state.settings.storeName}*`, fmtDate(new Date()), "", ...sel.map((r, i) => `${i + 1}. ${r.it.name} — ${r.packs}× ${r.it.packName || (fmtQty(r.it.buyQty) + " " + r.it.unit)}`), "", `Perkiraan: ${rp(sel.reduce((a, r) => a + r.cost, 0))}`].join("\n");
}

/* ---------- Checklist siap jualan ---------- */
function gettingStartedHtml() {
  if (state.meta.gsDone || !state.ui.owner) return "";
  const s = state.settings;
  const steps = [
    ["box", "Sesuaikan menu & harga", !!state.meta.menuTouched, "gs-menu"],
    ["qr", "Unggah QRIS toko", !!s.qrisImageId, "open-payset"],
    ["bag", "Transaksi pertama", !!state.meta.hasSales, "gs-sale"],
    ["shield", "Buat cadangan data", !!state.meta.lastBackupAt, "backup"],
  ];
  const done = steps.filter(x => x[2]).length;
  if (done === steps.length) return "";
  return `<div class="gs-card"><div class="gs-head"><div><b>Siap jualan ${done}/${steps.length}</b><small>Selesaikan agar toko berjalan mulus</small></div><button class="icon-btn" data-action="gs-hide" aria-label="Sembunyikan checklist" style="width:34px;height:34px">${icon("x")}</button></div>
    <div class="gs-bar"><i style="width:${Math.round(done / steps.length * 100)}%"></i></div>
    <div class="gs-steps">${steps.map(([ic, label, ok, act]) => `<button class="gs-step ${ok ? "ok" : ""}" data-action="${ok ? "" : act}"><span>${icon(ok ? "check" : ic)}</span>${esc(label)}</button>`).join("")}</div></div>`;
}

Object.assign(ACTIONS, {
  "open-theme": () => openSheet("theme"),
  "theme-set": async el => { await saveSettings({ theme: el.dataset.value }); applyTheme(); renderOverlay(); },
  "open-promos": () => { if (!isPro()) return openPro("promo"); openSheet("promos"); },
  "promo-new": (el) => openSheet("promo", { draft: { id: uid("p").slice(0, 10), name: "Happy Hour", bp: 2000, days: [1, 2, 3, 4, 5], from: el?.dataset?.from || "14:00", to: el?.dataset?.to || "16:00", cats: [], active: true, isNew: true }, hint: el?.dataset?.hint || "" }),
  "promo-edit": (el, ev) => { if (ev.target.closest("label.switch")) return; const p = (state.settings.promos || []).find(x => x.id === el.dataset.id); if (p) openSheet("promo", { draft: { ...deepCopy(p), isNew: false } }); },
  "pr-day": el => { const d = state.ui.modal.draft; const v = Number(el.dataset.value); d.days = d.days.includes(v) ? d.days.filter(x => x !== v) : [...d.days, v].sort(); renderOverlay(); },
  "pr-cat": el => { const d = state.ui.modal.draft; const v = el.dataset.value; d.cats = d.cats.includes(v) ? d.cats.filter(x => x !== v) : [...d.cats, v]; renderOverlay(); },
  "promo-save": () => savePromo(),
  "promo-del": () => deletePromo(),
  "scan-open": () => openScanner(),
  "open-shopping": async () => { if (!stockEnabled()) return openPro("stock"); openSheet("shopping", { rows: null, off: {} }); const rows = await buildShoppingList(); if (state.ui.modal?.type === "shopping") { state.ui.modal.rows = rows; renderOverlay(); } },
  "shop-share": () => shareText(shoppingText(state.ui.modal), "Daftar belanja"),
  "gs-hide": () => { state.meta.gsDone = true; Persist.mark("meta"); renderScreen(); },
  "gs-menu": () => { state.meta.menuTouched = true; Persist.mark("meta"); state.ui.catalogTab = "produk"; go("catalog"); },
  "gs-sale": () => { const s = $("#pos-screen"); if (s) s.scrollTo({ top: 260, behavior: "smooth" }); toast("Ketuk menu untuk mulai transaksi pertama 👇"); },
});
SHEETS.theme = () => ({ title: "Tampilan", icon: "moon", body: `<div class="list">${[["auto", "Otomatis", "Ikuti pengaturan HP (gelap di malam hari bila HP disetel begitu)"], ["light", "Terang", "Paling jelas di bawah sinar matahari"], ["dark", "Gelap", "Nyaman di malam hari & hemat baterai layar OLED"]].map(([v, t, d]) => `<button class="choice ${(state.settings.theme || "auto") === v ? "on" : ""}" data-action="theme-set" data-value="${v}"><span class="radio"></span><span><b>${t}</b><small>${d}</small></span></button>`).join("")}</div>`, foot: `<button class="btn primary block" data-action="close-sheet">Selesai</button>` });

document.addEventListener("change", async ev => {
  const el = ev.target;
  if (el.dataset?.promo) { const promos = (state.settings.promos || []).map(p => p.id === el.dataset.promo ? { ...p, active: el.checked } : p); await saveSettings({ promos }, el.checked ? "Promo diaktifkan" : "Promo dimatikan"); }
  if (el.classList?.contains("shop-cb") && state.ui.modal?.type === "shopping") { state.ui.modal.off[Number(el.dataset.i)] = !el.checked; renderOverlay(); }
});
document.addEventListener("input", ev => {
  const el = ev.target, m = state.ui.modal; if (m?.type !== "promo") return;
  // keep typed values in the draft so re-renders (day/category chips) never wipe them
  if (el.id === "pr-name") m.draft.name = el.value;
  if (el.id === "pr-pct") m.draft.bp = pctToBp(el.value.replace(",", ".")) || 0;
  if (el.id === "pr-from") m.draft.from = el.value;
  if (el.id === "pr-to") m.draft.to = el.value;
});
document.addEventListener("keydown", ev => {
  // USB/Bluetooth barcode scanners type the code then press Enter in the focused search box
  if (ev.key === "Enter" && ev.target.id === "pos-search") {
    const v = ev.target.value;
    if (addByBarcode(v)) { ev.preventDefault(); ev.target.value = ""; state.ui.search = ""; refreshGrid(); $("[data-action=clear-search]")?.setAttribute("style", "display:none"); }
  }
});
