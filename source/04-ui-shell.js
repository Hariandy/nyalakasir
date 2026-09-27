/* =====================================================================
   04-ui-shell.js — root rendering, navigation, sheets, dialogs, toast,
   image cache. Rendering is region-based: screen / nav / overlay / toast
   are updated independently so typing, scrolling and open forms are never
   destroyed by unrelated updates (fixes V12 BUG-09, BUG-22, BUG-30).
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Image cache: dataURL (DB) -> blob: URL (DOM) ---------- */
const ImageCache = (() => {
  const urls = new Map();
  function dataUrlToBlob(d) {
    const [h, b64] = d.split(","); const mime = /data:([^;]+)/.exec(h)?.[1] || "image/jpeg";
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }
  function set(id, dataUrl) {
    if (!id || typeof dataUrl !== "string") return;
    if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
    try { urls.set(id, URL.createObjectURL(dataUrlToBlob(dataUrl))); } catch (_) { urls.set(id, dataUrl); }
  }
  function drop(id) { if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } }
  async function loadAll() {
    const keys = await DB.allKeys("images");
    for (const k of keys) { const v = await DB.get("images", k); if (v) set(k, v); }
    for (const [k, v] of Object.entries(DEMO_IMAGES)) if (!urls.has(k)) set(k, v);
  }
  return { set, drop, loadAll, url: id => (id && urls.get(id)) || "", has: id => urls.has(id) };
})();

function productVisual(p, cls = "product-img") {
  const u = ImageCache.url(p.imageId);
  if (u) return `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" decoding="async">`;
  return `<div class="${cls === "product-img" ? "ph" : cls + " ph"}" style="background:${phColor(p.name)}">${esc(initials(p.name))}</div>`;
}

/* ---------- Root render ---------- */
let lastTab = null;
function render() {
  const root = $("#app"); if (!root) return;
  if (!state.ready) { root.innerHTML = `<div class="boot"><div><div class="logo">${icon("flame")}</div>Memuat ${esc(APP.name)}…</div></div>`; return; }
  if (!state.settings.storeName) { root.innerHTML = `<div class="phone">${renderOnboarding()}<div id="overlay-root"></div><div id="dialog-root"></div><div id="toast-root"></div></div>`; renderOverlay(); drawToast(); return; }
  if (state.ui.locked) { root.innerHTML = `<div class="phone">${renderLock()}<div id="overlay-root"></div><div id="dialog-root"></div><div id="toast-root"></div></div>`; drawToast(); return; }
  let phone = $(".phone.main", root);
  if (!phone) {
    root.innerHTML = `<div class="phone main"><div id="screen-root" class="screen-root" style="flex:1;min-height:0;display:flex;flex-direction:column"></div><div id="nav-root"></div><div id="cartbar-root"></div><div id="overlay-root"></div><div id="dialog-root"></div><div id="banner-root"></div><div id="toast-root"></div></div>`;
    phone = $(".phone.main", root);
  }
  renderScreen(); renderNav(); renderOverlay(); drawToast(); drawBanner();
}
function renderScreen() {
  const host = $("#screen-root"); if (!host) return render();
  const prev = $(".screen", host); const keep = prev && lastTab === state.ui.tab ? prev.scrollTop : 0;
  const tab = visibleTabs().includes(state.ui.tab) ? state.ui.tab : "pos";
  state.ui.tab = tab;
  const html = tab === "pos" ? renderPOS() : tab === "history" ? renderReports() : tab === "catalog" ? renderCatalog() : renderSettings();
  host.innerHTML = html;
  const scr = $(".screen", host); if (scr && keep) scr.scrollTop = keep;
  lastTab = tab;
  updateCartBar();
  if (tab === "history") ensureReport();
}
function visibleTabs() { return state.settings.staffMode && !state.ui.owner ? ["pos", "history", "settings"] : ["pos", "history", "catalog", "settings"]; }
function renderNav() {
  const host = $("#nav-root"); if (!host) return;
  const tabs = visibleTabs();
  const meta = { pos: ["home", "Kasir"], history: ["chart", "Laporan"], catalog: ["box", T().model === "stock" ? "Produk" : "Menu"], settings: ["gear", "Pengaturan"] };
  const dot = { catalog: lowStockItems().length > 0, settings: backupOverdue() };
  host.innerHTML = `<nav class="bottom-nav" style="--cols:${tabs.length}" aria-label="Navigasi utama">${tabs.map(t => `<button class="${state.ui.tab === t ? "active" : ""}" data-action="nav" data-value="${t}" aria-current="${state.ui.tab === t ? "page" : "false"}"><span class="nav-ico">${icon(meta[t][0])}</span>${meta[t][1]}${dot[t] ? '<i class="nav-dot"></i>' : ""}</button>`).join("")}</nav>`;
}
function go(tab) {
  if (state.ui.tab === tab) { const s = $(".screen"); if (s) s.scrollTo({ top: 0, behavior: "smooth" }); return; }
  if (state.ui.modal) closeSheet();
  if (tab !== "pos" && !tabHist) tabHist = histPush("tab");
  state.ui.tab = tab; renderScreen(); renderNav();
  if (tab === "pos" && tabHist) { tabHist = false; histBack(); }
}

/* ---------- Overlay (sheets + dialogs) ---------- */
/* Android back button / gesture closes the open sheet (and returns to Kasir from other tabs)
   instead of leaving the app. Our own history.back() calls are ignored by the listener. */
let sheetHist = false, tabHist = false, ignorePop = 0;
function histPush(kind) { try { history.pushState({ nyala: kind }, ""); return true; } catch (_) { return false; } }
function histBack() { ignorePop++; try { history.back(); } catch (_) { ignorePop--; } }
function openSheet(type, data = {}) {
  state.ui.modal = { type, ...data }; renderOverlay();
  if (!sheetHist) sheetHist = histPush("sheet");
}
function closeSheet(fromPop = false) {
  state.ui.modal = null; renderOverlay();
  if (sheetHist) { sheetHist = false; if (!fromPop) histBack(); }
}
window.addEventListener("popstate", () => {
  if (ignorePop > 0) { ignorePop--; return; }
  if ($("#cust-root .cust-display")) { closeCustomerDisplay(); if (state.ui.modal) sheetHist = histPush("sheet"); return; }
  if (state.ui.dialog) { resolveDialog(false); if (state.ui.modal) sheetHist = histPush("sheet"); else if (sheetHist) sheetHist = false; return; }
  if (state.ui.modal) { closeSheet(true); return; }
  if (tabHist) { tabHist = false; if (state.ui.tab !== "pos" && state.ready) { state.ui.tab = "pos"; renderScreen(); renderNav(); } }
});
function renderOverlay() {
  const host = $("#overlay-root");
  if (host) {
    const m = state.ui.modal;
    const body = host.querySelector(".sheet-body"); const keep = body && host.dataset.type === m?.type ? body.scrollTop : 0;
    const fresh = host.dataset.type !== (m?.type || "");
    host.innerHTML = m && SHEETS[m.type] ? sheetFrame(m, SHEETS[m.type](m)) : "";
    if (fresh) host.querySelector(".overlay")?.classList.add("enter"); // animate only when a new sheet opens (no jank on re-render)
    host.dataset.type = m?.type || "";
    const nb = host.querySelector(".sheet-body"); if (nb && keep) nb.scrollTop = keep;
    const auto = $("[data-autofocus]", host); if (auto && !("ontouchstart" in window)) auto.focus();
  }
  renderDialogRoot();
}
function renderDialogRoot() {
  const host = $("#dialog-root"); if (!host) return;
  host.innerHTML = state.ui.dialog ? renderDialog(state.ui.dialog) : "";
  const inp = $("#dlg-input", host); if (inp) { inp.focus(); if (inp.select) inp.select(); }
}
/** body: {title, icon, body, foot, tall, cls} */
function sheetFrame(m, s) {
  if (!s) return "";
  return `<div class="overlay" data-action="${s.noBackdropClose ? "" : "backdrop"}" role="presentation"><div class="sheet ${s.tall ? "tall" : ""} ${s.cls || ""}" role="dialog" aria-modal="true" aria-label="${esc(s.title)}">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h3>${s.icon ? `<span class="hi">${icon(s.icon)}</span>` : ""}<span>${esc(s.title)}</span></h3><button class="close-btn" data-action="close-sheet" aria-label="Tutup">${icon("x")}</button></div>
    <div class="sheet-body">${s.body}</div>
    ${s.foot ? `<div class="sheet-foot">${s.foot}</div>` : ""}
  </div></div>`;
}
const SHEETS = {}; // filled by feature modules

/* ---------- Dialogs ---------- */
function confirmDialog({ title, text, ok = "Ya, lanjutkan", cancel = "Batal", danger = true, icon: ic = "alert", input = null, pin = false, value = "", optional = false, mode = "text" }) {
  if (state.ui.dialog) state.ui.dialog.resolve(false);
  return new Promise(resolve => { state.ui.dialog = { title, text, ok, cancel, danger, ic, input, pin, value, optional, mode, resolve }; renderDialogRoot(); });
}
function renderDialog(d) {
  return `<div class="dialog-wrap" role="alertdialog" aria-modal="true"><div class="dialog">
    <div class="d-ico" style="${d.danger ? "" : "background:var(--green-soft);color:var(--green)"}">${icon(d.ic)}</div>
    <h3>${esc(d.title)}</h3><p>${d.text}</p>
    ${d.input ? `<input id="dlg-input" class="input" ${d.pin ? 'type="password" inputmode="numeric" autocomplete="off" maxlength="6"' : `type="text" inputmode="${d.mode === "decimal" ? "decimal" : "text"}" maxlength="120"`} placeholder="${esc(d.input)}" value="${esc(d.value)}">` : ""}
    <div id="dlg-err" class="help err" style="margin:-4px 0 10px;display:none"></div>
    <div class="actions"><button class="btn soft" data-action="dlg-cancel">${esc(d.cancel)}</button><button class="btn ${d.danger ? "danger" : "success"}" data-action="dlg-ok">${esc(d.ok)}</button></div>
  </div></div>`;
}
function resolveDialog(ok) {
  const d = state.ui.dialog; if (!d) return;
  const val = $("#dlg-input")?.value ?? "";
  if (ok && d.input && !d.optional && !val.trim()) { const e = $("#dlg-err"); if (e) { e.textContent = d.pin ? "Masukkan PIN." : "Wajib diisi."; e.style.display = "block"; } return; }
  state.ui.dialog = null; renderDialogRoot(); d.resolve(ok ? (d.input ? val : true) : false);
}
/** ask owner PIN when set; returns true when allowed */
async function requireOwner(reason = "Masukkan PIN pemilik untuk melanjutkan.") {
  if (!state.settings.pinHash) return true;
  if (state.ui.owner && !state.settings.staffMode) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    const pin = await confirmDialog({ title: "PIN Pemilik", text: esc(reason), ok: "Lanjut", danger: false, icon: "lock", input: "PIN 4–6 digit", pin: true });
    if (pin === false) return false;
    if (await checkPin(pin)) return true;
    toast("PIN salah.", true);
  }
  return false;
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(message, error = false, action = null) {
  state.toast = { message, error, action };
  drawToast(); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = null; drawToast(); }, error ? 3600 : 2300);
  if (error) haptic([20, 40, 20]);
}
function drawToast() {
  const host = $("#toast-root"); if (!host) return;
  const t = state.toast;
  host.innerHTML = t ? `<div class="toast ${t.error ? "error" : ""}" role="status" aria-live="polite"><span class="ti">${icon(t.error ? "alert" : "check")}</span><span>${esc(t.message)}</span>${t.action ? `<button class="tact" data-action="${esc(t.action.action)}">${esc(t.action.label)}</button>` : ""}</div>` : "";
}
/* ---------- Banner (app update) ---------- */
let updateReady = null;
function drawBanner() {
  const host = $("#banner-root"); if (!host) return;
  host.innerHTML = updateReady ? `<div class="update-bar">${icon("sparkle")}<span>Versi baru siap dipakai.</span><button data-action="apply-update">Muat ulang</button></div>` : "";
}
function backupOverdue() {
  if (!state.meta.hasSales) return false;
  const last = state.meta.lastBackupAt ? new Date(state.meta.lastBackupAt) : new Date(state.meta.firstRun);
  return (Date.now() - last) / 864e5 > 7;
}

/* ---------- Small render helpers ---------- */
function switchHtml(id, on, extra = "") { return `<label class="switch"><input type="checkbox" id="${id}" ${on ? "checked" : ""} ${extra}><i></i></label>`; }
function proTag() { return isPro() ? "" : `<span class="tag blue">PRO</span>`; }
function emptyState(ic, title, text, btn = "") { return `<div class="empty">${icon(ic)}<b>${esc(title)}</b><span>${text}</span>${btn}</div>`; }
function marginTag(price, hpp) { const m = marginInfo(price, hpp); return `<span class="tag ${m.level}">${m.pct}%</span>`; }
