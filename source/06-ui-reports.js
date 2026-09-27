/* =====================================================================
   06-ui-reports.js — Laporan & Riwayat: period summary, payment mix,
   hourly/daily charts, best sellers, transaction list, detail, void, CSV.
   ===================================================================== */
let reportLoading = false;
function ensureReport() {
  const id = state.ui.period;
  if (state.report && state.report.period === id && state.report.stamp === dayKey()) return;
  if (reportLoading) return;
  reportLoading = true;
  loadReport().then(() => { reportLoading = false; if (state.ui.tab === "history") renderScreen(); })
    .catch(e => { reportLoading = false; logError("report", e); toast("Gagal memuat laporan.", true); });
}
function renderReports() {
  const staff = state.settings.staffMode && !state.ui.owner;
  if (staff) state.ui.period = "today";
  const r = state.report && state.report.period === state.ui.period ? state.report : null;
  const periods = staff ? PERIODS.slice(0, 1) : PERIODS;
  const hero = `<section class="hero">
    <div class="hero-head"><h2>${staff ? "Transaksi Hari Ini" : "Laporan"}</h2>${staff ? "" : `<div style="display:flex;gap:6px"><button class="hero-btn" data-action="share-summary" aria-label="Kirim ringkasan hari ini">${icon("wa")}<span>Ringkas</span></button><button class="hero-btn" data-action="export-csv">${icon("download")}<span>CSV${isPro() ? "" : " 🔒"}</span></button></div>`}</div>
    <div class="period">${periods.map(p => `<button class="${state.ui.period === p.id ? "on" : ""}" data-action="period" data-value="${p.id}">${p.label}${p.pro && !isPro() ? `<span class="lk">${icon("lock")}</span>` : ""}</button>`).join("")}</div>
    ${staff ? `<div class="metric-grid"><div class="metric"><span>Penjualan</span><strong class="num">${r ? rp(r.sales) : "…"}</strong></div><div class="metric"><span>Transaksi</span><strong>${r ? r.count : "…"}</strong></div></div>` : `
    <div class="profit-card"><div class="profit-label">Laba kotor · ${esc(periodTitle())}</div><div class="profit-value num">${r ? rp(r.profit) : "…"}</div><div class="margin-pill">Margin ${r ? r.margin : 0}%${r && r.hpp ? ` · ${T().cost} ${rpShort(r.hpp)}` : ""}</div>
      <svg class="profit-mark" viewBox="0 0 72 56" fill="none" aria-hidden="true"><path d="M5 45 23 28l11 9 27-27" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M47 10h14v14" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div class="metric-grid"><div class="metric"><span>Penjualan</span><strong class="num">${r ? rp(r.sales) : "…"}</strong></div><div class="metric"><span>Transaksi</span><strong>${r ? r.count + " pesanan" : "…"}</strong></div>
      <div class="metric"><span>Rata-rata / pesanan</span><strong class="num">${r ? rp(r.avg) : "…"}</strong></div><div class="metric"><span>${r && r.tax ? "Pajak terkumpul" : "Diskon diberikan"}</span><strong class="num">${r ? rp(r.tax || r.discount) : "…"}</strong></div></div>`}
  </section>`;
  if (!r) return `<div class="screen">${hero}<div class="section"><div class="empty" style="min-height:160px"><b>Memuat laporan…</b></div></div></div>`;
  let body = "";
  const view = staff ? "sum" : (state.ui.repView || "sum");
  if (!staff) body += `<div class="section" style="padding-top:16px"><div class="seg"><button class="${view === "sum" ? "on" : ""}" data-action="rep-view" data-value="sum">Ringkasan</button><button class="${view === "kas" ? "on" : ""}" data-action="rep-view" data-value="kas">Kas & Laba Bersih${isPro() ? "" : " 🔒"}</button></div></div>`;
  if (view === "kas") return `<div class="screen">${hero}${body}${renderCashView(r)}</div>`;
  if (!staff) body += `<div class="section"><div class="section-title"><h3>${icon("sparkle")}Asisten Untung</h3><span class="tag good">otomatis</span></div>${insightsHtml()}</div>`;
  if (!staff) {
    body += backupOverdue() ? `<div class="notice warn" style="margin:16px 18px 0">${icon("shield")}<span>Sudah lebih dari 7 hari sejak cadangan terakhir.</span><button class="act" data-action="backup">Cadangkan</button></div>` : "";
    const methods = Object.entries(r.byMethod).sort((a, b) => b[1] - a[1]);
    body += `<div class="section"><div class="section-title"><h3>${icon("wallet")}Metode Pembayaran</h3></div><div class="card" style="padding:14px">${methods.length ? `<div class="method-bars">${methods.map(([m, v]) => `<div class="mbar"><span>${esc(methodLabel(m))}</span><div class="track"><i style="width:${Math.max(3, Math.round(v / r.sales * 100))}%"></i></div><b>${rpShort(v)}</b></div>`).join("")}</div>` : `<div class="help" style="margin:0">Belum ada pembayaran pada periode ini.</div>`}</div></div>`;
    if (isPro()) {
      const maxH = Math.max(1, ...r.hours), peak = r.hours.indexOf(Math.max(...r.hours));
      body += `<div class="section"><div class="section-title"><h3>${icon("star")}Produk Terlaris</h3></div><div class="card" style="padding:4px 14px">${r.top.length ? r.top.map((x, i) => `<div class="top-item"><span class="rank">${i + 1}</span><span style="min-width:0"><b>${esc(x.name)}</b><small>${fmtQty(x.qty)} terjual · laba ${rpShort(x.profit)}</small></span><span class="v num">${rpShort(x.revenue)}</span></div>`).join("") : `<div class="help" style="padding:12px 0">Belum ada penjualan.</div>`}</div></div>`;
      if (r.days.length > 1) {
        const maxD = Math.max(1, ...r.days.map(d => d.v));
        const step = r.days.length > 14 ? Math.ceil(r.days.length / 10) : 1;
        body += `<div class="section"><div class="section-title"><h3>${icon("chart")}Penjualan Harian</h3></div><div class="card" style="padding:14px"><div class="days">${r.days.map((d, i) => `<div class="d ${d.day === dayKey() ? "today" : ""}" title="${esc(fmtDayLabel(d.day))}: ${rp(d.v)}"><i style="height:${Math.round(d.v / maxD * 90) + 2}px"></i><small>${i % step === 0 ? parseDayKey(d.day).getDate() : ""}</small></div>`).join("")}</div></div></div>`;
      }
      body += `<div class="section"><div class="section-title"><h3>${icon("clock")}Jam Ramai</h3>${r.count ? `<span class="tag good">Puncak ${pad2(peak)}.00</span>` : ""}</div><div class="card" style="padding:14px"><div class="hours">${r.hours.map((v, h) => `<i class="${h === peak && v ? "peak" : ""}" style="height:${Math.round(v / maxH * 86) + 2}px" title="${pad2(h)}.00 · ${rp(v)}"></i>`).join("")}</div><div class="hours-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div></div></div>`;
    } else {
      body += `<div class="section"><div class="section-title"><h3>${icon("star")}Analitik PRO</h3></div><div class="pro-lock"><svg class="crown-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONS.crown}</svg><p>Lihat produk terlaris, jam ramai, grafik harian, laporan 30 hari & bulanan, serta export CSV.</p><button class="btn amber sm" data-action="open-pro">Buka Fitur PRO</button></div></div>`;
    }
  }
  const txs = r.txs.slice(0, state.ui.histLimit);
  let lastDay = "";
  const list = txs.map(t => {
    const sep = t.day !== lastDay ? `<div class="day-sep"><span>${esc(fmtDayLabel(t.day))}</span></div>` : ""; lastDay = t.day;
    const n = (t.items || []).reduce((a, i) => a + Number(i.qty || 0), 0);
    return `${sep}<button class="tx ${t.status === "void" ? "void" : ""}" data-action="tx-detail" data-id="${esc(t.id)}"><span class="tx-ico">${icon(t.status === "void" ? "x" : methodIcon(t.method))}</span><span class="tx-main"><span class="top"><b>${t.no ? "#" + String(Number(t.no) || 0).padStart(3, "0") + " · " : ""}${esc(t.customer || (t.items?.[0]?.name ?? "Transaksi"))}${t.items?.length > 1 && !t.customer ? ` +${t.items.length - 1}` : ""}</b><strong>${rp(t.total)}</strong></span><span>${fmtTime(t.date)} · ${esc(methodLabel(t.method))} · ${fmtQty(n)} item${t.status === "void" ? " · DIBATALKAN" : ""}</span></span></button>`;
  }).join("");
  body += `<div class="section"><div class="section-title"><h3>${icon("receipt")}Riwayat Transaksi</h3><span class="help" style="margin:0">${r.txs.length} data${r.voids ? ` · ${r.voids} batal` : ""}</span></div>
    <div class="list">${list || emptyState("receipt", "Belum ada transaksi", "Transaksi yang selesai akan muncul di sini.")}</div>
    ${r.txs.length > state.ui.histLimit ? `<button class="btn outline block" style="margin-top:12px" data-action="more-history">Tampilkan lebih banyak</button>` : ""}</div>`;
  return `<div class="screen">${hero}${body}</div>`;
}
function periodTitle() { return (PERIODS.find(p => p.id === state.ui.period) || PERIODS[0]).label; }

SHEETS.txDetail = (m) => {
  const t = m.tx;
  const canVoid = t.status !== "void";
  return { title: t.no ? `Pesanan #${String(t.no).padStart(3, "0")}` : "Detail Transaksi", icon: "receipt", body: `
    ${t.status === "void" ? `<div class="notice danger" style="margin:0 0 12px">${icon("x")}<span><b>Dibatalkan</b> ${esc(fmtDateTime(t.voidAt))}${t.voidReason ? " — " + esc(t.voidReason) : ""}</span></div>` : ""}
    ${t.legacy ? `<div class="notice info" style="margin:0 0 12px">${icon("info")}<span>Transaksi dari versi lama. Angka HPP/laba bisa kurang akurat.</span></div>` : ""}
    <div class="receipt">${t.status === "void" ? '<span class="void-stamp">BATAL</span>' : ""}${receiptInner(t)}</div>
    ${state.ui.owner && !state.settings.staffMode ? `<div class="card" style="padding:12px 14px;margin-top:12px"><div class="kv" style="margin:0"><span>${T().cost} (modal)</span><b>${rp(t.totalHpp)}</b></div><div class="kv"><span>Laba kotor</span><b style="color:var(--green)">${rp(t.profit)}</b></div>${t.by ? `<div class="kv"><span>Dicatat oleh</span><b>${esc(t.by)}</b></div>` : ""}</div>` : ""}
    <div class="actions-3"><button class="btn outline" data-action="print-tx">${icon("printer")}Cetak</button><button class="btn outline" data-action="wa-tx">${icon("wa")}WhatsApp</button><button class="btn outline" data-action="share-tx">${icon("share")}Bagikan</button></div>`,
    foot: canVoid ? `<button class="btn danger-outline block" data-action="void-tx">${icon("x")}Batalkan Transaksi</button>` : "" };
};
async function openTxDetail(id) {
  let t = state.report?.txs.find(x => x.id === id);
  if (!t) t = await DB.get("tx", id);
  if (t) openSheet("txDetail", { tx: t });
}
async function doVoid() {
  const t = state.ui.modal?.tx; if (!t) return;
  if (!(await requireOwner("Pembatalan transaksi butuh PIN pemilik."))) return;
  const reason = await confirmDialog({ title: "Batalkan transaksi?", text: `Transaksi <b>${rp(t.total)}</b> akan ditandai BATAL, dikeluarkan dari laporan, dan stok yang terpakai dikembalikan. Tindakan ini tercatat.`, ok: "Batalkan", icon: "x", input: "Alasan (wajib), mis. salah input" });
  if (reason === false) return;
  const res = await voidTx(t, reason);
  if (!res.ok) return toast(res.msg, true);
  state.report = null; state.ui.modal = { type: "txDetail", tx: res.tx }; renderOverlay();
  await loadReport(true); renderScreen(); renderNav(); toast("Transaksi dibatalkan & stok dikembalikan.");
}

/* ---------- CSV export (PRO) ---------- */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function exportCSV() {
  if (!isPro()) return openPro("export");
  const r = await loadReport(true);
  if (!r.txs.length) return toast("Belum ada transaksi pada periode ini.", true);
  const head = ["ID Transaksi", "No", "Tanggal", "Jam", "Status", "Pelanggan", "Metode", "Subtotal", "Promo", "Hadiah Stamp", "Pembulatan", "Diskon", "Layanan", "Pajak", "Total", "HPP", "Laba Kotor", "Uang Diterima", "Kembalian", "Item"];
  const rows = [head];
  for (const t of r.txs.slice().reverse()) rows.push([t.id, t.no || "", t.day, fmtTime(t.date), t.status === "void" ? "BATAL" : "LUNAS", t.customer || "", methodLabel(t.method), money(t.subtotal), money(t.promo?.amount), money(t.reward), money(t.rounding), money(t.discount?.amount), money(t.service), money(t.tax), money(t.total), money(t.totalHpp), money(t.profit), money(t.cash), money(t.change), (t.items || []).map(i => `${i.name} x${fmtQty(i.qty)}`).join("; ")]);
  const items = [["ID Transaksi", "Tanggal", "Status", "Produk", "Varian", "Kategori", "Qty", "Harga", "Total Baris", "HPP Baris", "Catatan"]];
  for (const t of r.txs.slice().reverse()) for (const i of t.items || []) items.push([t.id, t.day, t.status === "void" ? "BATAL" : "LUNAS", i.name, i.opts || "", i.cat || "", Number(i.qty), money(i.price), money(i.lineTotal), money(i.hppTotal), i.note || ""]);
  const toCsv = rs => "﻿" + rs.map(x => x.map(csvCell).join(",")).join("\r\n");
  const tag = `${r.from}_sd_${r.to}`;
  downloadBlob(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), `Transaksi_${tag}.csv`);
  setTimeout(() => downloadBlob(new Blob([toCsv(items)], { type: "text/csv;charset=utf-8" }), `Item_Terjual_${tag}.csv`), 400);
  toast("2 file CSV dibuat (transaksi & item terjual).");
}
