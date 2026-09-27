/* =====================================================================
   12-insights.js — "Asisten Untung": saran bisnis otomatis dari data toko
   sendiri (tanpa internet, tanpa AI server): margin tipis + harga saran,
   perkiraan stok habis, tren vs hari yang sama, jam ramai, menu bintang,
   menu lambat, target harian. Juga: cincin target & perayaan.
   ===================================================================== */
async function stockForecast(days = 14) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const logs = (await DB.logsSince(since)).filter(l => l.reason === "sale" || l.reason === "void");
  const used = new Map(); // net usage: sales minus cancelled sales
  for (const l of logs) used.set(l.itemId, (used.get(l.itemId) || 0) + (l.reason === "sale" ? 1 : -1) * Math.abs(Number(l.delta) || 0));
  const out = [];
  for (const it of state.catalog.items) {
    if (it.stock === null) continue;
    const u = used.get(it.id) || 0; if (!(u > 0)) continue;
    const perDay = u / days, left = it.stock <= 0 ? 0 : it.stock / perDay;
    out.push({ it, perDay, daysLeft: left, buy7: Math.max(0, perDay * 7 - Math.max(0, it.stock)) });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
async function computeInsights() {
  const t = dayKey(), from = addDays(t, -27);
  const txs = (await DB.txRange(from, t)).filter(x => x.status !== "void");
  const ins = [];
  const tm = T();
  // 1. HPP missing / margin thin
  const act = state.catalog.products.filter(p => p.active !== false && p.price > 0);
  const noCost = act.filter(p => productHpp(p) === 0);
  if (noCost.length) ins.push({ id: "nocost", level: "warn", icon: "alert", title: `${noCost.length} menu belum ada ${tm.cost}-nya`, text: `Laba ${noCost.slice(0, 2).map(p => p.name).join(", ")}${noCost.length > 2 ? " dll." : ""} terlihat 100% — isi resep/modal agar laporan jujur.`, action: { label: "Lengkapi", act: "edit-product", id: noCost[0].id } });
  const thin = act.filter(p => productHpp(p) > 0).map(p => ({ p, h: productHpp(p), m: marginInfo(p.price, productHpp(p)) })).filter(x => x.m.pct < 30).sort((a, b) => a.m.pct - b.m.pct);
  for (const x of thin.slice(0, 2)) {
    const sp = suggestPrice(x.h, 50);
    ins.push({ id: "thin-" + x.p.id, level: x.m.pct < 0 ? "bad" : "warn", icon: "percent", title: x.m.pct < 0 ? `${x.p.name} dijual RUGI` : `Margin ${x.p.name} cuma ${x.m.pct}%`, text: `${tm.cost} ${rp(x.h)}, harga ${rp(x.p.price)}. Harga ${rp(sp)} memberi margin ±50% (+${rp(sp - x.p.price)} laba/penjualan).`, action: { label: "Ubah harga", act: "edit-product", id: x.p.id } });
  }
  // 2. stock forecast
  if (stockEnabled()) for (const f of (await stockForecast()).filter(f => f.daysLeft < 4).slice(0, 2)) {
    ins.push({ id: "stk-" + f.it.id, level: f.daysLeft < 1.5 ? "bad" : "warn", icon: "box", title: f.it.stock <= 0 ? `${f.it.name} sudah habis` : `${f.it.name} habis ±${Math.max(1, Math.round(f.daysLeft))} hari lagi`, text: `Rata-rata terpakai ${fmtStock(f.it, Number(f.perDay.toFixed(2)))}/hari. Belanja ±${fmtStock(f.it, Math.ceil(f.buy7))} untuk 7 hari.`, action: { label: "Tambah stok", act: "restock", id: f.it.id } });
  }
  if (!txs.length) {
    ins.push({ id: "start", level: "info", icon: "sparkle", title: "Asisten siap belajar dari penjualan Anda", text: "Setelah beberapa transaksi, saran tentang harga, stok, dan jam ramai muncul di sini." });
    return ins;
  }
  // 3. trend: yesterday vs same weekday avg
  const byDay = new Map(); for (const x of txs) byDay.set(x.day, (byDay.get(x.day) || 0) + money(x.total));
  const y = addDays(t, -1), ySales = byDay.get(y) || 0;
  const same = [7, 14, 21].map(n => byDay.get(addDays(y, -n))).filter(v => v > 0);
  if (ySales > 0 && same.length >= 2) {
    const avg = same.reduce((a, b) => a + b, 0) / same.length, d = Math.round((ySales - avg) / avg * 100);
    const dn = DAYS[parseDayKey(y).getDay()];
    if (Math.abs(d) >= 5) ins.push({ id: "trend", level: d > 0 ? "good" : "warn", icon: "chart", title: `Kemarin ${d > 0 ? "naik" : "turun"} ${Math.abs(d)}% dibanding ${dn} biasanya`, text: `${rp(ySales)} vs rata-rata ${rp(Math.round(avg))} di ${same.length} ${dn} sebelumnya.${d < 0 ? " Coba promo jam sepi atau paket hemat." : " Pertahankan! Cek menu terlaris untuk stok besok."}` });
  }
  // 4. peak hours (2-hour window)
  const hours = Array(24).fill(0); for (const x of txs) hours[new Date(x.date).getHours()]++;
  let best = 0, bh = 0; for (let h = 0; h < 23; h++) { const v = hours[h] + hours[h + 1]; if (v > best) { best = v; bh = h; } }
  if (txs.length >= 10) ins.push({ id: "peak", level: "info", icon: "clock", title: `Jam ramai: ${pad2(bh)}.00–${pad2(bh + 2)}.00`, text: `${Math.round(best / txs.length * 100)}% pesanan 4 minggu terakhir terjadi di jam ini. Siapkan stok & tenaga sebelum jam ${pad2(bh)}.` });
  // 4b. quiet hours → Happy Hour suggestion
  const qw = txs.length >= 20 && !(state.settings.promos || []).some(p => p.active) ? quietWindow(hours) : null;
  if (qw) ins.push({ id: "quiet", level: "info", icon: "zap", title: `Jam sepi: ${pad2(qw.h)}.00–${pad2(qw.h + 2)}.00`, text: `Hanya ${qw.v} pesanan dalam 4 minggu di jam ini. Happy Hour 15–20% di jam sepi bisa menambah omzet tanpa mengganggu jam ramai.`, action: { label: "Buat Happy Hour", act: "promo-quiet", id: qw.h } });
  // 5. star product by profit
  const prod = new Map(); let totalProfit = 0;
  for (const x of txs) for (const i of x.items || []) { const pf = money(i.lineTotal) - money(i.hppTotal); totalProfit += pf; const e = prod.get(i.name) || { name: i.name, profit: 0, qty: 0 }; e.profit += pf; e.qty += Number(i.qty) || 0; prod.set(i.name, e); }
  const star = [...prod.values()].sort((a, b) => b.profit - a.profit)[0];
  if (star && totalProfit > 0 && prod.size > 1 && txs.length >= 10) ins.push({ id: "star", level: "good", icon: "star", title: `${star.name} = menu bintang`, text: `Menyumbang ${Math.round(star.profit / totalProfit * 100)}% laba kotor (${fmtQty(star.qty)} terjual, 4 minggu). Taruh di posisi paling terlihat & tawarkan varian Large.` });
  // 6. slow movers (14 days)
  const from14 = addDays(t, -13); const sold = new Set();
  for (const x of txs) if (x.day >= from14) for (const i of x.items || []) sold.add(i.pid);
  const slow = act.filter(p => !sold.has(p.id));
  if (txs.filter(x => x.day >= from14).length >= 20 && slow.length) ins.push({ id: "slow", level: "info", icon: "eyeoff", title: `${slow.length} menu belum terjual 14 hari`, text: `${slow.slice(0, 3).map(p => p.name).join(", ")}${slow.length > 3 ? " dll." : ""}. Promo, ganti foto, atau sembunyikan agar menu lebih ringkas.` });
  // 7. target
  const target = money(state.settings.dailyTarget);
  if (!target) ins.push({ id: "target", level: "info", icon: "flame", title: "Pasang target harian", text: `Rata-rata penjualan harian 4 minggu: ${rp(Math.round([...byDay.values()].reduce((a, b) => a + b, 0) / Math.max(1, byDay.size)))}. Target membuat kasir lebih semangat — progresnya tampil di layar Kasir.`, action: { label: "Atur target", act: "open-target" } });
  return ins;
}
let insightsCache = null;
function insightsHtml() {
  if (!insightsCache || insightsCache.day !== dayKey() || insightsCache.stale || insightsCache.ver !== DB.ver) {
    if (!insightsCache?.loading) { insightsCache = { ...(insightsCache || {}), loading: true }; const v0 = DB.ver; computeInsights().then(list => { insightsCache = { list, day: dayKey(), ver: v0 }; if (state.ui.tab === "history") { const el = $("#insights"); if (el) el.innerHTML = insightsInner(); } }).catch(e => { insightsCache = { list: [], day: dayKey() }; logError("insights", e); }); }
    if (!insightsCache.list) return `<div id="insights"><div class="insight info"><span class="ii">${icon("sparkle")}</span><div><b>Menganalisis data toko…</b></div></div></div>`;
  }
  return `<div id="insights">${insightsInner()}</div>`;
}
function insightsInner() {
  const list = insightsCache?.list || [];
  const show = isPro() ? list : list.slice(0, 2);
  return show.map(x => `<div class="insight ${x.level}"><span class="ii">${icon(x.icon)}</span><div class="ib"><b>${esc(x.title)}</b><p>${esc(x.text)}</p>${x.action ? `<button class="ia" data-action="ins-go" data-act="${esc(x.action.act)}" data-id="${esc(x.action.id ?? "")}">${esc(x.action.label)} ${icon("arrow")}</button>` : ""}</div></div>`).join("")
    + (!isPro() && list.length > 2 ? `<div class="insight lock"><span class="ii">${icon("lock")}</span><div class="ib"><b>${list.length - 2} saran lainnya</b><p>Buka semua saran Asisten Untung di PRO.</p><button class="ia" data-action="open-pro">Lihat PRO ${icon("arrow")}</button></div></div>` : "");
}

/* ---------- Target harian ---------- */
function ringSvg(pct, size = 40) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, p = clamp(pct, 0, 100);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e7ecf3" stroke-width="5"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p >= 100 ? "#f5a30b" : "#12c795"}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
function targetChip() {
  const target = money(state.settings.dailyTarget);
  if (!target) return "";
  const sales = typeof state.todaySales === "number" && state.todaySalesDay === dayKey() ? state.todaySales : null;
  if (sales === null) { todaySales().then(() => { const el = $("#target-chip"); if (el) el.outerHTML = targetChip(); }); return `<button id="target-chip" class="target-chip" data-action="open-target" aria-label="Target harian">${ringSvg(0)}<span>…</span></button>`; }
  const pct = Math.floor(sales / target * 100);
  return `<button id="target-chip" class="target-chip ${pct >= 100 ? "done" : ""}" data-action="open-target" aria-label="Target harian ${pct}%">${ringSvg(pct)}<span class="num">${pct >= 100 ? "🎯" : pct + "%"}</span></button>`;
}
SHEETS.target = (m) => {
  const target = money(m.value ?? state.settings.dailyTarget);
  const sales = state.todaySales || 0;
  const pct = target ? Math.floor(sales / target * 100) : 0;
  return { title: "Target Harian", icon: "flame", body: `
    ${target ? `<div class="target-hero">${ringSvg(pct, 96)}<div><b class="num">${pct}%</b><span>${rp(sales)} dari ${rp(target)}</span><small>${pct >= 100 ? "Target tercapai! 🎉" : `Kurang ${rp(Math.max(0, target - sales))} lagi`}</small></div></div>` : ""}
    <div class="form-label">Target penjualan per hari</div><div class="input-affix"><span>Rp</span><input id="tg-value" class="input money" inputmode="numeric" value="${target ? groupDigits(target) : ""}" placeholder="0 = tanpa target"></div>
    <div class="quick" style="margin-top:10px">${[500000, 1000000, 1500000, 2000000, 3000000, 5000000].map(v => `<button data-action="tg-quick" data-value="${v}">${rpShort(v).replace("Rp ", "")}</button>`).join("")}</div>
    <div class="help">Progres tampil sebagai cincin di layar Kasir dan dirayakan saat tercapai.</div>`,
    foot: `<button class="btn soft" data-action="close-sheet">Tutup</button><button class="btn primary" data-action="tg-save">${icon("check")}Simpan target</button>` };
};
async function saveTarget() {
  const v = money(state.ui.modal.value ?? parseMoneyInput($("#tg-value")?.value));
  await saveSettings({ dailyTarget: v }, v ? `Target harian ${rp(v)} aktif` : "Target dimatikan");
  await todaySales(); closeSheet(); renderScreen(); if (insightsCache) insightsCache.stale = true;
}

/* ---------- Confetti (celebration) ---------- */
function confetti(ms = 1800) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.className = "confetti"; const ph = $(".phone") || document.body; ph.appendChild(c);
  const W = c.width = ph.clientWidth, H = c.height = ph.clientHeight, ctx = c.getContext("2d");
  const cols = ["#12c795", "#f5a30b", "#3d7ddf", "#e0566a", "#8a6cf0", "#ffffff"];
  const P = Array.from({ length: 120 }, () => ({ x: W / 2 + (Math.random() - .5) * 80, y: H * .35, vx: (Math.random() - .5) * 9, vy: -Math.random() * 11 - 4, s: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function f(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += .32; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); }
    if (t - t0 < ms) requestAnimationFrame(f); else c.remove();
  })(t0);
}

/* ---------- Customer-facing display ---------- */
function openCustomerDisplay(mode = "pay") {
  const host = $("#cust-root") || Object.assign($(".phone").appendChild(document.createElement("div")), { id: "cust-root" });
  const t = computeTotals(); const m = state.ui.modal;
  const logo = ImageCache.url(state.settings.logoId), qris = ImageCache.url(state.settings.qrisImageId);
  let inner;
  if (mode === "done" && m?.tx) {
    const tx = m.tx;
    inner = `<div class="cd-check">${icon("check")}</div><div class="cd-label">Terima kasih${tx.customer ? ", " + esc(tx.customer) : ""}!</div><div class="cd-total num">${rp(tx.total)}</div>${tx.method === "Tunai" && tx.change ? `<div class="cd-sub">Kembalian <b class="num">${rp(tx.change)}</b></div>` : `<div class="cd-sub">Dibayar via ${esc(methodLabel(tx.method))}</div>`}${tx.cust?.target ? `<div class="cd-stamp">${stampDots(tx.cust.stamps, tx.cust.target)}<span>Stamp ${Number(tx.cust.stamps) || 0}/${Number(tx.cust.target) || 0}</span></div>` : ""}<div class="cd-order">Pesanan #${String(Number(tx.no) || 0).padStart(3, "0")}</div>`;
  } else {
    const method = m?.type === "payment" ? m.method : "Tunai";
    inner = `<div class="cd-label">Total pembayaran</div><div class="cd-total num">${rp(t.total)}</div><div class="cd-sub">${fmtQty(t.count)} item${t.discount || t.reward ? ` · hemat ${rp(t.discount + t.reward)}` : ""}</div>
      ${method === "QRIS" && qris ? `<img class="cd-qris" src="${esc(qris)}" alt="QRIS"><div class="cd-sub">Scan QRIS di atas</div>` : method === "Transfer" && state.settings.transferInfo ? `<div class="cd-box">Transfer ke<br><b>${esc(state.settings.transferInfo)}</b></div>` : ""}
      <div class="cd-items">${t.lines.slice(0, 6).map(x => `<div><span>${fmtQty(x.line.qty)}× ${esc(x.p.name)}${x.ch.length ? ` <small>${esc(optionsLabel(x.ch))}</small>` : ""}</span><b class="num">${rp(x.lineTotal)}</b></div>`).join("")}${t.lines.length > 6 ? `<div><span>+${t.lines.length - 6} item lain</span></div>` : ""}</div>`;
  }
  host.innerHTML = `<div class="cust-display" data-action="cd-close" role="dialog" aria-label="Layar pelanggan"><div class="cd-store">${logo ? `<img src="${esc(logo)}" alt="">` : `<span class="logo" style="width:44px;height:44px;border-radius:14px">${icon("flame")}</span>`}<b>${esc(state.settings.storeName)}</b></div><div class="cd-main">${inner}</div><div class="cd-hint">Ketuk layar untuk kembali ke kasir</div></div>`;
  try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch (_) {}
}
function closeCustomerDisplay() { const h = $("#cust-root"); if (h) h.innerHTML = ""; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {} }

Object.assign(ACTIONS, {
  "open-target": () => { if (!state.ui.owner && state.settings.staffMode) return; openSheet("target", {}); },
  "tg-quick": el => { state.ui.modal.value = Number(el.dataset.value); const i = $("#tg-value"); if (i) i.value = groupDigits(state.ui.modal.value); },
  "tg-save": () => saveTarget(),
  "ins-go": el => { const a = el.dataset.act, id = el.dataset.id; if (a === "edit-product") { const p = findProduct(Number(id)); if (p) openSheet("product", { draft: newProductDraft(p) }); } else if (a === "restock") openRestock(Number(id)); else if (a === "open-target") openSheet("target", {}); else if (a === "promo-quiet") { if (!isPro()) return openPro("promo"); const h = Number(id); ACTIONS["promo-new"]({ dataset: { from: pad2(h) + ":00", to: pad2(h + 2) + ":00", hint: "Diusulkan Asisten Untung dari jam paling sepi toko Anda." } }); } },
  "cust-display": () => openCustomerDisplay(state.ui.modal?.type === "success" ? "done" : "pay"),
  "cd-close": () => closeCustomerDisplay(),
});
document.addEventListener("input", ev => { if (ev.target.id === "tg-value" && state.ui.modal?.type === "target") moneyField(ev.target, v => { state.ui.modal.value = v; }); });
