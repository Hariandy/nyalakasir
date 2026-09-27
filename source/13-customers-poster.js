/* =====================================================================
   13-customers-poster.js — Pelanggan & Kartu Stamp Digital, Poster Menu.
   ===================================================================== */
function stampDots(n, target) { n = Math.max(0, Math.min(n || 0, target || 0)); return "●".repeat(n) + "○".repeat(Math.max(0, (target || 0) - n)); }
function normPhone(v) { let d = String(v || "").replace(/\D/g, "").slice(0, 15); if (d.startsWith("0")) d = "62" + d.slice(1); else if (d.startsWith("8")) d = "62" + d; return d; }
function findCustomer(id) { return state.customers.find(c => c.id === id); }

/* ---------- Picker in cart ---------- */
SHEETS.customer = (m) => {
  const st = state.settings.stamp;
  return { title: "Pilih Pelanggan", icon: "user", tall: true, body: `
    <div class="search" style="margin-top:0">${icon("search")}<input id="cu-q" type="search" value="${esc(m.q || "")}" placeholder="Cari nama / no. HP" autocomplete="off"></div>
    ${st.enabled ? `<div class="help">Kartu stamp aktif: belanja ≥ ${rp(st.minSpend)} = 1 stamp · ${st.target} stamp = hadiah ${rp(st.reward)}.</div>` : `<div class="help">Kartu stamp belum aktif — atur di Pengaturan → Pelanggan & kartu stamp.</div>`}
    <div class="list" style="margin-top:10px" id="cu-list">${customerListHtml(m.q)}</div>
    <div class="card" style="padding:12px;margin-top:12px"><b style="font-size:14px">Pelanggan baru</b>
      <div class="form-row" style="margin-top:8px"><input id="cu-name" class="input" maxlength="40" placeholder="Nama" value="${esc(m.name || "")}"><input id="cu-phone" class="input" inputmode="tel" maxlength="16" placeholder="No. HP (opsional)" value="${esc(m.phone || "")}"></div>
      <button class="btn primary block sm" style="margin-top:8px" data-action="cu-add">${icon("plus")}Simpan & pilih</button></div>`,
    foot: state.cart.customerId ? `<button class="btn danger-outline block" data-action="cu-clear">Lepas pelanggan dari pesanan</button>` : "" };
};
function customerListHtml(qRaw) {
  const q = (qRaw || "").toLowerCase().trim(), qd = q.replace(/\D/g, ""); const st = state.settings.stamp;
  const list = state.customers.filter(c => !q || c.name.toLowerCase().includes(q) || (qd && (c.phone || "").includes(qd))).sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || "")).slice(0, 30);
  return list.map(c => `<button class="tx" data-action="cu-pick" data-id="${esc(c.id)}"><span class="tx-ico">${esc(initials(c.name))}</span><span class="tx-main"><span class="top"><b>${esc(c.name)}</b><strong>${st.enabled ? `${c.stamps || 0}/${st.target}` : ""}</strong></span><span>${esc(c.phone || "tanpa no. HP")} · ${c.visits || 0}× datang</span></span></button>`).join("") || `<div class="help">Belum ada pelanggan${q ? " dengan kata itu" : ""}.</div>`;
}
async function addCustomer() {
  const m = state.ui.modal; const name = cleanText(m.name, 40); const phone = normPhone(m.phone);
  if (!name) return toast("Isi nama pelanggan.", true);
  if (phone && state.customers.some(c => c.phone === phone)) return toast("No. HP sudah terdaftar — cari di daftar.", true);
  const c = { id: uid("c-").slice(0, 14), name, phone, stamps: 0, visits: 0, spent: 0, lastAt: null, createdAt: new Date().toISOString() };
  const customers = [...state.customers, c];
  try { await DB.put("kv", customers, "customers"); state.customers = customers; pickCustomer(c.id); } catch (e) { reportStorageError(e); }
}
function pickCustomer(id) {
  const c = findCustomer(id); if (!c) return;
  state.cart.customerId = c.id; state.cart.customer = c.name; state.cart.redeem = false;
  Persist.mark("cart"); openSheet("cart"); updateCartBar();
}
function customerCartHtml() {
  const st = state.settings.stamp; const c = state.cart.customerId ? findCustomer(state.cart.customerId) : null;
  if (!c) return `<button class="cust-pill" data-action="cu-open">${icon("user")}<span>Pilih pelanggan${st.enabled ? " · kartu stamp" : ""}</span>${proTag()}</button>`;
  const ready = st.enabled && c.stamps >= st.target;
  return `<div class="cust-pill on"><span class="tx-ico" style="width:34px;height:34px;border-radius:11px">${esc(initials(c.name))}</span><span style="min-width:0;flex:1"><b>${esc(c.name)}</b>${st.enabled ? `<small class="stamps">${stampDots(c.stamps, st.target)} ${c.stamps}/${st.target}</small>` : ""}</span><button class="btn sm soft" data-action="cu-open">Ganti</button></div>
    ${ready ? `<div class="switch-row" style="border:0;padding:8px 2px 0"><div><b>🎁 Pakai hadiah stamp</b><small>Potongan ${rp(st.reward)} · ${st.target} stamp terpakai</small></div>${switchHtml("cu-redeem", state.cart.redeem)}</div>` : ""}`;
}
/* ---------- Customer list & stamp settings (Pengaturan) ---------- */
SHEETS.customers = () => {
  const st = state.settings.stamp;
  const list = state.customers.slice().sort((a, b) => money(b.spent) - money(a.spent));
  return { title: "Pelanggan & Kartu Stamp", icon: "user", tall: true, noBackdropClose: true, body: `
    <div class="card" style="padding:4px 14px"><div class="switch-row"><div><b>Kartu stamp digital</b><small>Pelanggan dapat stamp tiap belanja; hadiah otomatis jadi potongan.</small></div>${switchHtml("st-on", st.enabled)}</div></div>
    ${st.enabled ? `<div class="form-row"><div><div class="form-label">Min. belanja / stamp</div><div class="input-affix"><span>Rp</span><input id="st-min" class="input money" inputmode="numeric" value="${groupDigits(st.minSpend)}"></div></div><div><div class="form-label">Stamp untuk hadiah</div><input id="st-target" class="input" inputmode="numeric" value="${st.target}"></div></div>
      <div class="form-label">Nilai hadiah (potongan)</div><div class="input-affix"><span>Rp</span><input id="st-reward" class="input money" inputmode="numeric" value="${groupDigits(st.reward)}"></div>
      <div class="help">Contoh kedai kopi: belanja ≥ Rp15.000 = 1 stamp, 10 stamp = gratis minuman Rp20.000. Biaya program ≈ ${pctText(st.reward, st.minSpend * st.target)} dari omzet pelanggan setia.</div>
      <button class="btn primary block sm" style="margin-top:10px" data-action="st-save">${icon("check")}Simpan aturan stamp</button>` : ""}
    <div class="section-title" style="margin-top:18px"><h3>${icon("user")}${list.length} pelanggan</h3></div>
    <div class="list">${list.slice(0, 200).map(c => `<div class="tx" style="cursor:default"><span class="tx-ico">${esc(initials(c.name))}</span><span class="tx-main"><span class="top"><b>${esc(c.name)}</b><strong>${rpShort(c.spent)}</strong></span><span>${c.visits || 0}× datang${st.enabled ? ` · stamp ${c.stamps || 0}/${st.target}` : ""}${c.lastAt ? " · terakhir " + esc(fmtDate(c.lastAt)) : ""}</span></span>${c.phone ? `<button class="icon-btn green" data-action="cu-wa" data-id="${esc(c.id)}" aria-label="Kirim WhatsApp" style="width:38px;height:38px">${icon("wa")}</button>` : ""}</div>`).join("") || emptyState("user", "Belum ada pelanggan", "Pilih/daftarkan pelanggan dari keranjang saat transaksi.")}</div>`,
    foot: `<button class="btn primary block" data-action="close-sheet">Selesai</button>` };
};
async function saveStampSettings() {
  const min = parseMoneyInput($("#st-min")?.value), target = clamp(Number(digitsOnly($("#st-target")?.value, 3)) || 0, 2, 50), reward = parseMoneyInput($("#st-reward")?.value);
  if (!(min > 0) || !(reward > 0)) return toast("Isi minimal belanja & nilai hadiah.", true);
  await saveSettings({ stamp: { ...state.settings.stamp, minSpend: min, target, reward } }, "Aturan kartu stamp disimpan"); renderOverlay();
}
function customerWa(id) {
  const c = findCustomer(id); if (!c?.phone) return; const st = state.settings.stamp;
  const text = st.enabled ? `Halo Kak ${c.name}! 👋\nKartu stamp di *${state.settings.storeName}*: ${stampDots(c.stamps, st.target)} (${c.stamps}/${st.target}).\n${c.stamps >= st.target ? "Hadiah kamu sudah siap dipakai 🎁 — sampai ketemu!" : `Tinggal ${st.target - c.stamps} stamp lagi dapat hadiah ${rp(st.reward)} 🎁`}` : `Halo Kak ${c.name}! Terima kasih sudah berbelanja di *${state.settings.storeName}* 🙏`;
  const url = `https://wa.me/${String(c.phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`; const w = window.open(url, "_blank", "noopener"); if (!w) location.href = url;
}

/* ---------- Poster menu (canvas) ---------- */
SHEETS.poster = (m) => ({ title: "Poster Menu", icon: "image", tall: true, body: `
  <div class="seg"><button class="${m.fmt === "feed" ? "on" : ""}" data-action="po-fmt" data-value="feed">Feed 4:5</button><button class="${m.fmt === "story" ? "on" : ""}" data-action="po-fmt" data-value="story">Status WA 9:16</button></div>
  <div class="form-label">Judul</div><input id="po-title" class="input" maxlength="36" value="${esc(m.title)}">
  <div class="form-label">Catatan bawah <small>promo, jam buka, IG</small></div><input id="po-foot" class="input" maxlength="60" value="${esc(m.foot)}">
  <div class="poster-wrap">${m.url ? `<img id="po-img" src="${m.url}" alt="Pratinjau poster menu">` : `<div class="empty" style="min-height:200px"><b>Membuat poster…</b></div>`}</div>`,
  foot: `<button class="btn outline" data-action="po-refresh">${icon("refresh")}Perbarui</button><button class="btn success" data-action="po-share">${icon("share")}Bagikan / simpan</button>` });
function loadImg(src) { return new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
async function renderPoster(m) {
  const W = 1080, H = m.fmt === "story" ? 1920 : 1350;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0e142d"); g.addColorStop(.62, "#14304a"); g.addColorStop(1, "#0b4a3f"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(18,199,149,.18)"; x.beginPath(); x.arc(W - 90, 120, 260, 0, Math.PI * 2); x.fill();
  const F = "Inter, 'Plus Jakarta Sans', system-ui, sans-serif";
  const logo = await loadImg(ImageCache.url(state.settings.logoId));
  let y = 110;
  if (logo) { x.save(); x.beginPath(); x.arc(110, y + 10, 50, 0, Math.PI * 2); x.clip(); x.drawImage(logo, 60, y - 40, 100, 100); x.restore(); }
  x.fillStyle = "#fff"; x.font = `800 60px ${F}`; x.fillText(state.settings.storeName.slice(0, 26), logo ? 185 : 70, y + 30);
  y += 110; x.fillStyle = "#6be0c2"; x.font = `800 34px ${F}`; x.fillText((m.title || "MENU").toUpperCase(), 70, y); y += 30;
  // photo strip (up to 3 products with photos)
  const prods = state.catalog.products.filter(p => p.active !== false);
  const withImg = prods.filter(p => ImageCache.url(p.imageId)).slice(0, 3);
  if (withImg.length) {
    const size = (W - 140 - (withImg.length - 1) * 24) / withImg.length, ph = Math.min(size * .78, m.fmt === "story" ? 330 : 250);
    for (let i = 0; i < withImg.length; i++) {
      const im = await loadImg(ImageCache.url(withImg[i].imageId)); const px = 70 + i * (size + 24);
      x.save(); roundRect(x, px, y + 20, size, ph, 28); x.clip();
      if (im) { const s = Math.max(size / im.width, ph / im.height); x.drawImage(im, px + (size - im.width * s) / 2, y + 20 + (ph - im.height * s) / 2, im.width * s, im.height * s); }
      x.restore();
    }
    y += ph + 60;
  } else y += 30;
  // list by category, auto-fit font
  const cats = state.catalog.cats.filter(cn => prods.some(p => p.category === cn));
  const rows = cats.reduce((a, cn) => a + 1 + prods.filter(p => p.category === cn).length, 0);
  const avail = H - y - 150; const lh = clamp(Math.floor(avail / Math.max(1, rows + cats.length * .5)), 30, 64);
  let drawn = 0;
  for (const cn of cats) {
    if (y > H - 170) break;
    x.fillStyle = "#f5a30b"; x.font = `800 ${Math.round(lh * .62)}px ${F}`; x.fillText(cn.toUpperCase(), 70, y + lh * .7); y += lh * 1.15;
    for (const p of prods.filter(p => p.category === cn)) {
      if (y > H - 170) break;
      x.font = `600 ${Math.round(lh * .62)}px ${F}`; x.fillStyle = "#ffffff";
      const price = groupDigits(p.price / 1000 >= 1 && p.price % 1000 === 0 ? p.price / 1000 : p.price) + (p.price % 1000 === 0 && p.price >= 1000 ? "K" : "");
      const pw = x.measureText(price).width; let name = p.name; while (x.measureText(name).width > W - 200 - pw && name.length > 3) name = name.slice(0, -2) + "…";
      x.fillText(name, 70, y + lh * .62);
      x.fillStyle = "#6be0c2"; x.fillText(price, W - 70 - pw, y + lh * .62);
      x.strokeStyle = "rgba(255,255,255,.18)"; x.setLineDash([3, 9]); x.beginPath(); x.moveTo(80 + x.measureText(name).width + 10, y + lh * .55); x.lineTo(W - 90 - pw, y + lh * .55); x.stroke(); x.setLineDash([]);
      y += lh; drawn++;
    }
    y += lh * .35;
  }
  if (drawn < prods.length) { x.fillStyle = "#b8c4d6"; x.font = `700 ${Math.round(lh * .55)}px ${F}`; x.fillText(`+ ${prods.length - drawn} menu lainnya — tanya kasir ya!`, 70, Math.min(y + lh * .4, H - 140)); }
  x.fillStyle = "rgba(255,255,255,.1)"; x.fillRect(0, H - 120, W, 120);
  x.fillStyle = "#fff"; x.font = `700 34px ${F}`; x.fillText((m.foot || state.settings.address || "").slice(0, 52), 70, H - 50);
  return new Promise(res => c.toBlob(b => res(b), "image/png"));
}
function roundRect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
async function refreshPoster() {
  const m = state.ui.modal; if (m?.type !== "poster") return;
  const blob = await renderPoster(m); if (m.url) URL.revokeObjectURL(m.url);
  m.blob = blob; m.url = URL.createObjectURL(blob); renderOverlay();
}
async function sharePoster() {
  const m = state.ui.modal; if (!m?.blob) return;
  const name = `Menu_${state.settings.storeName.replace(/[^\w]+/g, "_").slice(0, 24)}.png`;
  const file = new File([m.blob], name, { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Menu " + state.settings.storeName }); return; } } catch (e) { if (e?.name === "AbortError") return; }
  downloadBlob(m.blob, name); toast("Poster disimpan ke unduhan.");
}

Object.assign(ACTIONS, {
  "cu-open": () => { if (!isPro()) return openPro("customers"); openSheet("customer", { q: "" }); },
  "cu-pick": el => pickCustomer(el.dataset.id),
  "cu-add": () => addCustomer(),
  "cu-clear": () => { state.cart.customerId = null; state.cart.redeem = false; Persist.mark("cart"); openSheet("cart"); updateCartBar(); },
  "open-customers": () => { if (!isPro()) return openPro("customers"); openSheet("customers"); },
  "st-save": () => saveStampSettings(),
  "cu-wa": el => customerWa(el.dataset.id),
  "open-poster": () => { if (!isPro()) return openPro("poster"); openSheet("poster", { fmt: "feed", title: "Menu Kami", foot: state.settings.address || "" }); refreshPoster(); },
  "po-fmt": el => { state.ui.modal.fmt = el.dataset.value; refreshPoster(); },
  "po-refresh": () => { const m = state.ui.modal; m.title = $("#po-title")?.value || m.title; m.foot = $("#po-foot")?.value ?? m.foot; refreshPoster(); },
  "po-share": () => sharePoster(),
});
document.addEventListener("input", ev => {
  const el = ev.target, m = state.ui.modal; if (!m) return;
  if (m.type === "customer") {
    if (el.id === "cu-q") { m.q = el.value; const l = $("#cu-list"); if (l) l.innerHTML = customerListHtml(m.q); }
    if (el.id === "cu-name") m.name = el.value; if (el.id === "cu-phone") m.phone = el.value;
  }
  if (m.type === "customers" && ["st-min", "st-reward"].includes(el.id)) moneyField(el, () => {});
  if (m.type === "poster") { if (el.id === "po-title") m.title = el.value; if (el.id === "po-foot") m.foot = el.value; }
});
document.addEventListener("change", async ev => {
  const el = ev.target;
  if (el.id === "cu-redeem") { state.cart.redeem = el.checked; Persist.mark("cart"); renderOverlay(); updateCartBar(); }
  if (el.id === "st-on") { await saveSettings({ stamp: { ...state.settings.stamp, enabled: el.checked } }, el.checked ? "Kartu stamp aktif" : "Kartu stamp dimatikan"); renderOverlay(); }
});
