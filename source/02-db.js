/* =====================================================================
   02-db.js — persistence
   IndexedDB (primary) with a localStorage fallback that keeps the same API.
   Stores:
     kv        settings | catalog | cart | held | meta | errlog | snap:*
     tx        transactions (keyPath id, index day)
     images    productId/asset id -> dataURL
     stocklog  append-only stock movements (autoIncrement)
   A sale / void is committed ATOMICALLY (tx + catalog + stocklog in one
   IndexedDB transaction) so stock and history can never disagree.
   ===================================================================== */
const DB = (() => {
  let db = null, mode = "idb";
  const STORES = ["kv", "tx", "images", "stocklog", "exp", "shifts"];

  function req2p(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  function done(t) { return new Promise((res, rej) => { t.oncomplete = () => { DB.ver++; res(true); }; t.onerror = () => rej(t.error || new Error("Transaksi database gagal")); t.onabort = () => rej(t.error || new Error("Transaksi database dibatalkan")); }); }

  async function open() {
    if (!("indexedDB" in window)) return useFallback("IndexedDB tidak tersedia");
    try {
      db = await new Promise((res, rej) => {
        const r = indexedDB.open(APP.dbName, 2); // v2: + exp (pengeluaran), shifts (tutup kasir)
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
          if (!d.objectStoreNames.contains("tx")) { const s = d.createObjectStore("tx", { keyPath: "id" }); s.createIndex("day", "day"); }
          if (!d.objectStoreNames.contains("images")) d.createObjectStore("images");
          if (!d.objectStoreNames.contains("stocklog")) { const s = d.createObjectStore("stocklog", { keyPath: "seq", autoIncrement: true }); s.createIndex("itemId", "itemId"); }
          if (!d.objectStoreNames.contains("exp")) { const s = d.createObjectStore("exp", { keyPath: "id" }); s.createIndex("day", "day"); }
          if (!d.objectStoreNames.contains("shifts")) { const s = d.createObjectStore("shifts", { keyPath: "id" }); s.createIndex("day", "day"); }
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error("Database sedang dipakai tab lain. Tutup tab lain lalu muat ulang."));
        setTimeout(() => rej(new Error("Database tidak merespons")), 8000);
      });
      db.onversionchange = () => { db.close(); location.reload(); };
      mode = "idb";
      return mode;
    } catch (e) {
      console.warn("IDB open failed", e);
      return useFallback(e?.message || "IndexedDB gagal");
    }
  }

  /* ---------- localStorage fallback (same async API) ---------- */
  const FB_KEY = "nyala-fallback-v1";
  let fb = null;
  function useFallback(reason) {
    mode = "local"; DB.fallbackReason = reason;
    try { fb = JSON.parse(localStorage.getItem(FB_KEY) || "null"); } catch (_) { fb = null; }
    if (!fb || typeof fb !== "object") fb = { kv: {}, tx: {}, images: {}, stocklog: [] };
    fb.exp = fb.exp || {}; fb.shifts = fb.shifts || {};
    return mode;
  }
  function fbSave() { localStorage.setItem(FB_KEY, JSON.stringify(fb)); } // throws on quota → caller handles

  async function get(store, key) {
    if (mode === "local") return deepCopyMaybe(store === "stocklog" ? null : fb[store][key]);
    const t = db.transaction(store); return req2p(t.objectStore(store).get(key));
  }
  function deepCopyMaybe(v) { return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)); }
  async function put(store, value, key) {
    if (mode === "local") {
      if (store === "stocklog") fb.stocklog.push(value);
      else fb[store][key ?? value.id] = deepCopyMaybe(value);
      fbSave(); DB.ver++; return true;
    }
    const t = db.transaction(store, "readwrite");
    const s = t.objectStore(store);
    if (s.keyPath) s.put(value); else s.put(value, key);
    return done(t);
  }
  async function del(store, key) {
    if (mode === "local") { delete fb[store][key]; fbSave(); return true; }
    const t = db.transaction(store, "readwrite"); t.objectStore(store).delete(key); return done(t);
  }
  async function all(store) {
    if (mode === "local") return store === "stocklog" ? deepCopyMaybe(fb.stocklog) : Object.values(deepCopyMaybe(fb[store]));
    const t = db.transaction(store); return req2p(t.objectStore(store).getAll());
  }
  async function allKeys(store) {
    if (mode === "local") return Object.keys(fb[store]);
    const t = db.transaction(store); return req2p(t.objectStore(store).getAllKeys());
  }
  async function count(store) {
    if (mode === "local") return store === "stocklog" ? fb.stocklog.length : Object.keys(fb[store]).length;
    const t = db.transaction(store); return req2p(t.objectStore(store).count());
  }
  /** transactions whose day key is within [from, to] (inclusive, YYYY-MM-DD) */
  async function txRange(from, to) {
    if (mode === "local") return Object.values(fb.tx).filter(t => t.day >= from && t.day <= to).map(deepCopyMaybe);
    const t = db.transaction("tx");
    return req2p(t.objectStore("tx").index("day").getAll(IDBKeyRange.bound(from, to)));
  }
  async function rangeOf(store, from, to) {
    if (mode === "local") return Object.values(fb[store]).filter(t => t.day >= from && t.day <= to).map(deepCopyMaybe);
    const t = db.transaction(store);
    return req2p(t.objectStore(store).index("day").getAll(IDBKeyRange.bound(from, to)));
  }
  /** stock movements newer than `sinceIso`, walking backwards from the newest (fast even with 100k+ rows) */
  async function logsSince(sinceIso) {
    if (mode === "local") return fb.stocklog.filter(l => l.at >= sinceIso);
    return new Promise((res, rej) => {
      const out = []; const t = db.transaction("stocklog"); const r = t.objectStore("stocklog").openCursor(null, "prev");
      r.onsuccess = () => { const c = r.result; if (!c || c.value.at < sinceIso) return res(out); out.push(c.value); c.continue(); };
      r.onerror = () => rej(r.error);
    });
  }
  async function logsFor(itemId, limit = 30) {
    if (mode === "local") return fb.stocklog.filter(l => l.itemId === itemId).slice(-limit).reverse();
    const t = db.transaction("stocklog");
    const rows = await req2p(t.objectStore("stocklog").index("itemId").getAll(IDBKeyRange.only(itemId)));
    return rows.slice(-limit).reverse();
  }

  /** atomic: write transaction record + catalog + stock log rows */
  async function commit({ tx, catalog, logs = [], kv = {}, exp = null, shift = null }) {
    if (mode === "local") {
      const backup = JSON.stringify(fb);
      try {
        if (tx) fb.tx[tx.id] = deepCopyMaybe(tx);
        if (exp) fb.exp[exp.id] = deepCopyMaybe(exp);
        if (shift) fb.shifts[shift.id] = deepCopyMaybe(shift);
        if (catalog) fb.kv.catalog = deepCopyMaybe(catalog);
        for (const [k, v] of Object.entries(kv)) fb.kv[k] = deepCopyMaybe(v);
        for (const l of logs) fb.stocklog.push(l);
        fbSave(); DB.ver++; return true;
      } catch (e) { fb = JSON.parse(backup); throw e; }
    }
    const t = db.transaction(["tx", "kv", "stocklog", "exp", "shifts"], "readwrite");
    if (tx) t.objectStore("tx").put(tx);
    if (exp) t.objectStore("exp").put(exp);
    if (shift) t.objectStore("shifts").put(shift);
    if (catalog) t.objectStore("kv").put(catalog, "catalog");
    for (const [k, v] of Object.entries(kv)) t.objectStore("kv").put(v, k);
    const ls = t.objectStore("stocklog"); for (const l of logs) ls.add(l);
    return done(t);
  }

  /** atomic full replace (restore). Caller must snapshot first. */
  async function replaceAll(data) {
    if (mode === "local") {
      const backup = JSON.stringify(fb);
      try {
        fb = { kv: {}, tx: {}, images: {}, stocklog: [], exp: {}, shifts: {} };
        for (const x of data.exp || []) fb.exp[x.id] = x;
        for (const x of data.shifts || []) fb.shifts[x.id] = x;
        for (const [k, v] of Object.entries(data.kv || {})) fb.kv[k] = v;
        for (const x of data.tx || []) fb.tx[x.id] = x;
        for (const [k, v] of Object.entries(data.images || {})) fb.images[k] = v;
        fb.stocklog = data.stocklog || [];
        fbSave(); return true;
      } catch (e) { fb = JSON.parse(backup); throw e; }
    }
    const t = db.transaction(STORES, "readwrite");
    for (const s of STORES) t.objectStore(s).clear();
    for (const [k, v] of Object.entries(data.kv || {})) t.objectStore("kv").put(v, k);
    for (const x of data.tx || []) t.objectStore("tx").put(x);
    for (const [k, v] of Object.entries(data.images || {})) t.objectStore("images").put(v, k);
    const ls = t.objectStore("stocklog"); for (const l of data.stocklog || []) { const c = { ...l }; delete c.seq; ls.add(c); }
    for (const x of data.exp || []) t.objectStore("exp").put(x);
    for (const x of data.shifts || []) t.objectStore("shifts").put(x);
    return done(t);
  }
  async function clearAll() { return replaceAll({}); }

  return { ver: 0, open, get, put, del, all, allKeys, count, txRange, rangeOf, logsFor, logsSince, commit, replaceAll, clearAll, get mode() { return mode; }, fallbackReason: "" };
})();

/* ---------- Write-behind for small, frequently changing records ---------- */
const Persist = (() => {
  const dirty = new Set(); let timer = null;
  // Small records (cart, held, meta) are written immediately: an IDB transaction is opened
  // synchronously, so the write survives an instant reload / app kill. Larger ones are batched.
  const IMMEDIATE = new Set(["cart", "held", "meta"]);
  function mark(...keys) {
    keys.forEach(k => dirty.add(k));
    if (keys.every(k => IMMEDIATE.has(k))) return flush();
    clearTimeout(timer); timer = setTimeout(flush, 160);
  }
  async function flush() {
    clearTimeout(timer);
    const keys = [...dirty]; dirty.clear();
    // start all writes synchronously (before any await) so none are lost on unload
    const jobs = keys.map(k => { try { return DB.put("kv", deepCopy(state[k]), k).then(() => null, e => [k, e]); } catch (e) { return Promise.resolve([k, e]); } });
    for (const r of await Promise.all(jobs)) { if (r) { dirty.add(r[0]); reportStorageError(r[1]); } else state.storageError = null; }
  }
  return { mark, flush, get pending() { return dirty.size; } };
})();
function reportStorageError(e) {
  console.error("Storage error", e);
  const quota = /quota|QuotaExceeded|space/i.test(String(e?.name || "") + String(e?.message || ""));
  state.storageError = quota ? "Memori penyimpanan perangkat penuh. Hapus foto/produk lama atau buat cadangan lalu kosongkan data." : "Gagal menyimpan data ke perangkat. Jangan tutup aplikasi, coba lagi.";
  toast(state.storageError, true);
  logError("storage", e);
}
async function logError(scope, e) {
  try {
    const list = (await DB.get("kv", "errlog")) || [];
    list.unshift({ at: new Date().toISOString(), scope, msg: String(e?.message || e).slice(0, 300), v: APP.version });
    await DB.put("kv", list.slice(0, 30), "errlog");
  } catch (_) {}
}
