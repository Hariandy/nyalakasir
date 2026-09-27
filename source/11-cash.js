/* =====================================================================
   11-cash.js — Kas & Biaya:
   - Pengeluaran (biaya operasional / belanja stok / ambil pemilik)
   - Buka & tutup kasir (shift) dengan hitung uang laci + selisih
   - Laba bersih = laba kotor − biaya operasional (belanja stok TIDAK dikurangkan
     lagi karena sudah masuk HPP → tidak dobel hitung)
   - Ringkasan harian siap kirim WhatsApp
   ===================================================================== */
const EXP_CATS = [
  ["Gaji & upah", "op"], ["Sewa tempat", "op"], ["Listrik & air", "op"], ["Gas & bahan bakar", "op"], ["Internet & pulsa", "op"],
  ["Marketing & promo", "op"], ["Perawatan & alat", "op"], ["Kemasan & plastik", "op"], ["Lain-lain", "op"],
  ["Belanja bahan / stok", "stock"], ["Ambil pemilik (prive)", "owner"],
];
function expType(cat) { return (EXP_CATS.find(c => c[0] === cat) || [cat, "op"])[1]; }
const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];

async function netReport(from, to, sum = null) {
  const exps = await DB.rangeOf("exp", from, to);
  const r = { exps: exps.sort((a, b) => b.date.localeCompare(a.date)), op: 0, stock: 0, owner: 0, byCat: {} };
  for (const e of exps) { const t = e.type || expType(e.cat); r[t] = (r[t] || 0) + money(e.amount); if (t === "op") r.byCat[e.cat] = (r.byCat[e.cat] || 0) + money(e.amount); }
  if (sum) r.net = sum.profit - r.op;
  return r;
}
async function shiftSummary(sh) {
  const from = dayKey(sh.openAt), to = dayKey(sh.closeAt || new Date());
  const [txs, exps] = await Promise.all([DB.txRange(from, to), DB.rangeOf("exp", from, to)]);
  const tx = txs.filter(t => t.shiftId === sh.id && t.status !== "void");
  const ex = exps.filter(e => e.shiftId === sh.id);
  const byMethod = {}; for (const t of tx) byMethod[t.method] = (byMethod[t.method] || 0) + money(t.total);
  const cashSales = byMethod.Tunai || 0;
  const cashOut = ex.filter(e => e.method === "Tunai").reduce((a, e) => a + money(e.amount), 0);
  const expected = money(sh.openingCash) + cashSales - cashOut;
  return { count: tx.length, sales: tx.reduce((a, t) => a + money(t.total), 0), profit: tx.reduce((a, t) => a + money(t.profit), 0), byMethod, cashSales, cashOut, expected, voids: txs.filter(t => t.shiftId === sh.id && t.status === "void").length };
}

/* ---------- Expense sheet ---------- */
SHEETS.expense = (m) => {
  const d = m.draft;
  const t = expType(d.cat);
  return { title: "Catat Pengeluaran", icon: "cash", noBackdropClose: true, body: `
    <div class="form-label">Jumlah</div><div class="input-affix"><span>Rp</span><input id="ex-amount" class="input money" inputmode="numeric" value="${d.amount ? groupDigits(d.amount) : ""}" placeholder="0" autocomplete="off"></div>
    <div class="form-label">Kategori</div><div class="opt-chips">${EXP_CATS.map(([c]) => `<button class="opt ${d.cat === c ? "on" : ""}" data-action="ex-cat" data-value="${esc(c)}"><span>${esc(c)}</span></button>`).join("")}</div>
    <div class="help">${t === "stock" ? "Belanja bahan/stok <b>tidak</b> mengurangi laba bersih (sudah dihitung lewat HPP saat terjual), tapi mengurangi uang di laci." : t === "owner" ? "Uang yang diambil pemilik bukan biaya usaha — hanya mengurangi uang di laci." : "Biaya operasional mengurangi <b>laba bersih</b>."}</div>
    <div class="form-label">Dibayar dengan</div><div class="seg"><button class="${d.method === "Tunai" ? "on" : ""}" data-action="ex-method" data-value="Tunai">Uang laci (tunai)</button><button class="${d.method !== "Tunai" ? "on" : ""}" data-action="ex-method" data-value="Non-tunai">Transfer / lainnya</button></div>
    <div class="form-label">Catatan <small>opsional</small></div><input id="ex-note" class="input" maxlength="60" value="${esc(d.note)}" placeholder="Contoh: gas 3 kg, gaji Budi">`,
    foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="ex-save">${icon("check")}Simpan</button>` };
};
async function saveExpense() {
  const d = state.ui.modal.draft;
  if (!(money(d.amount) > 0)) return toast("Isi jumlah pengeluaran.", true);
  const now = new Date();
  const exp = { id: uid("e-"), day: dayKey(now), date: now.toISOString(), cat: d.cat, type: expType(d.cat), amount: money(d.amount), note: cleanText(d.note, 60), method: d.method === "Tunai" ? "Tunai" : "Non-tunai", shiftId: state.shift?.id || null, by: state.settings.staffMode && !state.ui.owner ? "kasir" : "pemilik" };
  try { await DB.commit({ exp }); closeSheet(); state.cashView = null; renderScreen(); toast(`Pengeluaran ${rp(exp.amount)} dicatat`); }
  catch (e) { reportStorageError(e); }
}
async function deleteExpense(id) {
  if (!(await requireOwner("Hapus pengeluaran butuh PIN pemilik."))) return;
  const ok = await confirmDialog({ title: "Hapus pengeluaran?", text: "Catatan ini akan dihapus dari laporan kas & laba bersih.", ok: "Hapus", icon: "trash" });
  if (!ok) return;
  try { await DB.del("exp", id); state.cashView = null; renderScreen(); toast("Pengeluaran dihapus"); } catch (e) { reportStorageError(e); }
}

/* ---------- Shift open / close ---------- */
SHEETS.shiftOpen = (m) => ({ title: "Buka Kasir", icon: "unlock", body: `
  <p class="help" style="margin-top:0">Hitung uang modal/kembalian di laci sebelum mulai jualan.</p>
  <div class="form-label">Uang awal di laci</div><div class="input-affix"><span>Rp</span><input id="sh-open" class="input money" inputmode="numeric" value="${m.cash ? groupDigits(m.cash) : ""}" placeholder="0"></div>
  <div class="quick" style="margin-top:10px">${[0, 50000, 100000, 200000, 300000, 500000].map(v => `<button data-action="sh-quick" data-value="${v}" class="${m.cash === v ? "active" : ""}">${v ? rp(v).slice(3) : "Rp 0"}</button>`).join("")}</div>`,
  foot: `<button class="btn success block" data-action="sh-open-save">${icon("unlock")}Mulai shift</button>` });
async function openShift() {
  const cash = money(state.ui.modal.cash);
  const now = new Date();
  const shift = { id: uid("s-"), day: dayKey(now), openAt: now.toISOString(), openingCash: cash, openedBy: state.settings.staffMode && !state.ui.owner ? "kasir" : "pemilik" };
  try { await DB.put("kv", shift, "shift"); state.shift = shift; closeSheet(); renderScreen(); toast(`Kasir dibuka · modal laci ${rp(cash)}`); } catch (e) { reportStorageError(e); }
}
SHEETS.shiftClose = (m) => {
  const s = m.sum; if (!s) return { title: "Tutup Kasir", icon: "lock", body: `<div class="empty" style="min-height:120px"><b>Menghitung…</b></div>` };
  const counted = m.useDenoms ? DENOMS.reduce((a, d) => a + d * (m.denoms[d] || 0), 0) : money(m.counted);
  const diff = counted - s.expected;
  const entered = m.useDenoms || m.counted !== null;
  return { title: "Tutup Kasir", icon: "lock", tall: true, noBackdropClose: true, body: `
    <div class="card" style="padding:12px 14px">
      <div class="kv" style="margin:0"><span>Dibuka</span><b>${esc(fmtDateTime(state.shift.openAt))}</b></div>
      <div class="kv"><span>Transaksi</span><b>${s.count}${s.voids ? ` (+${s.voids} batal)` : ""}</b></div>
      <div class="kv"><span>Total penjualan</span><b>${rp(s.sales)}</b></div>
      ${Object.entries(s.byMethod).map(([k, v]) => `<div class="kv"><span>· ${esc(methodLabel(k))}</span><b>${rp(v)}</b></div>`).join("")}
    </div>
    <div class="card" style="padding:12px 14px;margin-top:10px">
      <div class="kv" style="margin:0"><span>Uang awal laci</span><b>${rp(state.shift.openingCash)}</b></div>
      <div class="kv"><span>+ Penjualan tunai</span><b>${rp(s.cashSales)}</b></div>
      <div class="kv"><span>− Pengeluaran dari laci</span><b>${rp(s.cashOut)}</b></div>
      <div class="kv total"><span>Seharusnya di laci</span><b>${rp(s.expected)}</b></div>
    </div>
    <div class="brand-row" style="margin-top:14px"><div class="form-label" style="margin:0">Uang yang dihitung</div><button class="btn sm soft" data-action="sh-denoms">${m.useDenoms ? "Ketik total" : "Hitung per pecahan"}</button></div>
    ${m.useDenoms ? `<div class="denoms">${DENOMS.map(d => `<div class="denom"><span>${rp(d).slice(3)}</span><div class="stepper" style="margin:0"><button data-action="sh-den" data-d="${d}" data-v="-1" aria-label="Kurangi">${icon("minus")}</button><input class="input den-in" data-d="${d}" inputmode="numeric" value="${m.denoms[d] || ""}" placeholder="0" aria-label="Jumlah lembar ${d}"><button data-action="sh-den" data-d="${d}" data-v="1" aria-label="Tambah">${icon("plus")}</button></div></div>`).join("")}</div>`
      : `<div class="input-affix" style="margin-top:8px"><span>Rp</span><input id="sh-count" class="input money" inputmode="numeric" value="${m.counted !== null ? groupDigits(m.counted) : ""}" placeholder="Hitung uang di laci"></div><button class="btn sm outline" style="margin-top:8px" data-action="sh-same">Uang di laci pas ${rp(s.expected)}</button>`}
    <div id="sh-diff">${entered ? diffHtml(counted, diff) : `<div class="help">Hitung uang fisik di laci, lalu isi jumlahnya.</div>`}</div>
    <div class="form-label">Catatan <small>opsional</small></div><input id="sh-note" class="input" maxlength="80" value="${esc(m.note || "")}" placeholder="Contoh: uang receh ditukar">`,
    foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="sh-close-save">${icon("lock")}Tutup kasir</button>` };
};
function diffHtml(counted, diff) {
  const cls = diff === 0 ? "good" : diff > 0 ? "mid" : "bad";
  return `<div class="shift-diff ${cls}"><span>Dihitung ${rp(counted)}</span><b>${diff === 0 ? "Pas ✓" : diff > 0 ? "Lebih " + rp(diff) : "Kurang " + rp(-diff)}</b></div>`;
}
async function startCloseShift() {
  if (!state.shift) return;
  openSheet("shiftClose", { sum: null, counted: 0, useDenoms: false, denoms: {}, note: "" });
  const sum = await shiftSummary(state.shift);
  // counted cash starts EMPTY on purpose: pre-filling the expected amount would hide real differences (BUG-S1)
  if (state.ui.modal?.type === "shiftClose") { state.ui.modal.sum = sum; state.ui.modal.counted = null; renderOverlay(); }
}
function updateShiftDiff() {
  const m = state.ui.modal; if (m?.type !== "shiftClose" || !m.sum) return;
  if (!m.useDenoms && m.counted === null) { const el = $("#sh-diff"); if (el) el.innerHTML = `<div class="help">Hitung uang fisik di laci, lalu isi jumlahnya.</div>`; return; }
  const counted = m.useDenoms ? DENOMS.reduce((a, d) => a + d * (m.denoms[d] || 0), 0) : money(m.counted);
  const el = $("#sh-diff"); if (el) el.innerHTML = diffHtml(counted, counted - m.sum.expected);
}
async function closeShift() {
  const m = state.ui.modal; const s = m.sum; if (!s || !state.shift) return;
  if (!m.useDenoms && m.counted === null) return toast("Isi jumlah uang yang dihitung di laci dulu.", true);
  const counted = m.useDenoms ? DENOMS.reduce((a, d) => a + d * (m.denoms[d] || 0), 0) : money(m.counted);
  const now = new Date();
  const rec = { ...state.shift, closeAt: now.toISOString(), closedBy: state.settings.staffMode && !state.ui.owner ? "kasir" : "pemilik", ...s, counted, diff: counted - s.expected, note: cleanText(m.note, 80), denoms: m.useDenoms ? m.denoms : null };
  try { await DB.commit({ shift: rec, kv: { shift: null } }); state.shift = null; state.cashView = null; openSheet("shiftDone", { rec }); renderScreen(); }
  catch (e) { reportStorageError(e); }
}
SHEETS.shiftDone = (m) => {
  const r = m.rec;
  return { title: "Kasir Ditutup", icon: "check", body: `
    <div class="success-hero"><div class="success-check">${icon("check")}</div><h3>${rp(r.sales)}</h3><div class="help">${Number(r.count) || 0} transaksi · ${esc(fmtTime(r.openAt))}–${esc(fmtTime(r.closeAt))}</div></div>
    ${diffHtml(r.counted, r.diff)}
    <pre class="receipt" style="white-space:pre-wrap;margin-top:12px">${esc(shiftText(r))}</pre>`,
    foot: `<button class="btn outline" data-action="sh-share">${icon("wa")}Kirim</button><button class="btn primary" data-action="close-sheet">Selesai</button>` };
};
function shiftText(r) {
  const L = [`*Tutup Kasir — ${state.settings.storeName}*`, `${fmtDateTime(r.openAt)} s.d. ${fmtTime(r.closeAt)}`, "", `Transaksi: ${Number(r.count) || 0}${r.voids ? ` (+${Number(r.voids) || 0} batal)` : ""}`, `Penjualan: ${rp(r.sales)}`];
  for (const [k, v] of Object.entries(r.byMethod || {})) L.push(`  · ${methodLabel(k)}: ${rp(v)}`);
  L.push("", `Uang awal: ${rp(r.openingCash)}`, `+ Tunai masuk: ${rp(r.cashSales)}`, `− Keluar dari laci: ${rp(r.cashOut)}`, `Seharusnya: ${rp(r.expected)}`, `Dihitung: ${rp(r.counted)}`, `Selisih: ${r.diff === 0 ? "PAS" : (r.diff > 0 ? "+" : "") + rp(r.diff)}`);
  if (r.note) L.push(`Catatan: ${r.note}`);
  return L.join("\n");
}

/* ---------- Daily summary (WhatsApp) ---------- */
async function dailySummaryText() {
  const k = dayKey(); const sum = summarize(await DB.txRange(k, k), k, k); const net = await netReport(k, k, sum);
  const L = [`*Ringkasan ${fmtDayLabel(k)} — ${state.settings.storeName}*`, fmtDate(new Date()), "", `Penjualan: ${rp(sum.sales)} (${sum.count} transaksi)`, `Rata-rata: ${rp(sum.avg)}`, `Laba kotor: ${rp(sum.profit)} (margin ${sum.margin}%)`];
  if (net.op) L.push(`Biaya operasional: ${rp(net.op)}`, `*Laba bersih: ${rp(net.net)}*`);
  if (money(state.settings.dailyTarget)) L.push(`Target: ${pctText(sum.sales, state.settings.dailyTarget)} dari ${rp(state.settings.dailyTarget)}`);
  const methods = Object.entries(sum.byMethod); if (methods.length) { L.push(""); for (const [m, v] of methods) L.push(`${methodLabel(m)}: ${rp(v)}`); }
  if (sum.top.length) { L.push("", "Terlaris:"); sum.top.slice(0, 3).forEach((x, i) => L.push(`${i + 1}. ${x.name} — ${fmtQty(x.qty)}`)); }
  if (state.lic.tier === "FREE") L.push("", "_dibuat dengan Nyala Kasir_");
  return L.join("\n");
}
async function shareText(text, title = APP.name) {
  try { if (navigator.share) { await navigator.share({ title, text }); return; } } catch (e) { if (e?.name === "AbortError") return; }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`; const w = window.open(url, "_blank", "noopener");
  if (!w) { try { await navigator.clipboard.writeText(text); toast("Teks disalin — tempel di WhatsApp."); } catch (_) { location.href = url; } }
}

/* ---------- Kas & Biaya view (inside Laporan) ---------- */
let cashLoading = false;
async function loadCashView() {
  const [from, to] = periodRange(state.ui.period);
  const sum = state.report && state.report.period === state.ui.period ? state.report : await loadReport();
  const net = await netReport(from, to, sum);
  const shifts = (await DB.all("shifts")).sort((a, b) => b.closeAt.localeCompare(a.closeAt)).slice(0, 5);
  let live = null; if (state.shift) live = await shiftSummary(state.shift);
  state.cashView = { period: state.ui.period, net, shifts, live, ver: DB.ver, stamp: Date.now() };
  if (state.ui.tab === "history" && state.ui.repView === "kas") renderScreen();
}
function renderCashView(r) {
  if (!isPro() && !state.shift) return `<div class="section"><div class="pro-lock"><svg class="crown-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONS.crown}</svg><p>Catat pengeluaran, buka/tutup kasir dengan hitung uang laci, dan lihat <b>laba bersih</b> yang sebenarnya.</p><button class="btn amber sm" data-action="open-pro">Buka Fitur PRO</button></div></div>`;
  const cv = state.cashView;
  if (!cv || cv.period !== state.ui.period || cv.ver !== DB.ver) { if (!cashLoading) { cashLoading = true; loadCashView().finally(() => { cashLoading = false; }); } if (!cv || cv.period !== state.ui.period) return `<div class="section"><div class="empty" style="min-height:140px"><b>Memuat kas…</b></div></div>`; }
  const net = cv.net;
  const sh = state.shift;
  const shiftCard = sh ? `<div class="shift-card open"><div><span class="pill ok"><i></i>Kasir terbuka</span><b>Sejak ${esc(fmtTime(sh.openAt))} · modal ${rp(sh.openingCash)}</b><small>${cv.live ? `${Number(cv.live.count) || 0} transaksi · seharusnya di laci ${rp(cv.live.expected)}` : ""}</small></div><button class="btn primary sm" data-action="shift-close">${icon("lock")}Tutup kasir</button></div>`
    : `<div class="shift-card"><div><span class="pill muted">Kasir belum dibuka</span><b>Catat modal laci agar selisih uang ketahuan</b><small>Opsional, disarankan setiap hari.</small></div><button class="btn success sm" data-action="shift-open">${icon("unlock")}Buka kasir</button></div>`;
  if (!isPro()) return `<div class="section">${shiftCard}</div><div class="section"><div class="pro-lock"><p>Masa coba PRO berakhir — shift yang sedang berjalan tetap bisa ditutup. Laba bersih & pengeluaran ada di PRO.</p><button class="btn amber sm" data-action="open-pro">Buka Fitur PRO</button></div></div>`;
  const cats = Object.entries(net.byCat).sort((a, b) => b[1] - a[1]);
  return `<div class="section">${shiftCard}</div>
  <div class="section"><div class="section-title"><h3>${icon("chart")}Laba Bersih · ${esc(periodTitle())}</h3></div>
    <div class="card" style="padding:14px">
      <div class="kv" style="margin:0"><span>Penjualan (tanpa pajak)</span><b>${rp(r.net)}</b></div>
      <div class="kv"><span>− ${esc(T().cost)} (modal barang terjual)</span><b>${rp(r.hpp)}</b></div>
      <div class="kv"><span>= Laba kotor</span><b>${rp(r.profit)}</b></div>
      ${cats.map(([c, v]) => `<div class="kv"><span>− ${esc(c)}</span><b>${rp(v)}</b></div>`).join("") || `<div class="kv"><span>− Biaya operasional</span><b>${rp(0)}</b></div>`}
      <div class="kv total"><span>Laba bersih</span><b style="color:${net.net >= 0 ? "var(--green)" : "var(--red)"}">${rp(net.net)}</b></div>
      ${net.stock || net.owner ? `<div class="help">Tidak dihitung sebagai biaya: belanja stok ${rp(net.stock)} (sudah lewat ${esc(T().cost)}) · ambil pemilik ${rp(net.owner)}.</div>` : ""}
    </div></div>
  <div class="section"><div class="section-title"><h3>${icon("cash")}Pengeluaran</h3><button class="btn sm primary" data-action="add-expense">${icon("plus")}Catat</button></div>
    <div class="list">${net.exps.length ? net.exps.slice(0, 60).map(e => `<div class="tx" style="cursor:default"><span class="tx-ico" style="background:${e.type === "op" ? "var(--red-soft)" : "var(--soft)"};color:${e.type === "op" ? "var(--red)" : "#6f7e93"}">${icon(e.type === "stock" ? "box" : e.type === "owner" ? "user" : "cash")}</span><span class="tx-main"><span class="top"><b>${esc(e.cat)}</b><strong>−${rp(e.amount).slice(3)}</strong></span><span>${esc(fmtDayLabel(e.day))} ${esc(fmtTime(e.date))} · ${esc(e.method)}${e.note ? " · " + esc(e.note) : ""}</span></span><button class="icon-btn" data-action="del-expense" data-id="${esc(e.id)}" aria-label="Hapus pengeluaran" style="width:36px;height:36px">${icon("trash")}</button></div>`).join("") : emptyState("cash", "Belum ada pengeluaran", "Catat gaji, sewa, gas, listrik agar laba bersih akurat.")}</div></div>
  ${cv.shifts.length ? `<div class="section"><div class="section-title"><h3>${icon("clock")}Riwayat tutup kasir</h3></div><div class="list">${cv.shifts.map(s => `<button class="tx" data-action="shift-view" data-id="${esc(s.id)}"><span class="tx-ico">${icon("lock")}</span><span class="tx-main"><span class="top"><b>${esc(fmtDayLabel(dayKey(s.closeAt)))} · ${esc(fmtTime(s.openAt))}–${esc(fmtTime(s.closeAt))}</b><strong>${rp(s.sales)}</strong></span><span>${Number(s.count) || 0} transaksi · selisih ${s.diff === 0 ? "pas" : (s.diff > 0 ? "+" : "") + rp(s.diff)}</span></span></button>`).join("")}</div></div>` : ""}`;
}

Object.assign(ACTIONS, {
  "rep-view": el => { state.ui.repView = el.dataset.value; renderScreen(); },
  "add-expense": () => { if (!isPro()) return openPro("cash"); openSheet("expense", { draft: { amount: 0, cat: "Gas & bahan bakar", method: "Tunai", note: "" } }); },
  "ex-cat": el => { state.ui.modal.draft.cat = el.dataset.value; renderOverlay(); },
  "ex-method": el => { state.ui.modal.draft.method = el.dataset.value; renderOverlay(); },
  "ex-save": () => saveExpense(),
  "del-expense": el => deleteExpense(el.dataset.id),
  "shift-open": () => { if (!isPro()) return openPro("cash"); openSheet("shiftOpen", { cash: 0 }); },
  "sh-quick": el => { state.ui.modal.cash = Number(el.dataset.value); renderOverlay(); },
  "sh-open-save": () => openShift(),
  "shift-close": () => startCloseShift(),
  "sh-denoms": () => { const m = state.ui.modal; m.useDenoms = !m.useDenoms; renderOverlay(); },
  "sh-den": el => { const m = state.ui.modal; const d = Number(el.dataset.d); m.denoms[d] = Math.max(0, (m.denoms[d] || 0) + Number(el.dataset.v)); const inp = $(`.den-in[data-d="${d}"]`); if (inp) inp.value = m.denoms[d] || ""; updateShiftDiff(); haptic(5); },
  "sh-close-save": () => closeShift(),
  "sh-same": () => { const m = state.ui.modal; m.counted = m.sum.expected; const i = $("#sh-count"); if (i) i.value = groupDigits(m.counted); updateShiftDiff(); },
  "sh-share": () => shareText(shiftText(state.ui.modal.rec), "Tutup kasir"),
  "shift-view": async el => { const rec = await DB.get("shifts", el.dataset.id); if (rec) openSheet("shiftDone", { rec }); },
  "share-summary": async () => shareText(await dailySummaryText(), "Ringkasan harian"),
});
document.addEventListener("input", ev => {
  const el = ev.target, m = state.ui.modal; if (!m) return;
  if (m.type === "expense") { if (el.id === "ex-amount") moneyField(el, v => { m.draft.amount = v; }); if (el.id === "ex-note") m.draft.note = el.value; }
  if (m.type === "shiftOpen" && el.id === "sh-open") { moneyField(el, v => { m.cash = v; }); $$("[data-action=sh-quick]").forEach(b => b.classList.toggle("active", Number(b.dataset.value) === m.cash)); }
  if (m.type === "shiftClose") {
    if (el.id === "sh-count") { moneyField(el, v => { m.counted = el.value.trim() === "" ? null : v; }); if (el.value === "") m.counted = null; updateShiftDiff(); }
    if (el.classList.contains("den-in")) { m.denoms[Number(el.dataset.d)] = Math.min(9999, Number(digitsOnly(el.value, 4)) || 0); updateShiftDiff(); }
    if (el.id === "sh-note") m.note = el.value;
  }
});
