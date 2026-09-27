/* =====================================================================
   08-ui-settings.js — onboarding, lock screen, settings, PRO/pricing,
   licence activation, backup/restore, security, about.
   ===================================================================== */

/* ---------- Onboarding ---------- */
function renderOnboarding() {
  const o = state.ui.onb;
  const steps = `<div class="steps">${[1, 2, 3].map(i => `<i class="${o.step >= i ? "on" : ""}"></i>`).join("")}</div>`;
  let body = "";
  if (o.step === 1) body = `<div class="logo">${icon("flame")}</div><h1>Halo! Selamat datang di ${esc(APP.name)} 👋</h1><p class="lead">Kasir, HPP, stok, dan laporan untung-rugi — langsung di HP, tetap jalan tanpa internet.</p>
      <div class="form-label">Nama usaha <small>tampil di struk</small></div><input id="onb-name" class="input" maxlength="60" value="${esc(o.name)}" placeholder="Contoh: Kopi Senja" autocomplete="organization">
      <div class="form-label">Nama Anda <small>opsional</small></div><input id="onb-owner" class="input" maxlength="40" value="${esc(o.owner)}" placeholder="Contoh: Andi" autocomplete="name">
      <button class="btn primary block" style="margin-top:20px" data-action="onb-next">Lanjut ${icon("arrow")}</button>
      <button class="btn soft block" style="margin-top:10px" data-action="restore">${icon("upload")}Pulihkan dari cadangan</button>`;
  if (o.step === 2) body = `${steps}<h1>Usaha Anda jenis apa?</h1><p class="lead">Istilah dan cara hitung modal menyesuaikan. Bisa diubah nanti.</p>
      <div class="type-grid">${Object.entries(BIZ).map(([k, b]) => `<button class="type-card ${o.type === k ? "on" : ""}" data-action="onb-type" data-value="${k}"><span class="em">${b.em}</span><b>${esc(b.label)}</b><small>${esc(b.hint)}</small></button>`).join("")}</div>
      <div style="display:flex;gap:9px;margin-top:20px"><button class="btn soft" data-action="onb-back">${icon("back")}</button><button class="btn primary" style="flex:1" data-action="onb-next">Lanjut ${icon("arrow")}</button></div>`;
  if (o.step === 3) body = `${steps}<h1>Mulai dari mana?</h1><p class="lead">Contoh menu membantu Anda mencoba semua fitur. Bisa dihapus kapan saja.</p>
      <button class="choice ${o.demo ? "on" : ""}" data-action="onb-demo" data-value="1"><span class="radio"></span><span><b>Pakai contoh ${esc(BIZ[o.type].label.split(" /")[0].toLowerCase())}</b><small>Menu, ${esc(BIZ[o.type].itemWord)}, dan ${esc(BIZ[o.type].usage.toLowerCase())} siap coba.</small></span></button>
      <button class="choice ${!o.demo ? "on" : ""}" data-action="onb-demo" data-value="0"><span class="radio"></span><span><b>Mulai dari kosong</b><small>Langsung isi menu Anda sendiri.</small></span></button>
      <div class="notice info" style="margin:16px 0 0">${icon("crown")}<span>Semua fitur <b>PRO gratis ${APP.trialDays} hari</b>. Setelah itu tetap bisa pakai paket Gratis.</span></div>
      <div style="display:flex;gap:9px;margin-top:18px"><button class="btn soft" data-action="onb-back">${icon("back")}</button><button class="btn success" style="flex:1" data-action="onb-finish">${icon("sparkle")}Mulai Jualan</button></div>`;
  return `<div class="onb"><div class="onb-card">${body}</div><p style="text-align:center;color:#8e9ab0;font-size:12px;margin-top:16px">Data tersimpan di perangkat ini · ${esc(APP.name)} v${esc(APP.version)}</p></div>`;
}
async function finishOnboarding() {
  const o = state.ui.onb;
  const settings = { ...defaultSettings(o.type), storeName: cleanText(o.name, 60), ownerName: cleanText(o.owner, 40) };
  const catalog = buildCatalogFromPreset(o.type, o.demo);
  const meta = { ...state.meta, trialStart: new Date().toISOString() };
  try {
    await DB.commit({ catalog, kv: { settings, meta, cart: emptyCart(), held: [] } });
    state.settings = settings; state.catalog = catalog; state.meta = meta; state.cart = emptyCart(); state.held = [];
    await refreshPlan(); state.ui.tab = "pos"; render();
    toast(`PRO gratis ${APP.trialDays} hari aktif. Selamat berjualan!`);
    requestPersistentStorage();
  } catch (e) { reportStorageError(e); }
}

/* ---------- Lock screen ---------- */
let pinBuffer = "";
function renderLock() {
  return `<div class="lock"><div class="logo">${icon("lock")}</div><h2>${esc(state.settings.storeName)}</h2><p>Masukkan PIN untuk membuka</p>
    <div class="pin-dots" id="pin-dots">${[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, pinBuffer.length)).map(i => `<i class="${i < pinBuffer.length ? "on" : ""}"></i>`).join("")}</div>
    <div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-action="pin-key" data-value="${n}">${n}</button>`).join("")}<button class="ghost" data-action="pin-clear">Hapus</button><button data-action="pin-key" data-value="0">0</button><button class="ghost" data-action="pin-enter">OK</button></div></div>`;
}
async function pinKey(k) {
  if (k === "clear") pinBuffer = pinBuffer.slice(0, -1);
  else if (k !== "enter" && pinBuffer.length < 6) pinBuffer += k;
  if (k === "enter" || pinBuffer.length === 6 || (pinBuffer.length >= 4 && k === "enter")) {
    if (pinBuffer.length < 4) return;
    if (await checkPin(pinBuffer)) { pinBuffer = ""; state.ui.locked = false; state.ui.owner = !state.settings.staffMode; render(); return; }
    pinBuffer = ""; render(); const d = $("#pin-dots"); if (d) d.classList.add("shake"); haptic([30, 40, 30]); return;
  }
  render();
}

/* ---------- Settings screen ---------- */
function setItem(action, ic, title, sub = "", extra = "") { return `<button class="set-item" data-action="${action}"><span class="si">${icon(ic)}</span><span class="sm"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span>${extra}<span class="chev">${icon("chev")}</span></button>`; }
function planCardHtml() {
  const l = state.lic;
  if (l.tier === "PRO") return `<div class="plan-card"><span class="pill pro">${icon("crown")}PRO aktif</span><h3>Terima kasih sudah mendukung!</h3><p>Terdaftar atas nama <b style="color:#fff">${esc(l.name || "-")}</b>${l.exp ? ` · berlaku s.d. ${esc(fmtDate(parseDayKey(l.exp)))}` : " · seumur hidup"}.</p><button class="btn outline sm" data-action="open-license">${icon("key")}Detail lisensi</button></div>`;
  if (l.tier === "TRIAL") return `<div class="plan-card"><span class="pill trial">Coba PRO · sisa ${l.daysLeft} hari</span><h3>Semua fitur PRO sedang terbuka</h3><p>Setelah masa coba, data tetap aman & aplikasi tetap bisa dipakai di paket Gratis.</p><button class="btn amber block" data-action="open-pro">${icon("crown")}Lihat paket PRO</button></div>`;
  return `<div class="plan-card"><span class="pill muted">Paket Gratis</span><h3>Buka laporan lengkap, stok otomatis & produk tanpa batas</h3><p>${l.invalid ? esc(l.invalid) + " " : ""}Mulai ±Rp16 ribuan per bulan — bayar per tahun atau sekali seumur hidup, tanpa tagihan bulanan.</p><button class="btn amber block" data-action="open-pro">${icon("crown")}Upgrade ke PRO</button></div>`;
}
function renderSettings() {
  const s = state.settings;
  if (s.staffMode && !state.ui.owner) {
    return `<div class="screen"><div class="page-head"><div class="title">Pengaturan</div><div class="sub">Mode Karyawan — fitur pemilik terkunci</div></div><div class="section">
      <div class="set-card">${setItem("owner-login", "unlock", "Masuk sebagai pemilik", "Butuh PIN pemilik")}${setItem("about", "info", "Tentang aplikasi", `v${esc(APP.version)}`)}</div></div></div>`;
  }
  const t = T();
  return `<div class="screen"><div class="page-head"><div class="title">Pengaturan</div><div class="sub">${esc(s.storeName)}${s.ownerName ? " · " + esc(s.ownerName) : ""}</div></div>
  <div class="section">
    ${planCardHtml()}
    <div class="set-card"><div class="set-title">Usaha</div>
      ${setItem("open-store", "store", "Profil usaha & struk", esc([s.address, s.phone].filter(Boolean).join(" · ") || "Nama, alamat, logo, catatan struk"))}
      ${setItem("open-biz", "layers", "Jenis usaha", `${BIZ[s.type].em} ${esc(t.label)}`)}
      ${setItem("open-payset", "wallet", "Metode pembayaran & QRIS", METHODS.filter(m => s.methods[m[0]] !== false).map(m => m[2]).join(", "))}
      ${setItem("open-customers", "user", "Pelanggan & kartu stamp " + proTag(), s.stamp?.enabled ? `Aktif · ${state.customers.length} pelanggan` : "Stamp digital: beli 10 gratis 1")}
      ${setItem("open-target", "flame", "Target harian", money(s.dailyTarget) ? rp(s.dailyTarget) + " per hari" : "Pasang target & rayakan saat tercapai")}
      ${setItem("open-poster", "image", "Poster menu " + proTag(), "Gambar menu siap posting ke Status WA / IG")}
      ${setItem("open-promos", "zap", "Promo otomatis / Happy Hour " + proTag(), (s.promos || []).filter(p => p.active).length ? `${(s.promos || []).filter(p => p.active).length} promo aktif` : "Diskon otomatis di jam & hari tertentu")}
      ${setItem("open-tax", "percent", "Pajak, layanan & pembulatan " + proTag(), s.taxBp || s.serviceBp || s.roundingStep ? `${esc(s.taxLabel)} ${s.taxBp / 100}% · Layanan ${s.serviceBp / 100}%${s.roundingStep ? " · bulat " + rp(s.roundingStep) : ""}` : "Tidak aktif")}
    </div>
    <div class="set-card"><div class="set-title">Kasir & stok</div><div class="set-inner">
      <div class="switch-row"><div><b>Stok otomatis ${proTag()}</b><small>Kurangi stok ${esc(t.itemWord)} setiap penjualan.</small></div>${switchHtml("set-stock", stockEnabled(), isPro() ? "" : 'data-pro="1"')}</div>
      <div class="switch-row"><div><b>Tolak jual saat stok habis</b><small>Jika mati, penjualan tetap boleh & stok bisa minus (ditandai).</small></div>${switchHtml("set-block", s.blockOversell)}</div>
      <div class="switch-row"><div><b>Tanya nama pelanggan / meja</b><small>Tampil di keranjang, struk & nomor antrean.</small></div>${switchHtml("set-cust", s.askCustomer)}</div>
      <div class="switch-row"><div><b>Suara transaksi</b><small>Bunyi "ting" saat pembayaran berhasil.</small></div>${switchHtml("set-sound", s.sound !== false)}</div>
      <div class="switch-row"><div><b>Getar</b><small>Umpan balik saat menambah item.</small></div>${switchHtml("set-haptic", s.haptic !== false)}</div>
    </div></div>
    <div class="set-card"><div class="set-title">Keamanan</div>
      ${setItem("open-pin", "lock", s.pinHash ? "Ubah / hapus PIN pemilik" : "Buat PIN pemilik", s.pinHash ? "PIN aktif" : "Lindungi laporan, pembatalan & pengaturan")}
      ${s.pinHash ? `<div class="set-inner" style="padding-top:0"><div class="switch-row" style="border-top:1px solid #f0f2f6"><div><b>Minta PIN saat aplikasi dibuka</b></div>${switchHtml("set-lock", s.lockOnOpen)}</div></div>` : ""}
      ${setItem("staff-mode", "user", "Mode Karyawan " + proTag(), s.pinHash ? "Karyawan hanya bisa berjualan; HPP, laba, menu & pengaturan terkunci" : "Buat PIN pemilik dulu")}
    </div>
    <div class="set-card"><div class="set-title">Data & cadangan</div>
      ${setItem("backup", "download", "Buat cadangan (backup)", state.meta.lastBackupAt ? "Terakhir: " + esc(fmtDateTime(state.meta.lastBackupAt)) : "Belum pernah — disarankan tiap minggu", backupOverdue() ? '<span class="tag mid">Perlu</span>' : "")}
      ${setItem("restore", "upload", "Pulihkan dari cadangan", "Pindah HP / ganti browser")}
      ${setItem("open-sync", "cloud", "Sinkronisasi antar perangkat", esc(SYNC.statusText()))}
      <div class="set-inner" id="storage-info"><div class="help" style="margin:0">Menghitung penyimpanan…</div></div>
    </div>
    <div class="set-card"><div class="set-title">Aplikasi</div>
      ${installPrompt ? setItem("install", "install", "Pasang di layar utama", "Buka seperti aplikasi, tanpa bilah browser") : ""}
      ${setItem("open-theme", "moon", "Tampilan", { auto: "Otomatis (ikuti HP)", light: "Terang", dark: "Gelap" }[s.theme || "auto"])}
      ${setItem("check-update", "refresh", "Cek pembaruan", `Versi ${esc(APP.version)}`)}
      ${setItem("help", "help", "Panduan singkat", "Cara pakai dalam 1 menit")}
      ${setItem("about", "info", "Tentang & diagnostik", `${esc(APP.name)} · penyimpanan ${DB.mode === "idb" ? "IndexedDB" : "terbatas"}`)}
    </div>
    <button class="btn danger-outline block" data-action="wipe" style="margin-bottom:8px">${icon("trash")}Hapus semua data di perangkat ini</button>
    <p class="help" style="text-align:center;margin:12px 0 0">${esc(APP.name)} ${esc(APP.version)} · ${esc(APP.tagline)}</p>
  </div></div>`;
}
async function fillStorageInfo() {
  const el = $("#storage-info"); if (!el) return;
  try {
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    const txc = await DB.count("tx");
    const used = est?.usage || 0, quota = est?.quota || 0;
    el.innerHTML = `<div class="kv" style="margin:0"><span>${txc} transaksi · ${state.catalog.products.length} produk</span><b>${(used / 1048576).toFixed(1).replace(".", ",")} MB</b></div>${quota ? `<div class="storage-bar"><i style="width:${Math.max(2, Math.min(100, used / quota * 100))}%"></i></div>` : ""}<div class="help">${persisted ? "✅ Penyimpanan permanen aktif (tidak dihapus otomatis oleh browser)." : "ℹ️ Pasang aplikasi ke layar utama agar penyimpanan lebih awet. Tetap rutin backup."}</div>`;
  } catch (_) { el.innerHTML = ""; }
}

/* ---------- Store profile ---------- */
SHEETS.store = (m) => {
  const d = m.draft; const logo = d.logoData || ImageCache.url(d.logoId);
  return { title: "Profil Usaha & Struk", icon: "store", tall: true, noBackdropClose: true, body: `
    <div class="form-label">Nama usaha</div><input id="st-name" class="input" maxlength="60" value="${esc(d.storeName)}">
    <div class="form-label">Nama pemilik <small>opsional</small></div><input id="st-owner" class="input" maxlength="40" value="${esc(d.ownerName)}">
    <div class="form-label">Alamat <small>tampil di struk</small></div><input id="st-address" class="input" maxlength="120" value="${esc(d.address)}" placeholder="Jl. ...">
    <div class="form-label">No. telepon / WhatsApp</div><input id="st-phone" class="input" inputmode="tel" maxlength="30" value="${esc(d.phone)}">
    <div class="form-label">Catatan bawah struk</div><input id="st-footer" class="input" maxlength="120" value="${esc(d.footer)}" placeholder="Terima kasih! IG @tokosaya">
    <div class="form-label">Logo di struk & header ${proTag()}</div>
    <div class="upload-row"><div class="upload-preview">${logo ? `<img src="${esc(logo)}" alt="" style="width:100%;height:100%;object-fit:cover">` : icon("store")}</div><div style="flex:1;display:flex;gap:6px;flex-direction:column"><button class="btn outline sm" data-action="st-logo">${logo ? "Ganti logo" : "Pilih logo"}</button>${logo ? `<button class="btn soft sm" data-action="st-logo-del">Hapus logo</button>` : ""}</div><input id="st-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div>
    <div class="form-label">Lebar kertas printer</div><div class="seg"><button class="${d.paper !== "80" ? "on" : ""}" data-action="st-paper" data-value="58">58 mm</button><button class="${d.paper === "80" ? "on" : ""}" data-action="st-paper" data-value="80">80 mm</button></div>
    <div class="help">Printer thermal Bluetooth di Android: pasang aplikasi layanan cetak (mis. RawBT) lalu pilih sebagai printer saat menekan Cetak.</div>`,
    foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="st-save">${icon("check")}Simpan</button>` };
};
async function saveStore() {
  const d = state.ui.modal.draft;
  const name = cleanText(d.storeName, 60); if (!name) return toast("Nama usaha wajib diisi.", true);
  const settings = { ...state.settings, storeName: name, ownerName: cleanText(d.ownerName, 40), address: cleanText(d.address, 120), phone: cleanText(d.phone, 30), footer: cleanText(d.footer, 120), paper: d.paper === "80" ? "80" : "58" };
  const oldLogo = state.settings.logoId;
  try {
    if (d.logoData) { const id = "logo-" + uid(); await DB.put("images", d.logoData, id); ImageCache.set(id, d.logoData); settings.logoId = id; }
    else if (d.logoData === null) settings.logoId = null;
    await DB.put("kv", settings, "settings"); state.settings = settings;
    if (oldLogo && oldLogo !== settings.logoId) await dropImageIfUnused(oldLogo);
    closeSheet(); renderScreen(); toast("Profil usaha disimpan");
  } catch (e) { reportStorageError(e); }
}

/* ---------- Business type ---------- */
SHEETS.biz = (m) => ({ title: "Jenis Usaha", icon: "layers", body: `
  <div class="type-grid">${Object.entries(BIZ).map(([k, b]) => `<button class="type-card ${m.value === k ? "on" : ""}" data-action="biz-pick" data-value="${k}"><span class="em">${b.em}</span><b>${esc(b.label)}</b><small>${esc(b.hint)}</small></button>`).join("")}</div>
  <button class="choice ${!m.demo ? "on" : ""}" data-action="biz-demo" data-value="0"><span class="radio"></span><span><b>Ganti istilah saja</b><small>Menu, ${esc(T().itemWord)} & riwayat tetap. Aman.</small></span></button>
  <button class="choice ${m.demo ? "on" : ""}" data-action="biz-demo" data-value="1"><span class="radio"></span><span><b>Ganti + muat contoh katalog</b><small>Katalog sekarang <b>diganti</b> contoh. Cadangan otomatis dibuat dulu; riwayat transaksi tetap.</small></span></button>`,
  foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="biz-save">Terapkan</button>` });
async function saveBiz() {
  const m = state.ui.modal; if (!BIZ[m.value]) return;
  if (m.value === state.settings.type && !m.demo) return closeSheet();
  if (m.demo) {
    const ok = await confirmDialog({ title: "Ganti katalog?", text: "Katalog & stok sekarang akan diganti contoh. Salinan katalog lama disimpan dan bisa dipulihkan dari file cadangan yang akan diunduh.", ok: "Ganti", icon: "alert" });
    if (!ok) return;
    await doBackup(true);
  }
  const settings = { ...state.settings, type: m.value };
  const catalog = m.demo ? buildCatalogFromPreset(m.value, true) : state.catalog;
  try {
    await DB.commit({ catalog, kv: { settings, cart: emptyCart() } });
    state.settings = settings; state.catalog = catalog; if (m.demo) state.cart = emptyCart();
    state.ui.cat = "Semua"; closeSheet(); renderScreen(); renderNav(); toast("Jenis usaha diperbarui");
  } catch (e) { reportStorageError(e); }
}

/* ---------- Payment settings ---------- */
SHEETS.payset = (m) => {
  const d = m.draft; const q = d.qrisData || ImageCache.url(d.qrisImageId);
  return { title: "Metode Pembayaran", icon: "wallet", tall: true, noBackdropClose: true, body: `
    <div class="card" style="padding:4px 14px">${METHODS.map(([k, ic, label]) => `<div class="switch-row"><div style="display:flex;gap:10px;align-items:center"><span class="icon-btn" style="width:36px;height:36px">${icon(ic)}</span><b>${label}</b></div>${switchHtml("pm-" + k, d.methods[k] !== false, `data-method="${k}"`)}</div>`).join("")}</div>
    <div class="form-label">Gambar QRIS toko <small>ditampilkan saat pelanggan bayar QRIS</small></div>
    <div class="upload-row"><div class="upload-preview" style="width:96px;height:96px">${q ? `<img src="${esc(q)}" alt="" style="width:100%;height:100%;object-fit:contain;background:#fff">` : icon("qr")}</div><div style="flex:1;display:flex;flex-direction:column;gap:6px"><button class="btn outline sm" data-action="ps-qris">${q ? "Ganti QRIS" : "Unggah QRIS"}</button>${q ? `<button class="btn soft sm" data-action="ps-qris-del">Hapus</button>` : ""}</div><input id="ps-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div>
    <div class="help">Foto/screenshot QRIS statis dari bank / e-wallet Anda. Tetap cek notifikasi dana masuk sebelum memproses.</div>
    <div class="form-label">Info rekening transfer <small>opsional</small></div><input id="ps-transfer" class="input" maxlength="80" value="${esc(d.transferInfo)}" placeholder="Contoh: BCA 1234567890 a.n. Kopi Senja">`,
    foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="ps-save">${icon("check")}Simpan</button>` };
};
async function savePayset() {
  const d = state.ui.modal.draft;
  if (!METHODS.some(([k]) => d.methods[k] !== false)) return toast("Aktifkan minimal satu metode.", true);
  const settings = { ...state.settings, methods: { ...d.methods }, transferInfo: cleanText(d.transferInfo, 80) };
  const old = state.settings.qrisImageId;
  try {
    if (d.qrisData) { const id = "qris-" + uid(); await DB.put("images", d.qrisData, id); ImageCache.set(id, d.qrisData); settings.qrisImageId = id; }
    else if (d.qrisData === null) settings.qrisImageId = null;
    await DB.put("kv", settings, "settings"); state.settings = settings;
    if (old && old !== settings.qrisImageId) await dropImageIfUnused(old);
    closeSheet(); renderScreen(); toast("Metode pembayaran disimpan");
  } catch (e) { reportStorageError(e); }
}

/* ---------- Tax & service ---------- */
SHEETS.tax = () => {
  const s = state.settings;
  return { title: "Pajak & Biaya Layanan", icon: "percent", body: `
    <div class="form-label">Nama pajak</div><input id="tx-label" class="input" maxlength="20" value="${esc(s.taxLabel || "Pajak")}" placeholder="PB1 / PPN / Pajak">
    <div class="form-row"><div><div class="form-label">Pajak (%)</div><div class="input-affix suffix"><span>%</span><input id="tx-tax" class="input" inputmode="decimal" value="${s.taxBp ? String(s.taxBp / 100).replace(".", ",") : ""}" placeholder="0"></div></div>
    <div><div class="form-label">Layanan (%)</div><div class="input-affix suffix"><span>%</span><input id="tx-svc" class="input" inputmode="decimal" value="${s.serviceBp ? String(s.serviceBp / 100).replace(".", ",") : ""}" placeholder="0"></div></div></div>
    <div class="help">Urutan hitung: Subtotal − Diskon → + Layanan → Pajak dihitung dari (Subtotal − Diskon + Layanan). Pajak tidak dihitung sebagai laba. Kosongkan untuk menonaktifkan.</div>
    <div class="form-label">Pembulatan total <small>selalu ke bawah — pelanggan untung</small></div><div class="seg">${[[0, "Tidak"], [100, "Rp100"], [500, "Rp500"], [1000, "Rp1.000"]].map(([v, l]) => `<button class="${(state.ui.modal.round ?? s.roundingStep ?? 0) === v ? "on" : ""}" data-action="tx-round" data-value="${v}">${l}</button>`).join("")}</div>
    <div class="help">Contoh Rp27.850 → Rp27.800 (Rp100) / Rp27.500 (Rp500). Selisih tercatat sebagai "Pembulatan" dan mengurangi laba.</div>`,
    foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="tax-save">${icon("check")}Simpan</button>` };
};
async function saveTax() {
  const tb = pctToBp($("#tx-tax")?.value || "0"), sb = pctToBp($("#tx-svc")?.value || "0");
  if (tb === null || sb === null || tb > 5000 || sb > 5000) return toast("Persentase harus 0–50%.", true);
  const round = state.ui.modal.round ?? state.settings.roundingStep ?? 0;
  const settings = { ...state.settings, taxBp: tb, serviceBp: sb, taxLabel: cleanText($("#tx-label")?.value, 20) || "Pajak", roundingStep: [0, 100, 500, 1000].includes(round) ? round : 0 };
  try { await DB.put("kv", settings, "settings"); state.settings = settings; closeSheet(); renderScreen(); toast("Pajak & layanan disimpan"); } catch (e) { reportStorageError(e); }
}

/* ---------- PIN ---------- */
async function pinFlow() {
  const s = state.settings;
  if (s.pinHash) {
    if (!(await requireOwner("Masukkan PIN lama."))) return;
    const choice = await confirmDialog({ title: "PIN pemilik", text: "Ubah PIN atau hapus PIN? Menghapus PIN juga mematikan Mode Karyawan & kunci aplikasi.", ok: "Ubah PIN", cancel: "Hapus PIN", danger: false, icon: "lock" });
    if (choice === false) {
      const sure = await confirmDialog({ title: "Hapus PIN?", text: "Laporan, pembatalan & pengaturan tidak lagi dilindungi.", ok: "Hapus", icon: "alert" });
      if (!sure) return;
      return saveSettings({ pinHash: null, pinSalt: null, lockOnOpen: false, staffMode: false }, "PIN dihapus");
    }
  }
  const p1 = await confirmDialog({ title: "PIN baru", text: "4–6 angka. Jangan pakai tanggal lahir.", ok: "Lanjut", danger: false, icon: "lock", input: "PIN baru", pin: true });
  if (p1 === false) return;
  if (!/^\d{4,6}$/.test(p1)) return toast("PIN harus 4–6 angka.", true);
  const p2 = await confirmDialog({ title: "Ulangi PIN", text: "Ketik PIN yang sama sekali lagi.", ok: "Simpan PIN", danger: false, icon: "lock", input: "Ulangi PIN", pin: true });
  if (p2 === false) return;
  if (p1 !== p2) return toast("PIN tidak sama.", true);
  try { const h = await hashPin(p1); await saveSettings({ pinHash: h.hash, pinSalt: h.salt }, "PIN pemilik aktif"); }
  catch (e) { toast(e.message || "Gagal membuat PIN.", true); }
}
async function saveSettings(patch, msg) {
  const settings = { ...state.settings, ...patch };
  try { await DB.put("kv", settings, "settings"); state.settings = settings; renderScreen(); renderNav(); if (msg) toast(msg); return true; }
  catch (e) { reportStorageError(e); return false; }
}
async function toggleStaffMode() {
  if (!isPro()) return openPro("staff");
  if (!state.settings.pinHash) { toast("Buat PIN pemilik dulu.", true); return pinFlow(); }
  const ok = await confirmDialog({ title: "Aktifkan Mode Karyawan?", text: "Karyawan hanya bisa berjualan & melihat transaksi hari ini. HPP, laba, menu, pembatalan & pengaturan butuh PIN pemilik.", ok: "Aktifkan", danger: false, icon: "user" });
  if (!ok) return;
  state.ui.owner = false; state.ui.tab = "pos";
  await saveSettings({ staffMode: true }, "Mode Karyawan aktif");
  render();
}
async function ownerLogin() {
  if (!(await requireOwner("Masukkan PIN pemilik."))) return;
  const exit = await confirmDialog({ title: "Masuk sebagai pemilik", text: "Matikan Mode Karyawan sepenuhnya, atau buka akses pemilik sementara (kembali terkunci saat aplikasi dibuka ulang)?", ok: "Matikan Mode Karyawan", cancel: "Sementara", danger: false, icon: "unlock" });
  state.ui.owner = true;
  if (exit) await saveSettings({ staffMode: false }, "Mode Karyawan dimatikan");
  render();
}

/* ---------- PRO / pricing ---------- */
/* Harga normal + harga perkenalan (APP.promoUntil). Ubah di satu tempat ini. */
const PRICING = [
  { id: "y1", label: "PRO 1 Tahun", price: 199000, promo: 149000, note: "≈ Rp16.600/bulan", ribbon: "Paling laris" },
  { id: "life", label: "PRO Selamanya", price: 399000, promo: 299000, note: "Sekali bayar, tanpa perpanjangan", ribbon: "" },
  { id: "m3", label: "PRO 3 Bulan", price: 69000, promo: 0, note: "Coba dulu", ribbon: "" },
];
function promoActive() { return !!APP.promoUntil && dayKey() <= APP.promoUntil; }
function planPrice(p) { return promoActive() && p.promo ? p.promo : p.price; }
const PRO_FEATURES = ["Promo otomatis Happy Hour + daftar belanja pintar", "Asisten Untung: saran harga, stok habis, tren & jam ramai", "Varian tanpa batas + HPP per pilihan (Gratis: 2 grup)", "Kas & laba bersih: pengeluaran, buka/tutup kasir, hitung laci", "Kartu stamp digital & data pelanggan", "Poster menu otomatis untuk Status WA / IG", "Produk & menu tanpa batas (Gratis: " + APP.freeProductLimit + ")", "Stok otomatis + peringatan menipis + stok opname", "Laporan 30 hari, bulanan, produk terlaris & jam ramai", "Export CSV (transaksi & item terjual)", "Diskon, pajak & biaya layanan", "Simpan pesanan / open bill", "Mode Karyawan dengan PIN pemilik", "Logo toko di struk"];
SHEETS.pro = (m) => {
  const sel = m.plan || "y1";
  const reason = { limit: `Paket Gratis maksimal ${APP.freeProductLimit} produk.`, export: "Export CSV adalah fitur PRO.", hold: "Simpan pesanan (open bill) adalah fitur PRO.", stock: "Stok otomatis adalah fitur PRO.", staff: "Mode Karyawan adalah fitur PRO.", discount: "Diskon & pajak adalah fitur PRO.", cash: "Kas, pengeluaran & laba bersih adalah fitur PRO.", customers: "Kartu stamp & pelanggan adalah fitur PRO.", poster: "Poster menu otomatis adalah fitur PRO.", variants: "Paket Gratis maksimal 2 grup varian.", promo: "Promo otomatis (Happy Hour) adalah fitur PRO.", period: "Laporan periode panjang adalah fitur PRO." }[m.reason] || "";
  return { title: APP.name + " PRO", icon: "crown", tall: true, body: `
    <div class="crown">${icon("crown")}</div>
    <p style="text-align:center;margin:0 0 6px;font-weight:800;font-size:18px">Jualan lebih rapi, untung lebih jelas</p>
    ${reason ? `<p class="help" style="text-align:center;margin:0 0 8px">${esc(reason)}</p>` : ""}
    <div>${PRO_FEATURES.map(f => `<div class="feat">${icon("check")}<span>${esc(f)}</span></div>`).join("")}</div>
    <div class="plans">${PRICING.map(p => `<button class="plan-opt ${sel === p.id ? "on" : ""}" data-action="pick-plan" data-value="${p.id}">${p.ribbon ? `<span class="ribbon">${esc(p.ribbon)}</span>` : ""}<span class="radio"></span><span class="pm"><b>${esc(p.label)}</b><small>${esc(p.id === "y1" ? `≈ ${rp(Math.round(planPrice(p) / 12 / 100) * 100)}/bulan` : p.note)}</small></span><span class="pp">${promoActive() && p.promo ? `<s>${rp(p.price)}</s>` : ""}<strong>${rp(planPrice(p))}</strong></span></button>`).join("")}</div>
    <div class="help" style="text-align:center">Bukan langganan otomatis. Data tetap milik Anda di perangkat ini. 1 lisensi = 1 toko.</div>
    <button class="btn soft block" style="margin-top:12px" data-action="open-license">${icon("key")}Sudah punya kode lisensi?</button>`,
    foot: `<button class="btn amber block" data-action="buy" style="height:56px">${icon("crown")}Beli ${esc(PRICING.find(p => p.id === sel).label)}</button>` };
};
function openPro(reason = "") { openSheet("pro", { reason, plan: "y1" }); }
function buyPlan() {
  const p = PRICING.find(x => x.id === (state.ui.modal?.plan || "y1"));
  const msg = `Halo, saya mau beli ${APP.name} ${p.label} (${rp(planPrice(p))}).\nNama usaha: ${state.settings.storeName}\nNama pemilik lisensi: ${state.settings.ownerName || "-"}`;
  const url = APP.buyUrl ? `${APP.buyUrl}${APP.buyUrl.includes("?") ? "&" : "?"}plan=${p.id}` : APP.supportWa ? `https://wa.me/${APP.supportWa}?text=${encodeURIComponent(msg)}` : "";
  if (!url) return toast("Link pembelian belum diatur penjual (APP.buyUrl / APP.supportWa).", true);
  const w = window.open(url, "_blank", "noopener"); if (!w) location.href = url;
}
SHEETS.license = (m) => {
  const l = state.lic, cur = state.settings.license?.key || "";
  return { title: "Aktivasi Lisensi", icon: "key", body: `
    ${l.tier === "PRO" ? `<div class="notice info" style="margin:0 0 12px">${icon("shield")}<span>PRO aktif · ${esc(l.name || "")}${l.exp ? " · s.d. " + esc(fmtDate(parseDayKey(l.exp))) : " · seumur hidup"}${l.id ? " · " + esc(l.id) : ""}</span></div>` : ""}
    ${l.invalid ? `<div class="notice danger" style="margin:0 0 12px">${icon("alert")}<span>${esc(l.invalid)}</span></div>` : ""}
    <div class="form-label">Tempel kode lisensi</div><textarea id="lic-key" class="textarea" rows="4" placeholder="NYL1.xxxxx.yyyyy" spellcheck="false" autocapitalize="off" autocomplete="off" style="font-family:ui-monospace,monospace;font-size:13px">${esc(m.key ?? cur)}</textarea>
    <div class="help">Kode dikirim penjual via WhatsApp/email setelah pembayaran. Aktivasi dilakukan offline — tidak perlu internet.</div>`,
    foot: `${cur ? `<button class="btn soft" data-action="lic-remove">Lepas</button>` : ""}<button class="btn success" data-action="lic-activate">${icon("check")}Aktifkan</button>` };
};
async function activateLicense(raw) {
  const key = String(raw || "").replace(/\s+/g, "");
  const v = await verifyLicenseKey(key);
  if (!v.ok) return toast(v.msg, true);
  if (await saveSettings({ license: { key, at: new Date().toISOString() } })) {
    await refreshPlan(); closeSheet(); render(); toast(`PRO aktif — terima kasih, ${v.payload.n || "Kak"}! 🎉`);
  }
}

/* ---------- Backup / restore / wipe ---------- */
async function doBackup(silent = false) {
  try {
    await Persist.flush();
    const data = await buildBackup();
    const name = `Cadangan_${(state.settings.storeName || APP.short).replace(/[^\w-]+/g, "_").slice(0, 30)}_${dayKey()}.json`;
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const file = typeof File === "function" ? new File([blob], name, { type: "application/json" }) : null;
    let shared = false;
    if (!silent && file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name, text: "Cadangan data " + APP.name }); shared = true; } catch (e) { if (e?.name === "AbortError") return false; }
    }
    if (!shared) downloadBlob(blob, name);
    state.meta = { ...state.meta, lastBackupAt: new Date().toISOString() }; Persist.mark("meta");
    if (!silent) { renderScreen(); renderNav(); toast(`Cadangan dibuat (${data.counts.tx} transaksi). Simpan di Google Drive / WhatsApp.`); }
    return true;
  } catch (e) { logError("backup", e); toast("Gagal membuat cadangan.", true); return false; }
}
function pickRestoreFile() {
  let inp = $("#restore-file");
  if (!inp) { inp = document.createElement("input"); inp.type = "file"; inp.id = "restore-file"; inp.accept = "application/json,.json"; inp.hidden = true; document.body.appendChild(inp); }
  inp.value = ""; inp.click();
}
async function restoreFromFile(file) {
  if (!file) return;
  if (file.size > 80 * 1024 * 1024) return toast("File terlalu besar.", true);
  let parsed;
  try { parsed = validateBackup(JSON.parse(await file.text())); }
  catch (e) { return toast(e.message && !/JSON/.test(e.message) ? e.message : "File cadangan rusak / bukan JSON.", true); }
  const s = parsed.summary;
  const hasData = state.settings.storeName && (state.catalog.products.length || state.meta.hasSales);
  const ok = await confirmDialog({ title: "Pulihkan data?", text: `Cadangan <b>${esc(s.store || "-")}</b>${s.exportedAt ? " (" + esc(fmtDateTime(s.exportedAt)) + ")" : ""}: ${s.products} produk, ${s.items} ${esc(T().itemWord)}, ${s.tx} transaksi.${hasData ? "<br><br>Data di perangkat ini akan <b>diganti</b>. Salinan data sekarang diunduh otomatis lebih dulu." : ""}`, ok: "Pulihkan", danger: !!hasData, icon: "upload" });
  if (!ok) return;
  if (hasData && !(await doBackup(true))) { const go = await confirmDialog({ title: "Cadangan otomatis gagal", text: "Tetap lanjutkan pemulihan? Data sekarang akan hilang.", ok: "Tetap lanjut", icon: "alert" }); if (!go) return; }
  try {
    await DB.replaceAll(parsed);
    toast("Data dipulihkan. Memuat ulang…");
    setTimeout(() => location.reload(), 700);
  } catch (e) { reportStorageError(e); }
}
async function wipeAll() {
  if (!(await requireOwner("Hapus data butuh PIN pemilik."))) return;
  const typed = await confirmDialog({ title: "Hapus SEMUA data?", text: "Produk, stok, transaksi & pengaturan di perangkat ini akan dihapus permanen. Cadangan otomatis diunduh lebih dulu.<br><br>Ketik <b>HAPUS</b> untuk konfirmasi.", ok: "Hapus permanen", icon: "trash", input: "HAPUS" });
  if (typed === false) return;
  if (typed.trim().toUpperCase() !== "HAPUS") return toast("Konfirmasi tidak cocok. Data tidak dihapus.", true);
  await doBackup(true);
  try { await DB.clearAll(); location.reload(); } catch (e) { reportStorageError(e); }
}

/* ---------- Help & about ---------- */
SHEETS.help = () => ({ title: "Panduan Singkat", icon: "help", body: `
  ${[["bag", "Jualan", "Ketuk menu untuk menambah ke keranjang. Ketuk total di bar bawah untuk ubah jumlah, catatan, atau diskon."],
     ["wallet", "Bayar", "Pilih metode, masukkan uang diterima (atau Uang Pas), tekan Proses. Struk bisa dicetak / dikirim ke WhatsApp."],
     ["box", "HPP otomatis", `Isi ${T().itemWord} di tab ${T().stock}, lalu atur ${T().usage.toLowerCase()} di tiap menu. Laba per transaksi dihitung otomatis.`],
     ["layers", "Varian", "Menu → tab Varian: buat Ukuran, Level gula, Topping sekali, pasang ke banyak menu. Harga & HPP tambahan dihitung otomatis."],
     ["chart", "Laporan", "Tab Laporan: laba kotor, metode bayar, produk terlaris, jam ramai. Transaksi salah bisa dibatalkan (stok kembali)."],
     ["sparkle", "Asisten Untung", "Di Laporan: saran harga untuk menu bermargin tipis, perkiraan stok habis, tren & jam ramai — dihitung dari data toko Anda sendiri."],
     ["cash", "Kas & laba bersih", "Laporan → Kas: buka kasir dengan modal laci, catat pengeluaran, tutup kasir & lihat selisih uang serta laba bersih."],
     ["user", "Kartu stamp", "Pilih pelanggan di keranjang. Tiap belanja dapat stamp; saat penuh, hadiah jadi potongan otomatis."],
     ["shield", "Aman", "Data tersimpan di HP ini & tetap jalan tanpa internet. Buat cadangan tiap minggu, simpan ke Google Drive/WhatsApp."]]
    .map(([ic, t, d]) => `<div class="feat">${icon(ic)}<span><b>${t}.</b> ${esc(d)}</span></div>`).join("")}`,
  foot: `<button class="btn primary block" data-action="close-sheet">Mengerti</button>` });
SHEETS.about = (m) => ({ title: "Tentang & Diagnostik", icon: "info", body: `
  <div class="card" style="padding:12px 14px">
    <div class="kv" style="margin:0"><span>Aplikasi</span><b>${esc(APP.name)} ${esc(APP.version)}</b></div>
    <div class="kv"><span>Build</span><b>${esc(APP.build)}</b></div>
    <div class="kv"><span>Penyimpanan</span><b>${DB.mode === "idb" ? "IndexedDB" : "localStorage (terbatas)"}</b></div>
    <div class="kv"><span>ID instalasi</span><b style="font-size:11px">${esc(state.meta.installId)}</b></div>
    <div class="kv"><span>Paket</span><b>${esc(state.lic.tier)}</b></div>
    <div class="kv"><span>Mode tampilan</span><b>${matchMedia("(display-mode: standalone)").matches ? "Aplikasi terpasang" : "Browser"}</b></div>
  </div>
  <div class="section-title" style="margin-top:16px"><h3>${icon("alert")}Log kesalahan</h3></div>
  <div class="card" style="padding:10px 14px;font-size:12px;max-height:220px;overflow:auto">${(m.log || []).length ? m.log.map(l => `<div style="padding:6px 0;border-top:1px solid #f0f2f6"><b>${esc(l.scope)}</b> · ${esc(fmtDateTime(l.at))}<br><span style="color:var(--muted)">${esc(l.msg)}</span></div>`).join("") : `<span class="help">Tidak ada kesalahan tercatat. 👍</span>`}</div>
  <p class="help">Data tidak pernah dikirim ke server. Bila butuh bantuan, salin log ini ke penjual.</p>`,
  foot: `<button class="btn outline" data-action="copy-log">${icon("copy")}Salin log</button><button class="btn primary" data-action="close-sheet">Tutup</button>` });
