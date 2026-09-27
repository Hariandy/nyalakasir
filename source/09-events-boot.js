/* =====================================================================
   09-events-boot.js — event delegation, boot, migration, PWA, errors.
   ===================================================================== */
let installPrompt = null;

const ACTIONS = {
  // navigation & shell
  nav: el => go(el.dataset.value),
  backdrop: (el, ev) => { if (ev.target === el) closeSheet(); },
  "close-sheet": () => closeSheet(),
  "dlg-ok": () => resolveDialog(true),
  "dlg-cancel": () => resolveDialog(false),
  "apply-update": () => applyUpdate(),
  "dismiss-notice": el => { state.meta.notices = (state.meta.notices || []).filter(n => n.id !== el.dataset.id); Persist.mark("meta"); renderScreen(); },
  "goto-stock": () => { state.ui.catalogTab = "bahan"; go("catalog"); },
  // onboarding & lock
  "onb-next": () => {
    const o = state.ui.onb;
    if (o.step === 1) { o.name = $("#onb-name")?.value || o.name; o.owner = $("#onb-owner")?.value || o.owner; if (!cleanText(o.name)) { toast("Isi nama usaha dulu ya.", true); $("#onb-name")?.focus(); return; } }
    o.step = Math.min(3, o.step + 1); render();
  },
  "onb-back": () => { state.ui.onb.step = Math.max(1, state.ui.onb.step - 1); render(); },
  "onb-type": el => { state.ui.onb.type = el.dataset.value; render(); },
  "onb-demo": el => { state.ui.onb.demo = el.dataset.value === "1"; render(); },
  "onb-finish": () => finishOnboarding(),
  "pin-key": el => pinKey(el.dataset.value),
  "pin-clear": () => pinKey("clear"),
  "pin-enter": () => pinKey("enter"),
  // kasir
  category: el => { state.ui.cat = el.dataset.value; $$(".chip[data-action=category]").forEach(c => { const on = c.dataset.value === state.ui.cat; c.classList.toggle("active", on); c.setAttribute("aria-selected", on); }); refreshGrid(); },
  "clear-search": () => { state.ui.search = ""; const i = $("#pos-search"); if (i) i.value = ""; $("[data-action=clear-search]")?.setAttribute("style", "display:none"); refreshGrid(); },
  "add-cart": el => addToCart(Number(el.dataset.pid)),
  "open-cart": () => { if (state.cart.lines.length) openSheet("cart"); },
  "line-plus": el => { const l = state.cart.lines.find(x => x.id === el.dataset.id); if (l) setLineQty(l.id, scaledToNumber((toScaled(l.qty) ?? 0n) + SCALE)); },
  "line-minus": el => { const l = state.cart.lines.find(x => x.id === el.dataset.id); if (l) setLineQty(l.id, scaledToNumber((toScaled(l.qty) ?? 0n) - SCALE)); },
  "line-del": el => setLineQty(el.dataset.id, 0),
  "line-qty": async el => { const l = state.cart.lines.find(x => x.id === el.dataset.id); if (!l) return; const v = await confirmDialog({ title: "Ubah jumlah", text: "Boleh desimal untuk barang timbangan (mis. 0,5).", ok: "Simpan", danger: false, icon: "edit", input: "Jumlah", value: fmtQty(l.qty), mode: "decimal" }); if (v === false) return; const q = normQtyInput(v); if (q === null || q < 0 || q > 99999) return toast("Jumlah tidak valid.", true); setLineQty(l.id, q); },
  "line-note": async el => { const l = state.cart.lines.find(x => x.id === el.dataset.id); if (!l) return; const v = await confirmDialog({ title: "Catatan item", text: "Contoh: less sugar, tanpa es, pedas.", ok: "Simpan", danger: false, icon: "note", input: "Catatan", value: l.note, optional: true }); if (v === false) return; l.note = cleanText(v, 60); Persist.mark("cart"); renderOverlay(); },
  "open-discount": () => { if (!isPro()) return openPro("discount"); openSheet("discount", {}); },
  "remove-discount": () => { state.cart.discount = null; Persist.mark("cart"); renderOverlay(); updateCartBar(); },
  "disc-type": el => { state.ui.modal.dtype = el.dataset.value; state.ui.modal.dval = ""; renderOverlay(); },
  "disc-quick": el => { const i = $("#disc-value"); if (i) i.value = state.ui.modal.dtype === "amt" || (!state.ui.modal.dtype && state.cart.discount?.type === "amt") ? groupDigits(Number(el.dataset.value)) : el.dataset.value; state.ui.modal.dval = i?.value; },
  "apply-discount": () => {
    const m = state.ui.modal; const type = m.dtype || state.cart.discount?.type || "pct"; const raw = $("#disc-value")?.value || "";
    const value = type === "pct" ? pctToBp(raw.replace(",", ".")) : parseMoneyInput(raw);
    if (value === null || value < 0 || (type === "pct" && value > 10000)) return toast("Nilai diskon tidak valid.", true);
    state.cart.discount = value > 0 ? { type, value } : null; Persist.mark("cart"); openSheet("cart"); updateCartBar();
  },
  "hold-order": () => holdOrder(),
  "resume-held": el => resumeHeld(el.dataset.id),
  "open-payment": () => { if (!state.cart.lines.length) return toast("Keranjang masih kosong.", true); const t = computeTotals(); if (t.invalid.length) { state.cart.lines = state.cart.lines.filter(l => !t.invalid.includes(l)); Persist.mark("cart"); toast("Produk yang sudah dihapus dikeluarkan dari keranjang.", true); } const first = METHODS.find(x => state.settings.methods[x[0]] !== false)?.[0] || "Tunai"; openSheet("payment", { method: first, cash: computeTotals().total }); },
  "pay-method": el => { const m = state.ui.modal; m.method = el.dataset.value; if (m.method === "Tunai") m.cash = computeTotals().total; renderOverlay(); },
  "quick-cash": el => { state.ui.modal.cash = Number(el.dataset.value); const i = $("#cash-input"); if (i) i.value = groupDigits(state.ui.modal.cash); updatePaymentLive(); haptic(6); },
  "cash-clear": () => { state.ui.modal.cash = 0; const i = $("#cash-input"); if (i) { i.value = ""; i.focus(); } updatePaymentLive(); },
  checkout: () => doCheckout(),
  "new-order": () => { closeSheet(); const s = $("#pos-search"); if (state.ui.search && s) { state.ui.search = ""; s.value = ""; refreshGrid(); } },
  "print-tx": () => { const t = currentTx(); if (t) printTx(t); },
  "wa-tx": () => { const t = currentTx(); if (t) waTx(t); },
  "share-tx": () => { const t = currentTx(); if (t) shareTx(t); },
  // reports
  period: el => { const p = PERIODS.find(x => x.id === el.dataset.value); if (p?.pro && !isPro()) return openPro("period"); state.ui.period = el.dataset.value; state.ui.histLimit = 40; state.report = null; renderScreen(); },
  "more-history": () => { state.ui.histLimit += 60; renderScreen(); },
  "tx-detail": el => openTxDetail(el.dataset.id),
  "void-tx": () => doVoid(),
  "export-csv": () => exportCSV(),
  // catalog
  "catalog-tab": el => { state.ui.catalogTab = el.dataset.value; state.ui.catSearch = ""; renderScreen(); },
  "add-product": () => { if (!isPro() && state.catalog.products.length >= APP.freeProductLimit) return openPro("limit"); openSheet("product", { draft: newProductDraft(null) }); },
  "edit-product": (el, ev) => { if (ev.target.closest("[data-action]") !== el) return; const p = findProduct(Number(el.dataset.id)); if (p) openSheet("product", { draft: newProductDraft(p) }); },
  "dup-product": el => duplicateProduct(Number(el.dataset.id)),
  "del-product": el => deleteProduct(Number(el.dataset.id)),
  "pf-photo": () => $("#pf-file")?.click(),
  "pf-photo-del": () => { const d = state.ui.modal.draft; d.imageData = null; d.imageId = null; renderOverlay(); },
  "pf-cat": el => { state.ui.modal.draft.category = el.dataset.value; renderOverlay(); },
  "pf-newcat": async () => { const n = cleanText(await confirmDialog({ title: "Kategori baru", text: "Contoh: Kopi, Snack, Promo.", ok: "Tambah", danger: false, icon: "layers", input: "Nama kategori" }) || "", 30); if (!n) return; if (!state.catalog.cats.includes(n)) { state.catalog.cats.push(n); Persist.mark("catalog"); } state.ui.modal.draft.category = n; renderOverlay(); },
  "pf-mode": el => { const d = state.ui.modal.draft; if (el.dataset.value === "manual" && d.costMode !== "manual") d.manualHpp = productHpp(d); d.costMode = el.dataset.value; if (d.costMode === "stock" && !findItem(d.stockItemId)) d.stockItemId = state.catalog.items[0]?.id ?? null; renderOverlay(); },
  "pf-add-line": () => { const d = state.ui.modal.draft; const used = new Set(d.recipe.map(r => r.itemId)); const it = state.catalog.items.find(i => !used.has(i.id)) || state.catalog.items[0]; if (it) d.recipe.push({ itemId: it.id, qty: 0 }); renderOverlay(); setTimeout(() => { const q = $$(".pf-qty"); q[q.length - 1]?.focus(); }, 30); },
  "pf-del-line": el => { state.ui.modal.draft.recipe.splice(Number(el.dataset.i), 1); renderOverlay(); },
  "pf-suggest": el => { state.ui.modal.draft.price = Number(el.dataset.value); const i = $("#pf-price"); if (i) i.value = groupDigits(state.ui.modal.draft.price); updateProductLive(); haptic(6); },
  "pf-save": () => saveProduct(),
  "add-item": () => openSheet("item", { draft: newItemDraft(null) }),
  "edit-item": (el, ev) => { if (ev.target.closest("[data-action]") !== el) return; const it = findItem(Number(el.dataset.id)); if (it) openSheet("item", { draft: newItemDraft(it) }); },
  "del-item": el => deleteItem(Number(el.dataset.id)),
  "if-save": () => saveItem(),
  restock: el => openRestock(Number(el.dataset.id)),
  "rs-mode": el => { state.ui.modal.mode = el.dataset.value; renderOverlay(); },
  "rs-save": () => saveRestock(),
  "manage-cats": () => openSheet("cats"),
  "cat-add": () => catAction("add"),
  "cat-rename": el => catAction("rename", Number(el.dataset.i)),
  "cat-del": el => catAction("del", Number(el.dataset.i)),
  "cat-up": el => catAction("up", Number(el.dataset.i)),
  // settings
  "open-pro": (el, ev) => { ev.preventDefault?.(); openPro(); },
  "pick-plan": el => { state.ui.modal.plan = el.dataset.value; renderOverlay(); },
  buy: () => buyPlan(),
  "open-license": () => openSheet("license", {}),
  "lic-activate": () => activateLicense($("#lic-key")?.value),
  "lic-remove": async () => { const ok = await confirmDialog({ title: "Lepas lisensi?", text: "Aplikasi kembali ke paket Gratis. Simpan kode Anda untuk aktivasi ulang.", ok: "Lepas", icon: "key" }); if (!ok) return; await saveSettings({ license: null }); await refreshPlan(); closeSheet(); render(); },
  "open-store": () => { if (!state.ui.owner) return; const s = state.settings; openSheet("store", { draft: { storeName: s.storeName, ownerName: s.ownerName, address: s.address, phone: s.phone, footer: s.footer, logoId: s.logoId, paper: s.paper } }); },
  "st-logo": () => { if (!isPro()) return openPro(); $("#st-file")?.click(); },
  "st-logo-del": () => { const d = state.ui.modal.draft; d.logoData = null; d.logoId = null; renderOverlay(); },
  "st-paper": el => { state.ui.modal.draft.paper = el.dataset.value; renderOverlay(); },
  "st-save": () => saveStore(),
  "open-biz": () => openSheet("biz", { value: state.settings.type, demo: false }),
  "biz-pick": el => { state.ui.modal.value = el.dataset.value; renderOverlay(); },
  "biz-demo": el => { state.ui.modal.demo = el.dataset.value === "1"; renderOverlay(); },
  "biz-save": () => saveBiz(),
  "open-payset": (el, ev) => { ev.preventDefault?.(); const s = state.settings; openSheet("payset", { draft: { methods: { ...s.methods }, qrisImageId: s.qrisImageId, transferInfo: s.transferInfo } }); },
  "ps-qris": () => $("#ps-file")?.click(),
  "ps-qris-del": () => { const d = state.ui.modal.draft; d.qrisData = null; d.qrisImageId = null; renderOverlay(); },
  "ps-save": () => savePayset(),
  "open-tax": () => { if (!isPro()) return openPro("discount"); openSheet("tax"); },
  "tax-save": () => saveTax(),
  "tx-round": el => { state.ui.modal.round = Number(el.dataset.value); $$("[data-action=tx-round]").forEach(b => b.classList.toggle("on", b === el)); }, // no re-render: keeps typed tax values (BUG-F1)
  "open-pin": () => pinFlow(),
  "staff-mode": () => toggleStaffMode(),
  "owner-login": () => ownerLogin(),
  backup: () => doBackup(),
  restore: () => pickRestoreFile(),
  wipe: () => wipeAll(),
  install: async () => { if (!installPrompt) return; installPrompt.prompt(); try { await installPrompt.userChoice; } catch (_) {} installPrompt = null; renderScreen(); },
  "check-update": () => checkUpdate(),
  help: () => openSheet("help"),
  about: async () => openSheet("about", { log: (await DB.get("kv", "errlog").catch(() => [])) || [] }),
  "copy-log": async () => { try { await navigator.clipboard.writeText(JSON.stringify({ app: APP.version, build: APP.build, db: DB.mode, ua: navigator.userAgent, log: state.ui.modal?.log || [] }, null, 1)); toast("Log disalin."); } catch (_) { toast("Gagal menyalin.", true); } },
};
const GUARDED = new Set(["open-store", "open-biz", "open-payset", "open-tax", "open-pin", "staff-mode", "backup", "restore", "wipe", "open-license", "export-csv", "void-tx"]);

document.addEventListener("click", async ev => {
  const el = ev.target.closest?.("[data-action]"); if (!el) return;
  const a = el.dataset.action; const fn = ACTIONS[a]; if (!fn) return;
  if (el.tagName === "A") ev.preventDefault();
  if (el.disabled) return;
  try {
    if (GUARDED.has(a) && state.settings.staffMode && !state.ui.owner && !(await requireOwner())) return;
    await fn(el, ev);
  } catch (e) { handleError(e, "aksi:" + a); }
});
document.addEventListener("keydown", ev => {
  if (ev.key === "Escape") { if (state.ui.dialog) resolveDialog(false); else if (state.ui.modal && !["success", "payment"].includes(state.ui.modal.type)) closeSheet(); }
  if (ev.key === "Enter" && ev.target.id === "dlg-input") resolveDialog(true);
  if (ev.key === "Enter" && ev.target.classList?.contains("row-card")) ev.target.click();
  if (state.ui.locked && /^\d$/.test(ev.key)) pinKey(ev.key);
  if (state.ui.locked && ev.key === "Backspace") pinKey("clear");
  if (state.ui.locked && ev.key === "Enter") pinKey("enter");
});

function moneyField(el, setter) {
  const d = digitsOnly(el.value); const v = d ? Number(d) : 0; setter(v);
  const pos = el.value.length - (el.selectionStart ?? el.value.length);
  el.value = d ? groupDigits(v) : "";
  try { const p = Math.max(0, el.value.length - pos); el.setSelectionRange(p, p); } catch (_) {}
}
document.addEventListener("input", ev => {
  const el = ev.target, id = el.id, m = state.ui.modal;
  try {
    if (id === "pos-search") { state.ui.search = el.value; const x = $("[data-action=clear-search]"); if (x) x.style.display = el.value ? "" : "none"; refreshGridDebounced(); return; }
    if (id === "cat-search") { state.ui.catSearch = el.value; refreshCatalogDebounced(); return; }
    if (id === "cash-input" && m?.type === "payment") { moneyField(el, v => { m.cash = v; }); updatePaymentLive(); return; }
    if (id === "cart-customer") { state.cart.customer = cleanText(el.value, 40); Persist.mark("cart"); return; }
    if (id === "disc-value" && m?.type === "discount") { if ((m.dtype || state.cart.discount?.type || "pct") === "amt") moneyField(el, () => {}); m.dval = el.value; return; }
    if (id === "onb-name") { state.ui.onb.name = el.value; return; }
    if (id === "onb-owner") { state.ui.onb.owner = el.value; return; }
    if (m?.type === "product") {
      const d = m.draft;
      if (id === "pf-name") d.name = el.value;
      else if (id === "pf-price") moneyField(el, v => { d.price = v; });
      else if (id === "pf-hpp") moneyField(el, v => { d.manualHpp = v; });
      else if (id === "pf-extra") moneyField(el, v => { d.extraCost = v; });
      else if (id === "pf-units") d.saleUnits = normQtyInput(el.value) ?? 0;
      else if (id === "pf-barcode") { d.barcode = el.value.replace(/[^0-9A-Za-z\-]/g, "").slice(0, 32); return; }
      else if (el.classList.contains("pf-qty")) { const r = d.recipe[Number(el.dataset.i)]; if (r) r.qty = normQtyInput(el.value) ?? 0; }
      updateProductLive(); return;
    }
    if (m?.type === "item") {
      const d = m.draft;
      if (id === "if-name") d.name = el.value;
      else if (id === "if-price") moneyField(el, v => { d.price = v; });
      else if (id === "if-buy") d.buyQty = normQtyInput(el.value) ?? 0;
      else if (id === "if-stock") d.stock = el.value === "" ? 0 : normQtyInput(el.value);
      else if (id === "if-min") d.minStock = el.value === "" ? null : normQtyInput(el.value);
      else if (id === "if-packs" || id === "if-loose") { const p = normQtyInput($("#if-packs")?.value || 0) ?? 0, l = normQtyInput($("#if-loose")?.value || 0) ?? 0; d.stock = scaledToNumber((toScaled(p) ?? 0n) * (toScaled(d.buyQty || 1) ?? SCALE) / SCALE + (toScaled(l) ?? 0n)); }
      const live = $("#if-live"); if (live) live.innerHTML = itemLiveHtml(d); return;
    }
    if (m?.type === "store") { const k = { "st-name": "storeName", "st-owner": "ownerName", "st-address": "address", "st-phone": "phone", "st-footer": "footer" }[id]; if (k) m.draft[k] = el.value; return; }
    if (m?.type === "payset" && id === "ps-transfer") { m.draft.transferInfo = el.value; return; }
    if (m?.type === "license" && id === "lic-key") { m.key = el.value; return; }
    if (["rs-price"].includes(id)) moneyField(el, () => {});
    if (m?.type === "restock" && ["rs-packs", "rs-loose", "rs-qty", "rs-actual"].includes(id)) { m.v = m.v || {}; m.v[id] = el.value; }
  } catch (e) { handleError(e, "input:" + id); }
});
const refreshGridDebounced = debounce(() => refreshGrid(), 90);
const refreshCatalogDebounced = debounce(() => refreshCatalogList(), 120);

document.addEventListener("change", async ev => {
  const el = ev.target, id = el.id, m = state.ui.modal;
  try {
    if (id === "restore-file") return restoreFromFile(el.files?.[0]);
    if (id === "pf-file" && m?.type === "product") { const d = await processImage(el.files?.[0]); if (d) { m.draft.imageData = d; renderOverlay(); } return; }
    if (id === "st-file" && m?.type === "store") { const d = await processImage(el.files?.[0], 256, 30 * 1024); if (d) { m.draft.logoData = d; renderOverlay(); } return; }
    if (id === "ps-file" && m?.type === "payset") { const d = await processImage(el.files?.[0], 900, 220 * 1024); if (d) { m.draft.qrisData = d; renderOverlay(); } return; }
    if (m?.type === "product") {
      if (id === "pf-stock") { m.draft.stockItemId = Number(el.value); renderOverlay(); }
      else if (el.classList.contains("pf-ing")) { const r = m.draft.recipe[Number(el.dataset.i)]; if (r) r.itemId = Number(el.value); renderOverlay(); }
      else if (id === "pf-active") m.draft.active = el.checked;
      return;
    }
    if (m?.type === "item") {
      const d = m.draft;
      if (id === "if-unit") { d.unit = el.value; renderOverlay(); }
      else if (id === "if-pack") { d.packName = el.value; renderOverlay(); }
      else if (id === "if-track") { d.track = el.checked; if (d.track && d.stock === null) d.stock = 0; renderOverlay(); }
      return;
    }
    if (m?.type === "restock" && id === "rs-price-on") { m.priceOn = el.checked; renderOverlay(); return; }
    if (m?.type === "payset" && el.dataset.method) { m.draft.methods[el.dataset.method] = el.checked; return; }
    if (id === "set-stock") { if (el.dataset.pro && !isPro()) { el.checked = false; return openPro("stock"); } return saveSettings({ stockEnabled: el.checked }, el.checked ? "Stok otomatis aktif" : "Stok otomatis dimatikan"); }
    if (id === "set-block") return saveSettings({ blockOversell: el.checked });
    if (id === "set-cust") return saveSettings({ askCustomer: el.checked });
    if (id === "set-sound") { await saveSettings({ sound: el.checked }); if (el.checked) chime(); return; }
    if (id === "set-haptic") { await saveSettings({ haptic: el.checked }); haptic(20); return; }
    if (id === "set-lock") return saveSettings({ lockOnOpen: el.checked }, el.checked ? "PIN diminta saat aplikasi dibuka" : "");
  } catch (e) { handleError(e, "change:" + id); }
});

/* ---------- Error handling: never destructive ---------- */
function handleError(e, scope = "app") {
  console.error(scope, e);
  logError(scope, e);
  toast("Terjadi kendala kecil. Data Anda aman.", true);
}
window.addEventListener("error", ev => { if (!state.ready) return showFatal(ev.error || ev.message); handleError(ev.error || ev.message, "window"); });
window.addEventListener("unhandledrejection", ev => { if (!state.ready) return showFatal(ev.reason); handleError(ev.reason, "promise"); });
function showFatal(err) {
  const root = $("#app"); if (!root) return;
  root.innerHTML = `<div class="fatal"><div class="box"><div class="logo" style="margin:0 auto;background:var(--red)">${icon("alert")}</div><h2>Aplikasi gagal dimuat</h2><p>Data Anda <b>tidak dihapus</b>. Coba muat ulang. Bila tetap gagal, unduh data darurat lalu hubungi penjual.</p><p style="font-size:12px;color:#7d889c">${esc(String(err?.message || err || "")).slice(0, 200)}</p><button class="btn success block" onclick="location.reload()">Muat ulang</button><button class="btn outline block" id="fatal-dl" style="background:transparent;color:#fff;border-color:#4a5675">Unduh data darurat</button></div></div>`;
  $("#fatal-dl")?.addEventListener("click", emergencyExport);
}
async function emergencyExport() {
  const out = { format: "nyala-emergency", at: new Date().toISOString(), legacy: {}, idb: null };
  try { for (const k of APP.legacyKeys) out.legacy[k] = localStorage.getItem(k); } catch (_) {}
  try { if (DB.mode) out.idb = await buildBackup(); } catch (e) { out.idbError = String(e?.message || e); }
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Darurat_${APP.short}_${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- PWA ---------- */
let swReg = null;
function registerSW() {
  if (!("serviceWorker" in navigator) || !/^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href)) return;
  navigator.serviceWorker.register("./sw.js").then(reg => {
    swReg = reg;
    const watch = w => w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) { updateReady = w; drawBanner(); } });
    if (reg.waiting && navigator.serviceWorker.controller) { updateReady = reg.waiting; drawBanner(); }
    reg.addEventListener("updatefound", () => watch(reg.installing));
  }).catch(e => console.warn("SW", e));
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloading) { reloading = true; location.reload(); } });
}
async function applyUpdate() { await Persist.flush(); if (updateReady) updateReady.postMessage({ type: "SKIP_WAITING" }); else location.reload(); }
async function checkUpdate() {
  if (!swReg) return toast("Pembaruan otomatis aktif saat aplikasi dibuka dari alamat web (HTTPS).");
  try { await swReg.update(); setTimeout(() => toast(updateReady ? "Versi baru tersedia — ketuk Muat ulang." : "Anda sudah memakai versi terbaru."), 900); } catch (_) { toast("Tidak bisa cek pembaruan (offline?).", true); }
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; if (state.ui.tab === "settings") renderScreen(); });
window.addEventListener("appinstalled", () => { installPrompt = null; toast("Aplikasi terpasang di layar utama 🎉"); requestPersistentStorage(); });

/* ---------- Lifecycle ---------- */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") Persist.flush();
  else if (state.ready) { if (state.report && state.report.stamp !== dayKey()) { state.report = null; if (state.ui.tab === "history") renderScreen(); } refreshPlan().then(() => { if (state.ui.tab === "pos") renderScreen(); }); }
});
window.addEventListener("pagehide", () => Persist.flush());
window.addEventListener("online", () => renderScreen());

/* ---------- Boot ---------- */
async function loadLegacy() {
  for (const k of APP.legacyKeys) {
    try { const raw = JSON.parse(localStorage.getItem(k) || "null"); if (raw && raw.version === 2 && Array.isArray(raw.products)) return raw; } catch (_) {}
  }
  return null;
}
async function boot() {
  render();
  await DB.open();
  let [settings, catalog, cart, held, meta] = await Promise.all(["settings", "catalog", "cart", "held", "meta"].map(k => DB.get("kv", k).catch(() => null)));
  if (!settings) {
    const legacy = await loadLegacy();
    if (legacy) {
      const mig = migrateLegacy(legacy);
      const m = { ...defaultMeta(), trialStart: new Date().toISOString(), migratedFrom: "V12/V13", hasSales: mig.tx.length > 0,
        notices: [{ id: "mig", text: `Data dari versi lama berhasil dipindahkan (${mig.catalog.products.length} produk, ${mig.tx.length} transaksi). Periksa harga beli & jumlah pembelian ${BIZ[mig.settings.type].itemWord}: versi lama bisa membuat HPP tidak akurat.` }] };
      await DB.replaceAll({ kv: { settings: mig.settings, catalog: mig.catalog, cart: mig.cart, held: [], meta: m }, tx: mig.tx, images: mig.images, stocklog: [] });
      [settings, catalog, cart, held, meta] = [mig.settings, mig.catalog, mig.cart, [], m];
      // legacy key is intentionally kept (read-only) as a rollback point
    }
  }
  const defs = defaultSettings(settings?.type);
  state.settings = { ...defs, ...(settings || {}) };
  state.settings.stamp = { ...defs.stamp, ...(settings?.stamp || {}) };
  state.catalog = catalog ? sanitizeCatalog(catalog) : { cats: [], products: [], items: [], optionGroups: [] };
  state.cart = cart && Array.isArray(cart.lines) ? { ...emptyCart(), ...cart } : emptyCart();
  const [customers, shift] = await Promise.all(["customers", "shift"].map(k => DB.get("kv", k).catch(() => null)));
  state.customers = Array.isArray(customers) ? customers : [];
  state.shift = shift && shift.id ? shift : null;
  state.held = Array.isArray(held) ? held : [];
  state.meta = { ...defaultMeta(), ...(meta || {}) };
  if (!meta) await DB.put("kv", state.meta, "meta").catch(() => {});
  if (state.meta.schema !== APP.schema) { state.meta.upgradedFrom = state.meta.schema; state.meta.schema = APP.schema; Persist.mark("meta"); }
  if (new Date() > new Date(state.meta.lastSeen || 0)) { state.meta.lastSeen = new Date().toISOString(); Persist.mark("meta"); }
  applyTheme();
  await ImageCache.loadAll().catch(e => logError("images", e));
  await refreshPlan();
  await SYNC.boot().catch(e => logError("sync-boot", e));
  state.ui.owner = !state.settings.staffMode;
  state.ui.locked = !!(state.settings.pinHash && state.settings.lockOnOpen);
  state.ready = true;
  render();
  handleDeepLink();
  window.addEventListener("hashchange", handleDeepLink);
  if (state.ui.tab === "settings") fillStorageInfo();
  registerSW();
}
function handleDeepLink() {
  // #lic=KEY (activation link sent by seller)
  const lic = /[#&]lic=([^&]+)/.exec(location.hash);
  if (!lic) return;
  if (!state.settings.storeName) { toast("Selesaikan pendaftaran usaha dulu, lalu buka link aktivasi lagi."); return; }
  history.replaceState(null, "", location.pathname + location.search);
  if (!state.ui.locked) openSheet("license", { key: decodeURIComponent(lic[1]) });
}
/* settings screen needs async storage info after each render */
const _renderScreen = renderScreen;
renderScreen = function () { _renderScreen(); if (state.ui.tab === "settings") fillStorageInfo(); };

