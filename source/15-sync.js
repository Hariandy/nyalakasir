/* =====================================================================
   15-sync.js — Sinkronisasi antar perangkat
   Backend: proyek Firebase (Firestore) milik PENGGUNA sendiri — gratis,
   bukan server Nyala Kasir. Login anonim (tanpa email/akun pelanggan).

   Model penggabungan data (dipilih agar TIDAK PERNAH menghapus data diam-diam):
   - "Log" (transaksi, kartu stok, pengeluaran, tutup kasir): setiap catatan
     jadi 1 dokumen. Perangkat lain hanya MENAMBAH catatan baru, atau — khusus
     transaksi — menandai lunas→batal (mengikuti pembatalan yang sah). Catatan
     yang sudah ada TIDAK PERNAH dihapus atau ditimpa sembarangan.
   - "Kondisi saat ini" (menu, pelanggan, pesanan tertahan, pengaturan, kasir
     yang sedang buka): 1 dokumen per jenis, yang terakhir disimpan menang.
     Keterbatasan yang disadari: bila 2 perangkat mengedit MENU/PELANGGAN saat
     SAMA-SAMA offline, perubahan yang tersambung ke internet lebih akhir bisa
     menimpa punya yang lain untuk jenis data ini saja. Data transaksi/kas
     tidak pernah terkena risiko ini.
   - Foto produk TIDAK disinkronkan (ukurannya besar untuk kuota gratis).
   ===================================================================== */
const SYNC = (() => {
  const STATE_KEYS = ["catalog", "customers", "held", "settings", "shiftCurrent"];
  const LOG_COLS = ["tx", "stocklog", "exp", "shifts"];
  const TICK_MS = 30000;
  let cfg = null, meta = null, ready = false, timer = null, busy = false, lastErr = null;

  /* ---------- kecil: hash non-kripto (deteksi "isinya berubah?") ---------- */
  function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function hashOf(v) { return hashStr(JSON.stringify(v)); }

  /* ---------- Firestore value <-> JS (REST, tanpa SDK, tanpa eval) ---------- */
  function fsEncode(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return Number.isFinite(v) && Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: Number(v) || 0 };
    if (typeof v === "string") return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(fsEncode) } };
    if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, vv]) => [k, fsEncode(vv)])) } };
    return { nullValue: null };
  }
  function fsDecode(f) {
    if (!f || typeof f !== "object") return null;
    if ("nullValue" in f) return null;
    if ("booleanValue" in f) return !!f.booleanValue;
    if ("integerValue" in f) return Number(f.integerValue);
    if ("doubleValue" in f) return Number(f.doubleValue);
    if ("stringValue" in f) return f.stringValue;
    if ("timestampValue" in f) return f.timestampValue;
    if ("arrayValue" in f) return (f.arrayValue.values || []).map(fsDecode);
    if ("mapValue" in f) { const o = {}; for (const [k, vv] of Object.entries(f.mapValue.fields || {})) o[k] = fsDecode(vv); return o; }
    return null;
  }
  function fsDoc(obj) { return { fields: Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, fsEncode(v)])) }; }
  function fsFromDoc(doc) { const o = {}; for (const [k, v] of Object.entries(doc?.fields || {})) o[k] = fsDecode(v); return o; }

  function fsErrMsg(j) {
    const m = String(j?.error?.message || j?.error?.status || j?.message || "Gagal terhubung.");
    if (/API key not valid|API_KEY_INVALID/i.test(m)) return "API key salah — cek kembali konfigurasi Firebase yang ditempel.";
    if (/PERMISSION_DENIED|insufficient permissions/i.test(m)) return "Ditolak (permission-denied). Pastikan aturan Firestore sudah ditempel & dipublikasikan, dan Anonymous sign-in aktif.";
    if (/CONFIGURATION_NOT_FOUND|OPERATION_NOT_ALLOWED|admin-restricted/i.test(m)) return "Login anonim belum diaktifkan — buka Authentication → Sign-in method → Anonymous → Enable.";
    if (/NOT_FOUND/i.test(m) && /database/i.test(m)) return "Firestore belum dibuat di proyek ini — buka Firestore Database → Create database.";
    if (/PROJECT_NOT_FOUND|project .* not found/i.test(m)) return "Project ID tidak ditemukan — cek kembali konfigurasi yang ditempel.";
    return m;
  }

  /* ---------- Auth (anonim) ---------- */
  const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1", TOKEN_BASE = "https://securetoken.googleapis.com/v1";
  async function anonSignUp() {
    const r = await fetch(`${AUTH_BASE}/accounts:signUp?key=${encodeURIComponent(cfg.apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(fsErrMsg(j));
    return { idToken: j.idToken, refreshToken: j.refreshToken, uid: j.localId, exp: Date.now() + (Number(j.expiresIn) || 3600) * 1000 - 60000 };
  }
  async function refreshIdToken() {
    const r = await fetch(`${TOKEN_BASE}/token?key=${encodeURIComponent(cfg.apiKey)}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(meta.auth.refreshToken)}` });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(fsErrMsg(j));
    return { idToken: j.id_token, refreshToken: j.refresh_token, uid: j.user_id, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60000 };
  }
  async function ensureAuth() {
    if (meta.auth?.idToken && meta.auth.exp > Date.now()) return meta.auth.idToken;
    const a = meta.auth?.refreshToken ? await refreshIdToken() : await anonSignUp();
    meta.auth = a; await saveMeta();
    return a.idToken;
  }

  /* ---------- Firestore REST ---------- */
  const FS_BASE = "https://firestore.googleapis.com/v1";
  function fsRoot() { return `${FS_BASE}/projects/${cfg.projectId}/databases/(default)/documents`; }
  async function fsGet(relPath, token) {
    const r = await fetch(`${fsRoot()}/${relPath}?key=${encodeURIComponent(cfg.apiKey)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 404) return null;
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(fsErrMsg(j));
    return j;
  }
  async function fsBatchWrite(writes, token) {
    if (!writes.length) return [];
    const body = { writes: writes.map(w => ({ update: { name: `projects/${cfg.projectId}/databases/(default)/documents/${w.path}`, ...fsDoc(w.obj) } })) };
    const r = await fetch(`${FS_BASE}/projects/${cfg.projectId}/databases/(default)/documents:batchWrite?key=${encodeURIComponent(cfg.apiKey)}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(fsErrMsg(j));
    return j.writeResults || [];
  }
  async function fsQuerySince(collectionId, field, sinceVal, token) {
    const out = []; let cursor = sinceVal, guard = 0;
    while (guard++ < 50) {
      const body = { structuredQuery: { from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath: field }, op: "GREATER_THAN", value: fsEncode(cursor) } }, orderBy: [{ field: { fieldPath: field }, direction: "ASCENDING" }], limit: 300 } };
      const r = await fetch(`${fsRoot()}/stores/${cfg.storeId}:runQuery?key=${encodeURIComponent(cfg.apiKey)}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(fsErrMsg(Array.isArray(j) ? j[0] : j));
      const docs = (Array.isArray(j) ? j : []).filter(x => x.document).map(x => x.document);
      out.push(...docs);
      if (docs.length < 300) break;
      cursor = fsFromDoc(docs[docs.length - 1])._v;
    }
    return out;
  }

  /* ---------- Config & bookkeeping (lokal, tidak ikut cadangan) ---------- */
  function defaultMetaObj() { return { auth: null, pushedHash: {}, log: Object.fromEntries(LOG_COLS.map(c => [c, { cursor: 0, hash: {} }])), lastSyncAt: null, lastError: null }; }
  async function loadAll() {
    cfg = (await DB.get("kv", "syncCfg").catch(() => null)) || { enabled: false, projectId: "", apiKey: "", storeId: "", createdAt: null };
    meta = (await DB.get("kv", "syncMeta").catch(() => null)) || defaultMetaObj();
    meta.log = { ...defaultMetaObj().log, ...(meta.log || {}) };
    ready = true;
  }
  async function saveCfg() { await DB.put("kv", cfg, "syncCfg"); }
  async function saveMeta() { await DB.put("kv", meta, "syncMeta").catch(() => {}); }

  function statusText() {
    if (!cfg?.enabled) return "Belum diaktifkan — sinkron menu, transaksi & stok antar-HP";
    if (lastErr) return "Bermasalah: " + lastErr;
    if (!meta.lastSyncAt) return "Menunggu sinkron pertama…";
    return "Tersambung · terakhir sinkron " + fmtDateTime(meta.lastSyncAt);
  }

  /* ---------- State (kondisi saat ini): 1 dokumen per jenis, LWW ---------- */
  function stateValueOf(key) {
    if (key === "shiftCurrent") return state.shift || null;
    return state[key];
  }
  async function applyStateLocally(key, val) {
    if (key === "catalog") { const c = sanitizeCatalog(val || {}); await DB.put("kv", c, "catalog"); state.catalog = c; }
    else if (key === "customers") { const c = (Array.isArray(val) ? val : []).filter(x => x && x.id).slice(0, 5000).map(sanitizeCustomer); await DB.put("kv", c, "customers"); state.customers = c; }
    else if (key === "held") { const h = (Array.isArray(val) ? val : []).slice(0, 50).filter(x => x && Array.isArray(x.lines)).map(sanitizeHeldOne); await DB.put("kv", h, "held"); state.held = h; }
    else if (key === "settings") { const defs = defaultSettings(val?.type); const s = { ...defs, ...(val || {}) }; s.stamp = { ...defs.stamp, ...(val?.stamp || {}) }; s.storeName = cleanText(s.storeName, 60); s.address = cleanText(s.address, 120); s.phone = cleanText(s.phone, 30); s.footer = cleanText(s.footer, 120); s.promos = (Array.isArray(s.promos) ? s.promos : []).slice(0, 10).map(sanitizePromo); await DB.put("kv", s, "settings"); state.settings = s; applyTheme(); }
    else if (key === "shiftCurrent") { const sh = val && typeof val === "object" ? sanitizeShift(val, false) : null; await DB.put("kv", sh, "shift"); state.shift = sh; }
    meta.pushedHash[key] = hashOf(stateValueOf(key));
  }
  async function pullState(token) {
    let changed = false;
    for (const key of STATE_KEYS) {
      const doc = await fsGet(`stores/${cfg.storeId}/state/${key}`, token);
      if (!doc) continue;
      const remote = fsFromDoc(doc); const val = remote.v;
      const h = hashOf(val);
      if (h !== meta.pushedHash[key]) { await applyStateLocally(key, val); changed = true; }
    }
    return changed;
  }
  async function pushState(token) {
    const writes = [];
    for (const key of STATE_KEYS) {
      const val = stateValueOf(key); const h = hashOf(val);
      if (meta.pushedHash[key] === h) continue;
      writes.push({ path: `stores/${cfg.storeId}/state/${key}`, obj: { v: val, _v: Date.now() } });
    }
    if (writes.length) { await fsBatchWrite(writes, token); for (const w of writes) meta.pushedHash[w.path.split("/").pop()] = hashOf(w.obj.v); }
  }

  /* ---------- Log (transaksi/stok/kas): 1 dokumen per catatan, tambah/tandai saja ---------- */
  async function stableStocklog() {
    const rows = await DB.all("stocklog");
    let dirty = false;
    for (const r of rows) if (!r._sid) { r._sid = uid("sl"); await DB.put("stocklog", r); dirty = true; }
    return dirty ? DB.all("stocklog") : rows;
  }
  async function pushLogs(token) {
    for (const col of LOG_COLS) {
      const rows = col === "stocklog" ? await stableStocklog() : await DB.all(col);
      const idOf = r => col === "stocklog" ? r._sid : r.id;
      const writes = [];
      for (const r of rows) {
        const id = idOf(r); if (!id) continue;
        const h = hashOf(r);
        if (meta.log[col].hash[id] === h) continue;
        writes.push({ id, path: `stores/${cfg.storeId}/${col}/${id}`, obj: { ...r, _v: Date.now() }, h });
        if (writes.length >= 400) break; // sisanya menyusul tick berikutnya
      }
      for (let i = 0; i < writes.length; i += 400) {
        const batch = writes.slice(i, i + 400);
        await fsBatchWrite(batch.map(w => ({ path: w.path, obj: w.obj })), token);
        for (const w of batch) meta.log[col].hash[w.id] = w.h;
      }
    }
  }
  async function pullLogs(token) {
    let changed = false;
    for (const col of LOG_COLS) {
      const docs = await fsQuerySince(col, "_v", meta.log[col].cursor || 0, token);
      if (!docs.length) continue;
      for (const doc of docs) {
        const remote = fsFromDoc(doc); const idOf = col === "stocklog" ? remote._sid : remote.id;
        if (!idOf) continue;
        if (col === "tx") { if (await mergeTx(remote)) changed = true; }
        else if (col === "exp") { const local = await DB.get("exp", remote.id); if (!local) { const s = sanitizeExp(remote); if (s) { await DB.put("exp", s); changed = true; } } }
        else if (col === "shifts") { const local = await DB.get("shifts", remote.id); if (!local) { const s = sanitizeShift(remote, true); if (s) { await DB.put("shifts", s); changed = true; } } }
        else if (col === "stocklog") { const rows = await DB.all("stocklog"); if (!rows.some(r => r._sid === remote._sid)) { const rec = { ...remote }; delete rec.seq; delete rec._v; await DB.put("stocklog", rec); changed = true; } }
        meta.log[col].hash[idOf] = hashOf({ ...remote, _v: undefined });
        meta.log[col].cursor = Math.max(meta.log[col].cursor || 0, remote._v || 0);
      }
    }
    return changed;
  }
  /** transaksi hanya boleh berpindah lunas -> batal dari perangkat lain, tidak pernah dihapus/ditimpa lain */
  async function mergeTx(remote) {
    const local = await DB.get("tx", remote.id);
    if (!local) { const s = sanitizeTx(remote); if (!s) return false; await DB.put("tx", s); return true; }
    if (local.status === "paid" && remote.status === "void") { const s = sanitizeTx({ ...local, status: "void", voidReason: remote.voidReason, voidAt: remote.voidAt }); if (s) { await DB.put("tx", s); return true; } }
    return false;
  }

  /* ---------- Siklus sinkron ---------- */
  async function tick(manual = false) {
    if (busy || !cfg?.enabled || !cfg.projectId || !cfg.apiKey || !cfg.storeId) return;
    if (!navigator.onLine) { lastErr = manual ? "Tidak ada koneksi internet." : lastErr; return; }
    busy = true;
    try {
      const token = await ensureAuth();
      const pulledLogs = await pullLogs(token);
      const pulledState = await pullState(token);
      const pulled = pulledLogs || pulledState;
      await pushLogs(token);
      await pushState(token);
      lastErr = null; meta.lastSyncAt = new Date().toISOString();
      await saveMeta();
      if (pulled) { state.report = null; if (["pos", "history", "settings", "insights"].includes(state.ui.tab)) renderScreen(); }
      if (manual) toast("Sinkron selesai.");
    } catch (e) {
      lastErr = e?.message || "Gagal sinkron.";
      meta.lastError = lastErr; await saveMeta();
      if (manual) toast(lastErr, true);
      console.warn("sync", e);
    } finally { busy = false; if (state.ui.modal?.type === "sync") renderOverlay(); if (state.ui.tab === "settings") renderScreen(); }
  }

  function schedule() {
    clearInterval(timer); timer = null;
    if (!cfg?.enabled) return;
    timer = setInterval(() => { if (document.visibilityState === "visible") tick(); }, TICK_MS);
  }

  /* ---------- Penyiapan (dipanggil dari UI) ---------- */
  function parseFirebaseConfig(text) {
    const grab = k => { const m = new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`).exec(text || ""); return m ? m[1] : ""; };
    return { apiKey: grab("apiKey"), projectId: grab("projectId") };
  }
  function randomStoreCode() { return Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join(""); }
  async function remoteHasData() {
    try { const token = await ensureAuth(); const doc = await fsGet(`stores/${cfg.storeId}/state/catalog`, token); const v = doc ? fsFromDoc(doc).v : null; return !!(v && ((v.products || []).length || (v.items || []).length)); }
    catch (_) { return false; }
  }
  async function enable(rawConfig, storeCode) {
    const parsed = parseFirebaseConfig(rawConfig);
    if (!parsed.apiKey || !parsed.projectId) return { ok: false, msg: "Tempel seluruh kode konfigurasi Firebase (apiKey & projectId harus ada)." };
    const code = (storeCode || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || randomStoreCode();
    cfg = { enabled: true, apiKey: parsed.apiKey, projectId: parsed.projectId, storeId: code, createdAt: new Date().toISOString() };
    meta = defaultMetaObj();
    try {
      const hasRemote = await remoteHasData();
      if (hasRemote) {
        const adopt = await confirmDialog({ title: "Sudah ada data di kode toko ini", text: "Ditemukan menu yang tersimpan untuk kode toko ini. Pakai data itu di perangkat ini (disarankan bila ini perangkat KEDUA)? Data di perangkat ini sekarang akan diganti — cadangan otomatis diunduh dulu.", ok: "Ya, pakai data itu", cancel: "Tidak, pakai data di HP ini", icon: "download" });
        await doBackup(true).catch(() => {});
        const token = await ensureAuth();
        if (adopt) { await pullState(token); await pullLogs(token); }
        else { await pushState(token); await pushLogs(token); } // pilih pakai data HP ini: timpa balik dulu sebelum tick lain menariknya
      }
      await saveCfg(); await saveMeta();
      await tick(true);
      schedule();
      return { ok: true };
    } catch (e) { cfg.enabled = false; await saveCfg().catch(() => {}); return { ok: false, msg: e?.message || "Gagal menyambungkan." }; }
  }
  async function disable() {
    cfg.enabled = false; await saveCfg(); clearInterval(timer); timer = null; lastErr = null;
  }

  async function boot() {
    await loadAll();
    if (cfg.enabled) schedule();
    window.addEventListener("online", () => tick());
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
  }

  return { boot, enable, disable, tick, statusText, get cfg() { return cfg; }, get meta() { return meta; }, get ready() { return ready; }, get busy() { return busy; }, randomStoreCode };
})();

/* ---------- UI: Pengaturan > Sinkronisasi ---------- */
SHEETS.sync = () => {
  const c = SYNC.cfg;
  if (!c?.enabled) return { title: "Sinkronisasi Antar Perangkat", icon: "cloud", tall: true, body: `
    <p class="help" style="margin-top:0">Hubungkan HP kasir Anda lewat <b>Firebase</b> — layanan Google, gratis untuk toko kecil, bukan server Nyala Kasir. Kode di bawah sudah jadi; Anda hanya perlu <b>copy-paste</b> beberapa nilai dari situs Firebase.</p>
    <div class="notice info"><span>${icon("info")}</span><span><b>Langkah 1–5 di situs Firebase</b> (sekali saja, ±5 menit):<br>
    1. Buka <b>console.firebase.google.com</b> → Add project → beri nama (misal nama toko Anda).<br>
    2. Menu kiri → <b>Build → Firestore Database → Create database</b> → pilih lokasi asia (mis. asia-southeast1) → Start in <b>production mode</b>.<br>
    3. Tab <b>Rules</b> di Firestore → hapus isinya, tempel kode di bawah → <b>Publish</b>.<br>
    4. Menu kiri → <b>Build → Authentication → Get started → Sign-in method → Anonymous → Enable</b>.<br>
    5. Ikon gerigi (Project settings) → scroll ke "Your apps" → klik ikon <b>&lt;/&gt; Web</b> → beri nama → Register app → <b>copy semua kode <code>firebaseConfig</code></b> yang muncul.</span></div>
    <div class="form-label">Aturan Firestore <small>tempel ke tab Rules lalu Publish (langkah 3)</small></div>
    <pre class="code-box" id="sync-rules">rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /stores/{storeId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}</pre>
    <button class="btn outline sm" data-action="copy-rules" style="margin:8px 0 16px">${icon("copy")}Salin aturan</button>
    <div class="form-label">Tempel kode <code>firebaseConfig</code> dari langkah 5</div>
    <textarea id="sync-cfg" class="textarea" rows="5" style="font-family:ui-monospace,monospace;font-size:12.5px" placeholder="const firebaseConfig = {&#10;  apiKey: &quot;...&quot;,&#10;  projectId: &quot;...&quot;,&#10;  ...&#10;};" spellcheck="false" autocapitalize="off"></textarea>
    <div class="form-label">Kode toko <small>kosongkan di perangkat PERTAMA (dibuatkan otomatis) — di perangkat lain, ketik kode yang sama persis</small></div>
    <input id="sync-code" class="input" maxlength="20" placeholder="contoh: kedaisenja01">
    <div class="help">Semua data (menu, transaksi, stok, pelanggan) tersimpan di proyek Firebase milik Anda sendiri — bukan di server Nyala Kasir. Foto produk tidak ikut disinkronkan.</div>`,
    foot: `<button class="btn soft" data-action="close-sheet">Nanti dulu</button><button class="btn primary block" data-action="sync-enable">${icon("cloud")}Aktifkan Sinkronisasi</button>` };
  return { title: "Sinkronisasi Antar Perangkat", icon: "cloud", body: `
    <div class="notice ${SYNC.meta?.lastError ? "warn" : "info"}"><span>${icon(SYNC.meta?.lastError ? "alert" : "check")}</span><span>${esc(SYNC.statusText())}</span></div>
    <div class="form-label">Kode toko <small>masukkan kode yang sama di perangkat lain agar datanya tersambung</small></div>
    <div style="display:flex;gap:8px"><input class="input" readonly value="${esc(c.storeId)}" id="sync-code-view" style="flex:1;font-family:ui-monospace,monospace"><button class="btn soft" data-action="copy-code">${icon("copy")}</button></div>
    <div style="display:flex;gap:9px;margin-top:16px"><button class="btn soft" style="flex:1" data-action="sync-now">${icon("refresh")}Sinkron sekarang</button><button class="btn danger-outline" style="flex:1" data-action="sync-off">${icon("x")}Putuskan</button></div>
    <div class="help" style="margin-top:16px">Menu, pelanggan, pesanan tertahan & pengaturan: yang terakhir disimpan menang (jangan edit menu di 2 HP bersamaan saat sama-sama offline). Transaksi, kartu stok, pengeluaran & tutup kasir: hanya bertambah, tidak pernah hilang.</div>` };
};
Object.assign(ACTIONS, {
  "open-sync": () => openSheet("sync"),
  "copy-rules": async () => { try { await navigator.clipboard.writeText($("#sync-rules").textContent); toast("Aturan disalin — tempel di tab Rules Firestore lalu Publish."); } catch (_) { toast("Gagal menyalin.", true); } },
  "copy-code": async () => { try { await navigator.clipboard.writeText(SYNC.cfg.storeId); toast("Kode toko disalin."); } catch (_) { toast("Gagal menyalin.", true); } },
  "sync-enable": async () => {
    const raw = $("#sync-cfg")?.value || "", code = $("#sync-code")?.value || "";
    if (!raw.trim()) return toast("Tempel kode firebaseConfig dulu.", true);
    toast("Menyambungkan…");
    const r = await SYNC.enable(raw, code);
    if (r.ok) { toast("Sinkronisasi aktif 🎉"); openSheet("sync"); renderScreen(); }
    else toast(r.msg, true);
  },
  "sync-now": () => SYNC.tick(true),
  "sync-off": async () => { const ok = await confirmDialog({ title: "Putuskan sinkronisasi?", text: "Perangkat ini berhenti mengirim & menerima data. Data yang sudah tersimpan di perangkat ini tidak dihapus.", ok: "Putuskan", icon: "x" }); if (ok) { await SYNC.disable(); toast("Sinkronisasi dimatikan."); closeSheet(); renderScreen(); } },
});
