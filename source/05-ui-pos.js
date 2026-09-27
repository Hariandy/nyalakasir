/* =====================================================================
   05-ui-pos.js — Kasir screen, cart sheet, payment sheet, success/receipt,
   print & share, held orders, discount.
   ===================================================================== */
function greeting() {
  const h = new Date().getHours(); const w = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
  const who = state.settings.staffMode && !state.ui.owner ? "" : (state.settings.ownerName || "").split(" ")[0];
  return `${w}${who ? ", " + who : ""} 👋`;
}
function planPill() {
  const l = state.lic;
  if (l.tier === "PRO") return `<span class="pill pro">${icon("crown")}PRO</span>`;
  if (l.tier === "TRIAL") return `<button class="pill trial" data-action="open-pro" aria-label="Masa coba PRO, sisa ${l.daysLeft} hari">${icon("crown")}${l.daysLeft} hr</button>`;
  return `<span class="pill ok"><i></i>Siap</span>`;
}
function storeIcon() { const u = ImageCache.url(state.settings.logoId); return `<div class="store-icon">${u ? `<img src="${esc(u)}" alt="">` : icon("store")}</div>`; }

function posProducts() {
  const q = state.ui.search.trim().toLowerCase();
  const top = state.ui.cat === TOP_CAT;
  const list = state.catalog.products.filter(p => p.active !== false && (state.ui.cat === "Semua" || top || p.category === state.ui.cat) && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase() === q)));
  if (!top) return list;
  const pop = popularity();
  return list.filter(p => pop[p.id]).sort((a, b) => (pop[b.id] || 0) - (pop[a.id] || 0)).slice(0, 12);
}
function productCardHtml(p) {
  const inCart = cartQtyAll(p.id);
  const left = portionsLeft(p);
  const tag = left === Infinity ? "" : left <= 0 ? `<span class="stock-tag out">Habis</span>` : left <= 5 ? `<span class="stock-tag low">Sisa ${left}</span>` : "";
  return `<button class="product-card ${inCart ? "in-cart" : ""}" data-action="add-cart" data-pid="${p.id}" aria-label="Tambah ${esc(p.name)}">
    ${productVisual(p)}${tag}${inCart ? `<span class="qty-badge">${fmtQty(inCart)}</span>` : ""}
    <div class="product-body"><div class="product-name">${esc(p.name)}</div><div class="product-price num">${rp(p.price)}</div></div></button>`;
}
function renderProductGrid() {
  const list = posProducts();
  if (!state.catalog.products.length) return emptyState("box", "Belum ada menu", "Tambahkan produk pertama Anda di tab Menu.", state.ui.owner || !state.settings.staffMode ? `<button class="btn primary sm" data-action="nav" data-value="catalog">${icon("plus")} Tambah Produk</button>` : "");
  if (!list.length) return emptyState("search", "Produk tidak ditemukan", "Coba kata pencarian atau kategori lain.");
  return `<div class="product-grid">${list.map(productCardHtml).join("")}</div>`;
}
function renderPOS() {
  const s = state.settings;
  const cats = ["Semua", ...(state.meta.hasSales ? [TOP_CAT] : []), ...state.catalog.cats.filter(c => state.catalog.products.some(p => p.category === c && p.active !== false))];
  if (!cats.includes(state.ui.cat)) state.ui.cat = "Semua";
  const low = state.ui.owner ? lowStockItems() : [];
  const notices = [];
  if (state.storageError) notices.push(`<div class="notice danger">${icon("alert")}<span>${esc(state.storageError)}</span></div>`);
  if (DB.mode === "local") notices.push(`<div class="notice warn">${icon("alert")}<span>Mode penyimpanan terbatas di browser ini. Rutin buat cadangan.</span></div>`);
  for (const n of state.meta.notices || []) notices.push(`<div class="notice info">${icon("info")}<span>${esc(n.text)}</span><button class="act" data-action="dismiss-notice" data-id="${esc(n.id)}">Oke</button></div>`);
  if (low.length) notices.push(`<div class="notice warn">${icon("alert")}<span><b>${low.length} ${esc(T().itemWord)}</b> hampir/sudah habis.</span><button class="act" data-action="goto-stock">Cek</button></div>`);
  if (state.lic.tier === "TRIAL" && state.lic.daysLeft <= 3) notices.push(`<div class="notice info">${icon("crown")}<span>Masa coba PRO tinggal <b>${state.lic.daysLeft} hari</b>.</span><button class="act" data-action="open-pro">Lihat paket</button></div>`);
  const held = state.held.length ? `<div class="held-row">${state.held.map(h => `<button class="held-chip" data-action="resume-held" data-id="${esc(h.id)}">${icon("pause")}${esc(h.name)} · ${rpShort(heldTotal(h))}</button>`).join("")}</div>` : "";
  return `<div class="screen" id="pos-screen">
    <header class="header">
      <div class="brand-row"><div class="store-brand">${storeIcon()}<div style="min-width:0"><div class="store-name">${esc(s.storeName)}</div><div class="store-mode">${esc(greeting())}${state.shift ? ` · <span class="dot-live"></span>shift` : ""}</div></div></div><div style="display:flex;gap:6px;align-items:center;flex:none">${targetChip()}${planPill()}</div></div>
      <div class="search">${icon("search")}<input id="pos-search" type="search" value="${esc(state.ui.search)}" placeholder="${state.settings.type === "retail" ? "Cari / scan barcode…" : "Cari menu…"}" autocomplete="off" enterkeyhint="search" aria-label="Cari produk">${scanSupported() ? `<button class="x" data-action="scan-open" aria-label="Scan barcode dengan kamera">${icon("scan")}</button>` : ""}<button class="x" data-action="clear-search" aria-label="Hapus pencarian" style="${state.ui.search ? "" : "display:none"}">${icon("x")}</button></div>
      <div class="chips" role="tablist">${cats.map(c => `<button class="chip ${state.ui.cat === c ? "active" : ""}" data-action="category" data-value="${esc(c)}" role="tab" aria-selected="${state.ui.cat === c}">${esc(c)}</button>`).join("")}</div>
    </header>
    ${gettingStartedHtml()}${promoBannerHtml()}${notices.join("")}${held}
    <div class="content" id="pos-grid">${renderProductGrid()}</div>
  </div>`;
}
function refreshGrid() { const g = $("#pos-grid"); if (g) g.innerHTML = renderProductGrid(); }

/* ---------- Cart bar ---------- */
function updateCartBar(bump = false) {
  const host = $("#cartbar-root"); if (!host) return;
  const scr = $("#pos-screen");
  if (state.ui.tab !== "pos" || !state.cart.lines.length) { host.innerHTML = ""; scr?.classList.remove("has-cart"); return; }
  const t = computeTotals();
  host.innerHTML = `<div class="cartbar" ${bump ? 'style="animation:none"' : ""}>
    <button class="cart-info" data-action="open-cart" aria-label="Lihat keranjang"><span class="cart-icon">${icon("bag")}<span class="badge ${bump ? "bump" : ""}">${fmtQty(t.count)}</span></span>
      <span style="min-width:0"><span class="cart-label">Total Tagihan ${icon("chev")}</span><span class="cart-total num">${rp(t.total)}</span></span></button>
    <button class="pay-btn" data-action="open-payment">Bayar ${icon("arrow")}</button></div>`;
  scr?.classList.add("has-cart");
}
function addToCart(pid) {
  const p = findProduct(pid); if (!p) return;
  if (productGroups(p).length) return openPicker(pid);
  if (portionsLeft(p) <= cartQtyAll(pid) && state.settings.blockOversell && stockEnabled()) { toast(`Stok untuk ${p.name} tidak cukup.`, true); return; }
  const line = state.cart.lines.find(l => l.pid === pid && !l.note && !(l.opts || []).length);
  if (line) line.qty = scaledToNumber((toScaled(line.qty) ?? 0n) + SCALE); else state.cart.lines.push({ id: uid("l"), pid, qty: 1, note: "" });
  Persist.mark("cart"); haptic(8);
  // targeted DOM update (keeps scroll & images)
  const card = $(`.product-card[data-pid="${pid}"]`);
  if (card) {
    card.classList.add("in-cart");
    let b = $(".qty-badge", card); if (!b) { b = document.createElement("span"); b.className = "qty-badge"; card.insertBefore(b, $(".product-body", card)); }
    b.textContent = fmtQty(cartQtyAll(pid)); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  }
  updateCartBar(true);
}
function setLineQty(lineId, qty) {
  const l = state.cart.lines.find(x => x.id === lineId); if (!l) return;
  const q = normQty(qty);
  if (q === null || q <= 0) state.cart.lines = state.cart.lines.filter(x => x !== l); else l.qty = q;
  Persist.mark("cart");
  // emptied cart: forget discount/member and detach from the held order (held copy stays in the list — BUG-H1)
  if (!state.cart.lines.length) { state.cart = emptyCart(); Persist.mark("cart"); closeSheet(); }
  else renderOverlay();
  refreshGrid(); updateCartBar();
}
function heldTotal(h) { return computeTotals({ lines: h.lines, discount: h.discount }).total; }

/* ---------- Cart sheet ---------- */
function totalsRows(t, compact = false) {
  const rows = [];
  if (t.discount || t.service || t.tax || t.reward || t.rounding || t.promo) rows.push(`<div class="kv"><span>Subtotal</span><b>${rp(t.subtotal)}</b></div>`);
  if (t.promo) rows.push(`<div class="kv"><span>⚡ ${esc(t.promoInfo.name)} ${t.promoInfo.bp / 100}%</span><b style="color:var(--red)">−${rp(t.promo).slice(3)}</b></div>`);
  if (t.reward) rows.push(`<div class="kv"><span>🎁 Hadiah stamp</span><b style="color:var(--red)">−${rp(t.reward).slice(3)}</b></div>`);
  if (t.discount) rows.push(`<div class="kv"><span>Diskon${state.cart.discount?.type === "pct" ? " " + (state.cart.discount.value / 100).toString().replace(".", ",") + "%" : ""}</span><b style="color:var(--red)">−${rp(t.discount).slice(3)}</b></div>`);
  if (t.service) rows.push(`<div class="kv"><span>Biaya layanan</span><b>${rp(t.service)}</b></div>`);
  if (t.tax) rows.push(`<div class="kv"><span>${esc(state.settings.taxLabel || "Pajak")}</span><b>${rp(t.tax)}</b></div>`);
  if (t.rounding) rows.push(`<div class="kv"><span>Pembulatan</span><b>−${rp(t.rounding).slice(3)}</b></div>`);
  rows.push(`<div class="kv total"><span>Total</span><b>${rp(t.total)}</b></div>`);
  return rows.join("");
}
SHEETS.cart = () => {
  const t = computeTotals();
  const owner = state.ui.owner;
  const lines = t.lines.map(x => `<div class="cart-line">
      <div style="min-width:0"><div class="cart-name">${esc(x.p.name)}</div>${x.ch.length ? `<div class="cart-opts">${esc(optionsLabel(x.ch))}</div>` : ""}<div class="cart-meta">${rp(x.unitPrice)}${owner && !state.settings.staffMode ? ` · ${T().cost} ${rp(x.unitHpp)}` : ""}</div>${x.line.note ? `<div class="cart-note">✎ ${esc(x.line.note)}</div>` : ""}</div>
      <div class="cart-line-total num">${rp(x.lineTotal)}</div>
      <div class="stepper" style="grid-column:1/-1">
        <button data-action="line-minus" data-id="${x.line.id}" aria-label="Kurangi">${icon("minus")}</button>
        <button class="q num" data-action="line-qty" data-id="${x.line.id}" aria-label="Ubah jumlah" style="width:auto;background:none">${fmtQty(x.line.qty)}</button>
        <button data-action="line-plus" data-id="${x.line.id}" aria-label="Tambah">${icon("plus")}</button>
        <button class="note-btn" data-action="line-note" data-id="${x.line.id}">${icon("note")}Catatan</button>
        <button class="del" data-action="line-del" data-id="${x.line.id}" aria-label="Hapus item">${icon("trash")}</button>
      </div></div>`).join("");
  const disc = state.cart.discount;
  const body = `${lines}
    <div style="margin-top:12px">${customerCartHtml()}</div>
    ${state.settings.askCustomer && !state.cart.customerId ? `<div class="form-label">Nama / No. meja <small>opsional</small></div><input id="cart-customer" class="input" value="${esc(state.cart.customer)}" maxlength="40" placeholder="Contoh: Budi / Meja 4" autocomplete="off">` : ""}
    <div class="disc-box"><div class="brand-row"><div><b style="font-size:14px">${icon("tag", "").replace("<svg", '<svg style="width:16px;height:16px;display:inline;vertical-align:-3px;margin-right:6px"')}Diskon</b> ${proTag()}<div class="help" style="margin-top:2px">${disc ? (disc.type === "pct" ? (disc.value / 100).toString().replace(".", ",") + "% dari subtotal" : rp(disc.value)) : "Belum ada diskon"}</div></div>
      <div style="display:flex;gap:6px">${disc ? `<button class="btn sm soft" data-action="remove-discount">Hapus</button>` : ""}<button class="btn sm outline" data-action="open-discount">${disc ? "Ubah" : "Atur"}</button></div></div></div>
    <div style="margin-top:12px">${totalsRows(t)}${owner && !state.settings.staffMode ? `<div class="kv"><span>Perkiraan laba kotor</span><b style="color:var(--green)">${rp(t.profit)}</b></div>` : ""}</div>`;
  return { title: `Keranjang (${fmtQty(t.count)} item)`, icon: "bag", tall: false, body,
    foot: `<button class="btn outline" data-action="hold-order" title="Simpan pesanan">${icon("pause")}Simpan</button><button class="btn success" data-action="open-payment">Bayar ${rp(t.total)}</button>` };
};
SHEETS.discount = (m) => {
  const d = state.cart.discount || { type: "pct", value: 0 };
  const type = m.dtype || d.type;
  const val = m.dval ?? (d.value ? (type === "pct" ? String(d.value / 100).replace(".", ",") : groupDigits(d.value)) : "");
  return { title: "Diskon Pesanan", icon: "tag", body: `
    <div class="seg"><button class="${type === "pct" ? "on" : ""}" data-action="disc-type" data-value="pct">Persen (%)</button><button class="${type === "amt" ? "on" : ""}" data-action="disc-type" data-value="amt">Nominal (Rp)</button></div>
    <div class="form-label">${type === "pct" ? "Besar diskon (%)" : "Potongan (Rp)"}</div>
    <div class="input-affix ${type === "pct" ? "suffix" : ""}"><span>${type === "pct" ? "%" : "Rp"}</span><input id="disc-value" class="input money" inputmode="${type === "pct" ? "decimal" : "numeric"}" value="${esc(val)}" placeholder="0" autocomplete="off"></div>
    <div class="quick" style="margin-top:10px">${(type === "pct" ? ["5", "10", "15", "20", "25", "50"] : ["2000", "5000", "10000", "15000", "20000", "50000"]).map(v => `<button data-action="disc-quick" data-value="${v}">${type === "pct" ? v + "%" : rp(Number(v)).slice(3)}</button>`).join("")}</div>
    <div class="help">Diskon mengurangi omzet & laba di laporan. Pajak/layanan dihitung setelah diskon.</div>`,
    foot: `<button class="btn soft" data-action="open-cart">Kembali</button><button class="btn primary" data-action="apply-discount">Terapkan</button>` };
};

/* ---------- Payment sheet ---------- */
SHEETS.payment = (m) => {
  const t = computeTotals();
  const enabled = METHODS.filter(x => state.settings.methods[x[0]] !== false);
  const method = enabled.some(x => x[0] === m.method) ? m.method : (enabled[0]?.[0] || "Tunai");
  m.method = method;
  const cash = money(m.cash);
  const enough = method !== "Tunai" || cash >= t.total;
  const qris = ImageCache.url(state.settings.qrisImageId);
  const br = [];
  if (t.promo) br.push(`${esc(t.promoInfo.name)} −${rp(t.promo).slice(3)}`);
  if (t.discount) br.push(`Diskon −${rp(t.discount).slice(3)}`);
  if (t.service) br.push(`Layanan ${rp(t.service)}`);
  if (t.tax) br.push(`${esc(state.settings.taxLabel || "Pajak")} ${rp(t.tax)}`);
  if (t.reward) br.push(`Hadiah stamp −${rp(t.reward).slice(3)}`);
  if (t.rounding) br.push(`Pembulatan −${rp(t.rounding).slice(3)}`);
  let detail = "";
  if (method === "Tunai") {
    detail = `<div class="cash-box"><div class="pay-label" style="margin:0 0 8px">Uang diterima</div>
      <div class="cash-input-wrap"><span class="rp">Rp</span><input id="cash-input" class="cash-input" type="text" inputmode="numeric" autocomplete="off" enterkeyhint="done" value="${cash ? groupDigits(cash) : ""}" placeholder="0" aria-label="Uang diterima"><button class="cash-clear" data-action="cash-clear" aria-label="Kosongkan">${icon("x")}</button></div>
      <div class="quick">${quickCash(t.total).map(v => `<button class="${cash === v ? "active" : ""}" data-action="quick-cash" data-value="${v}">${v === t.total ? "Uang Pas" : rp(v).slice(3)}</button>`).join("")}</div>
      <div id="pay-change" class="change ${enough ? "good" : "bad"}"><span>${enough ? "Kembalian" : "Uang kurang"}</span><strong class="num">${rp(enough ? cash - t.total : t.total - cash)}</strong></div></div>`;
  } else if (method === "QRIS") {
    detail = qris ? `<div class="noncash" style="flex-direction:column;text-align:center"><div><b>Minta pelanggan scan QRIS</b><p>Pastikan notifikasi pembayaran <b>${rp(t.total)}</b> sudah masuk sebelum memproses.</p></div><img class="qris-img" src="${esc(qris)}" alt="QRIS toko"></div>`
      : `<div class="noncash"><div class="ni">${icon("qr")}</div><div><strong>QRIS</strong><p>Pastikan pembayaran <b>${rp(t.total)}</b> sudah masuk. ${state.ui.owner ? `<a href="#" data-action="open-payset" style="color:var(--blue);font-weight:750">Unggah gambar QRIS toko</a> agar bisa ditampilkan di sini.` : ""}</p></div></div>`;
  } else if (method === "Transfer") {
    detail = `<div class="noncash"><div class="ni">${icon("transfer")}</div><div><strong>Transfer bank / e-wallet</strong><p>${state.settings.transferInfo ? `Tujuan: <b>${esc(state.settings.transferInfo)}</b><br>` : ""}Cek mutasi masuk <b>${rp(t.total)}</b> sebelum memproses.</p></div></div>`;
  } else {
    detail = `<div class="noncash"><div class="ni">${icon("card")}</div><div><strong>Debit / Kredit (EDC)</strong><p>Proses <b>${rp(t.total)}</b> di mesin EDC, lalu tekan Proses setelah struk EDC keluar.</p></div></div>`;
  }
  const body = `<div class="pay-total"><span>Total tagihan (${fmtQty(t.count)} item)${state.cart.customer ? " · " + esc(state.cart.customer) : ""}</span><strong class="num">${rp(t.total)}</strong>${br.length ? `<div class="pay-breakdown">${br.join("<span>·</span>")}</div>` : ""}</div>
    <div class="pay-label">Metode bayar</div>
    <div class="methods">${enabled.map(([v, ic, label]) => `<button class="method ${method === v ? "active" : ""}" data-action="pay-method" data-value="${v}" aria-pressed="${method === v}">${icon(ic)}<span>${label}</span>${method === v ? '<i class="dot"></i>' : ""}</button>`).join("")}</div>
    ${detail}`;
  return { title: "Pembayaran", icon: "wallet", body, noBackdropClose: true,
    foot: `<button class="btn outline" data-action="cust-display" aria-label="Tampilkan ke pelanggan" style="height:56px;padding:0 14px">${icon("phone")}</button><button id="pay-submit" class="btn success" data-action="checkout" ${enough ? "" : "disabled"} style="height:56px;font-size:16px;flex:1">${icon("check")}<span>Proses Pembayaran</span></button>` };
};
function updatePaymentLive() {
  const m = state.ui.modal; if (m?.type !== "payment") return;
  const t = computeTotals(), cash = money(m.cash), enough = m.method !== "Tunai" || cash >= t.total;
  const ch = $("#pay-change");
  if (ch) { ch.className = "change " + (enough ? "good" : "bad"); ch.innerHTML = `<span>${enough ? "Kembalian" : "Uang kurang"}</span><strong class="num">${rp(enough ? cash - t.total : t.total - cash)}</strong>`; }
  const b = $("#pay-submit"); if (b) b.disabled = !enough;
  $$("[data-action=quick-cash]").forEach(x => x.classList.toggle("active", Number(x.dataset.value) === cash));
}
async function doCheckout() {
  const m = state.ui.modal; if (m?.type !== "payment") return;
  const btn = $("#pay-submit"); if (btn) { btn.disabled = true; btn.innerHTML = `<span>Menyimpan…</span>`; }
  const res = await checkout({ method: m.method, cash: m.cash });
  if (!res.ok) { toast(res.msg, true); if (state.ui.modal?.type === "payment") renderOverlay(); return; }
  chime(); haptic([10, 30, 10]);
  state.ui.modal = { type: "success", tx: res.tx };
  renderOverlay(); renderScreen(); renderNav();
  if (res.tx._targetHit) { confetti(); toast("🎯 Target hari ini tercapai! Mantap!"); }
  if (insightsCache) insightsCache.stale = true;
}

/* ---------- Success & receipt ---------- */
function receiptInner(t, print = false) {
  const st = t.store || {}; const logo = print && ImageCache.url(state.settings.logoId);
  const L = (a, b, cls = "") => `<div class="r-line ${cls}"><span>${a}</span><span>${b}</span></div>`;
  return `${logo ? `<img src="${esc(logo)}" alt="">` : ""}<div class="r-center r-store">${esc(st.name || state.settings.storeName)}</div>
    ${st.address ? `<div class="r-center r-muted">${esc(st.address)}</div>` : ""}${st.phone ? `<div class="r-center r-muted">${esc(st.phone)}</div>` : ""}
    <div class="r-center r-muted">${esc(fmtDateTime(t.date))}${t.no ? ` · #${String(Number(t.no) || 0).padStart(3, "0")}` : ""}</div>
    <div class="r-center r-muted">${esc(t.id)}</div>${t.customer ? `<div class="r-center r-muted">Pelanggan: ${esc(t.customer)}</div>` : ""}
    <div class="r-sep"></div>
    ${(t.items || []).map(i => `<div class="r-line"><span>${esc(i.name)}${i.opts ? `<br><small>${esc(i.opts)}</small>` : ""}${i.note ? `<br><small>(${esc(i.note)})</small>` : ""}<br>${fmtQty(i.qty)} x ${groupDigits(i.price)}</span><span>${groupDigits(i.lineTotal ?? i.price * i.qty)}</span></div>`).join("")}
    <div class="r-sep"></div>
    ${t.discount || t.service || t.tax || t.reward || t.rounding || t.promo ? L("Subtotal", groupDigits(t.subtotal)) : ""}${t.promo ? L("Promo " + esc(t.promo.name), "-" + groupDigits(t.promo.amount)) : ""}
    ${t.discount ? L("Diskon", "-" + groupDigits(t.discount.amount)) : ""}${t.reward ? L("Hadiah stamp", "-" + groupDigits(t.reward)) : ""}${t.service ? L("Layanan", groupDigits(t.service)) : ""}${t.tax ? L(esc(t.taxLabel || "Pajak"), groupDigits(t.tax)) : ""}${t.rounding ? L("Pembulatan", "-" + groupDigits(t.rounding)) : ""}
    ${L("TOTAL", rp(t.total), "r-total")}
    ${L(esc(methodLabel(t.method)), rp(t.method === "Tunai" ? t.cash : t.total))}
    ${t.method === "Tunai" ? L("Kembali", rp(t.change)) : ""}
    ${t.cust && t.cust.target ? `<div class="r-sep"></div><div class="r-center">Kartu stamp ${esc(t.cust.name)}: ${stampDots(t.cust.stamps, t.cust.target)} ${Number(t.cust.stamps) || 0}/${Number(t.cust.target) || 0}</div>` : ""}
    ${t.status === "void" ? `<div class="r-sep"></div><div class="r-center r-total">*** DIBATALKAN ***</div><div class="r-center r-muted">${esc(t.voidReason || "")}</div>` : ""}
    <div class="r-sep"></div><div class="r-center r-muted">${esc(st.footer || state.settings.footer || "Terima kasih")}</div>`;
}
function receiptText(t) {
  const st = t.store || {}; const out = [];
  out.push(`*${st.name || state.settings.storeName}*`);
  if (st.address) out.push(st.address);
  out.push(`${fmtDateTime(t.date)}${t.no ? ` · #${String(t.no).padStart(3, "0")}` : ""}`, t.id, "------------------------------");
  for (const i of t.items || []) out.push(`${i.name}${i.opts ? ` [${i.opts}]` : ""}${i.note ? ` (${i.note})` : ""}`, `  ${fmtQty(i.qty)} x ${rp(i.price)} = ${rp(i.lineTotal ?? i.price * i.qty)}`);
  out.push("------------------------------");
  if (t.promo) out.push(`Promo ${t.promo.name}: -${rp(t.promo.amount)}`);
  if (t.discount) out.push(`Diskon: -${rp(t.discount.amount)}`);
  if (t.service) out.push(`Layanan: ${rp(t.service)}`);
  if (t.reward) out.push(`Hadiah stamp: -${rp(t.reward)}`);
  if (t.tax) out.push(`${t.taxLabel || "Pajak"}: ${rp(t.tax)}`);
  if (t.rounding) out.push(`Pembulatan: -${rp(t.rounding)}`);
  out.push(`*TOTAL: ${rp(t.total)}*`, `Bayar (${methodLabel(t.method)}): ${rp(t.method === "Tunai" ? t.cash : t.total)}`);
  if (t.method === "Tunai") out.push(`Kembali: ${rp(t.change)}`);
  if (t.cust && t.cust.target) out.push("", `Kartu stamp: ${"●".repeat(Math.min(t.cust.stamps, t.cust.target))}${"○".repeat(Math.max(0, t.cust.target - t.cust.stamps))} ${Number(t.cust.stamps) || 0}/${Number(t.cust.target) || 0}${t.cust.stamps >= t.cust.target ? " — hadiah siap dipakai! 🎁" : ""}`);
  if (t.status === "void") out.push("*** TRANSAKSI DIBATALKAN ***");
  out.push("", st.footer || state.settings.footer || "Terima kasih");
  return out.join("\n");
}
SHEETS.success = (m) => {
  const t = m.tx;
  return { title: "Pembayaran Berhasil", icon: "check", noBackdropClose: true, body: `
    <div class="success-hero"><div class="success-check">${icon("check")}</div><h3>${rp(t.total)}</h3>
      <div class="order-no">Pesanan #${String(Number(t.no) || 0).padStart(3, "0")}${t.customer ? " · " + esc(t.customer) : ""}</div>
      ${t.method === "Tunai" ? `<div class="change-big">Kembalian<b class="num">${rp(t.change)}</b></div>` : `<div class="change-big">Dibayar via <b style="font-size:18px;color:var(--ink)">${esc(methodLabel(t.method))}</b></div>`}
      ${t.cust?.target ? `<div class="stamp-card"><span class="stamps">${stampDots(t.cust.stamps, t.cust.target)}</span><b>${esc(t.cust.name)}: ${Number(t.cust.stamps) || 0}/${Number(t.cust.target) || 0} stamp${t.cust.earned ? " (+1)" : ""}</b>${t.cust.used ? "<small>🎁 Hadiah dipakai</small>" : t.cust.stamps >= t.cust.target ? "<small>🎁 Hadiah siap dipakai di kunjungan berikut</small>" : ""}</div>` : ""}</div>
    <div class="actions-3"><button class="btn outline" data-action="print-tx">${icon("printer")}Cetak</button><button class="btn outline" data-action="wa-tx">${icon("wa")}WhatsApp</button><button class="btn outline" data-action="share-tx">${icon("share")}Bagikan</button></div>
    <div class="receipt">${receiptInner(t)}</div>`,
    foot: `<button class="btn outline" data-action="cust-display" aria-label="Tampilkan ke pelanggan" style="height:56px;padding:0 14px">${icon("phone")}</button><button class="btn primary" data-action="new-order" style="height:56px;flex:1">${icon("plus")}Transaksi Baru</button>` };
};
function currentTx() { const m = state.ui.modal; return m?.tx || null; }
function printTx(t) {
  const root = $("#print-root") || Object.assign(document.body.appendChild(document.createElement("div")), { id: "print-root" });
  root.style.setProperty("--paper", state.settings.paper === "80" ? "72mm" : "48mm");
  root.innerHTML = receiptInner(t, true);
  setTimeout(() => { try { window.print(); } catch (_) { toast("Browser ini tidak mendukung cetak.", true); } }, 60);
}
async function waTx(t) {
  const phone = await confirmDialog({ title: "Kirim struk via WhatsApp", text: "Nomor WhatsApp pelanggan (boleh dikosongkan untuk memilih kontak di WhatsApp).", ok: "Buka WhatsApp", danger: false, icon: "wa", input: "08xxxxxxxxxx", optional: true, mode: "text" });
  if (phone === false) return;
  let num = String(phone || "").replace(/\D/g, "").slice(0, 15);
  if (num.startsWith("0")) num = "62" + num.slice(1); else if (num.startsWith("8")) num = "62" + num;
  const url = `https://wa.me/${num}?text=${encodeURIComponent(receiptText(t))}`;
  const w = window.open(url, "_blank", "noopener"); if (!w) location.href = url;
}
async function shareTx(t) {
  const text = receiptText(t);
  try {
    if (navigator.share) { await navigator.share({ title: `Struk ${t.id}`, text }); return; }
    await navigator.clipboard.writeText(text); toast("Struk disalin — tempel di aplikasi chat.");
  } catch (e) { if (e?.name !== "AbortError") toast("Tidak bisa membagikan dari browser ini.", true); }
}

/* ---------- Held orders (open bill) ---------- */
/** move the current cart into the held list (replacing its previous copy — never duplicated) */
function parkCart(name) {
  const id = state.cart.heldId || uid("h");
  state.held = state.held.filter(h => h.id !== id);
  state.held.push({ id, name, lines: deepCopy(state.cart.lines), discount: state.cart.discount, customer: state.cart.customer, customerId: state.cart.customerId || null, redeem: !!state.cart.redeem, at: new Date().toISOString() });
}
async function holdOrder() {
  if (!isPro()) return openPro("hold");
  if (!state.cart.lines.length) return;
  const name = await confirmDialog({ title: "Simpan pesanan", text: "Beri nama agar mudah dilanjutkan (mis. nama pelanggan / nomor meja).", ok: "Simpan", danger: false, icon: "pause", input: "Contoh: Meja 3", value: state.cart.customer || `Pesanan ${state.held.length + 1}` });
  if (name === false) return;
  parkCart(cleanText(name, 30) || "Pesanan");
  state.cart = emptyCart(); Persist.mark("cart", "held");
  closeSheet(); renderScreen(); toast("Pesanan disimpan. Ketuk chip di atas menu untuk melanjutkan.");
}
async function resumeHeld(id) {
  const h = state.held.find(x => x.id === id); if (!h) return;
  if (state.cart.lines.length && state.cart.heldId !== id) {
    const ok = await confirmDialog({ title: "Ganti keranjang?", text: "Keranjang saat ini akan disimpan sebagai pesanan tertunda, lalu pesanan <b>" + esc(h.name) + "</b> dibuka.", ok: "Lanjutkan", danger: false, icon: "pause" });
    if (!ok) return;
    parkCart(state.cart.customer || `Pesanan ${state.held.length + 1}`);
  }
  state.cart = { ...emptyCart(), lines: deepCopy(h.lines).filter(l => findProduct(l.pid)), discount: h.discount || null, customer: h.customer || h.name, customerId: h.customerId && findCustomer(h.customerId) ? h.customerId : null, redeem: !!h.redeem, heldId: h.id };
  Persist.mark("cart", "held"); renderScreen(); openSheet("cart");
}
