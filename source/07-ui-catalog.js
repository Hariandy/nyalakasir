/* =====================================================================
   07-ui-catalog.js — Menu/Produk, Bahan/Stok Grosir/Perlengkapan,
   product form (recipe/stock/manual cost + live margin + price advisor),
   item form, restock/opname, stock log, categories.
   ===================================================================== */
function renderCatalog() {
  const t = T(), tab = state.ui.catalogTab;
  const isProd = tab === "produk", isVar = tab === "varian";
  const q = state.ui.catSearch.trim().toLowerCase();
  const limit = !isPro() ? `<div class="help" style="margin:10px 2px 0">${state.catalog.products.length}/${APP.freeProductLimit} produk (paket Gratis) · <a href="#" data-action="open-pro" style="color:var(--blue);font-weight:750">Tanpa batas di PRO</a></div>` : "";
  return `<div class="screen">
    <div class="page-head">
      <div class="brand-row"><div style="min-width:0"><div class="title">${t.model === "stock" ? "Produk & Stok" : "Menu & " + esc(t.stock)}</div><div class="sub">${isProd ? `${state.catalog.products.length} produk · ${t.cost} dihitung otomatis` : isVar ? `${(state.catalog.optionGroups || []).length} grup · ukuran, level, topping` : `${state.catalog.items.length} ${esc(t.itemWord)} · ${esc(t.stockLong)}`}</div></div>
        <button class="add-btn" data-action="${isProd ? "add-product" : isVar ? "add-group" : "add-item"}">${icon("plus")}Tambah</button></div>
      <div class="tabs" style="grid-template-columns:repeat(3,1fr)"><button class="tab ${isProd ? "active" : ""}" data-action="catalog-tab" data-value="produk">${t.model === "stock" ? "Produk" : "Menu"}</button><button class="tab ${tab === "bahan" ? "active" : ""}" data-action="catalog-tab" data-value="bahan">${esc(t.stock)}</button><button class="tab ${isVar ? "active" : ""}" data-action="catalog-tab" data-value="varian">Varian</button></div>
      ${isVar ? "" : `<div class="search" style="margin-top:12px">${icon("search")}<input id="cat-search" type="search" value="${esc(state.ui.catSearch)}" placeholder="Cari ${isProd ? "produk" : t.itemWord}…" autocomplete="off"></div>`}
      ${isProd ? limit : ""}
    </div>
    <div class="section"><div class="list" id="cat-list">${isProd ? renderProductRows(q) : isVar ? renderGroupRows() : renderItemRows(q)}</div>
    ${isProd ? `<button class="btn outline block" style="margin-top:12px" data-action="manage-cats">${icon("layers")}Kelola kategori</button>` : ""}</div>
  </div>`;
}
function refreshCatalogList() { const l = $("#cat-list"); if (!l) return; const q = state.ui.catSearch.trim().toLowerCase(); l.innerHTML = state.ui.catalogTab === "produk" ? renderProductRows(q) : state.ui.catalogTab === "varian" ? renderGroupRows() : renderItemRows(q); }
function costDesc(p) {
  const t = T();
  if (p.costMode === "manual") return `${t.cost} manual`;
  if (p.costMode === "stock") { const it = findItem(p.stockItemId); return it ? `Stok: ${esc(it.name)} · ${fmtQty(p.saleUnits)} ${esc(it.unit)}` : "Sumber stok belum dipilih"; }
  return `${(p.recipe || []).length} ${t.itemWord}${p.extraCost ? " + biaya lain" : ""}`;
}
function renderProductRows(q) {
  const list = state.catalog.products.filter(p => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  if (!state.catalog.products.length) return emptyState("box", "Belum ada produk", "Tambahkan menu pertama — harga jual, foto, dan resep untuk HPP otomatis.", `<button class="btn primary sm" data-action="add-product">${icon("plus")}Tambah Produk</button>`);
  if (!list.length) return emptyState("search", "Tidak ditemukan", "Coba kata lain.");
  return list.map(p => {
    const h = productHpp(p), mi = marginInfo(p.price, h);
    const warn = p.costMode === "recipe" && !(p.recipe || []).length ? `<span class="tag bad">Resep kosong</span>` : p.costMode === "stock" && !findItem(p.stockItemId) ? `<span class="tag bad">Stok belum dipilih</span>` : "";
    return `<div class="row-card" data-action="edit-product" data-id="${p.id}" role="button" tabindex="0">
      ${productVisual(p, "thumb")}
      <div class="row-main"><b>${esc(p.name)}</b><div class="row-price num">${rp(p.price)}</div>
        <div class="row-sub">${T().cost} ${rp(h)} · ${costDesc(p)}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px"><span class="tag ${mi.level}">Laba ${rpShort(mi.profit)} · ${mi.pct}%</span><span class="tag muted">${esc(p.category)}</span>${(p.groups || []).length ? `<span class="tag blue">${p.groups.length} varian</span>` : ""}${p.active === false ? `<span class="tag muted">${icon("eyeoff").replace("<svg", '<svg style="width:12px;height:12px"')}Disembunyikan</span>` : ""}${warn}</div></div>
      <div class="row-actions" style="flex-direction:column"><button class="icon-btn" data-action="dup-product" data-id="${p.id}" aria-label="Duplikat">${icon("copy")}</button><button class="icon-btn red" data-action="del-product" data-id="${p.id}" aria-label="Hapus">${icon("trash")}</button></div>
    </div>`;
  }).join("");
}
function itemUsage(id) { return state.catalog.products.filter(p => (p.costMode === "stock" && p.stockItemId === id) || (p.costMode === "recipe" && (p.recipe || []).some(r => r.itemId === id))); }
function unitCostText(it) {
  const r = itemCostR(it, 1); const v = r.d > 0n ? (r.n * 200n + r.d) / (2n * r.d) : 0n; // display only: 2 decimals, half-up
  const n = Number(v) / 100; const txt = n >= 100 ? rp(Math.round(n)) : "Rp " + n.toFixed(2).replace(".", ",").replace(/,00$/, "");
  return `${txt} / ${esc(it.unit)}`;
}
function renderItemRows(q) {
  const t = T();
  const list = state.catalog.items.filter(i => !q || i.name.toLowerCase().includes(q));
  if (!state.catalog.items.length) return emptyState("layers", `Belum ada ${t.itemWord}`, t.model === "stock" ? "Catat barang yang dibeli grosir/kemasan. Produk eceran mengambil modal & stok dari sini." : `Catat ${t.itemWord} yang Anda beli. ${t.cost} menu dihitung otomatis dari resep.`, `<button class="btn primary sm" data-action="add-item">${icon("plus")}Tambah ${esc(t.stock)}</button>`);
  if (!list.length) return emptyState("search", "Tidak ditemukan", "Coba kata lain.");
  const se = stockEnabled();
  const shopBtn = se && state.catalog.items.some(i => i.stock !== null) ? `<button class="btn outline block" style="margin-bottom:4px" data-action="open-shopping">${icon("list")}Buat daftar belanja otomatis</button>` : "";
  const paused = !isPro() && state.catalog.items.some(i => i.stock !== null) ? `<div class="notice warn" style="margin:0 0 4px">${icon("pause")}<span>Stok otomatis <b>dijeda</b> di paket Gratis — angka stok tidak berkurang saat penjualan.</span><button class="act" data-action="open-pro">Aktifkan</button></div>` : "";
  return shopBtn + paused + list.map(i => {
    const st = itemStatus(i), used = itemUsage(i.id).length;
    const stTag = !se ? "" : st === "untracked" ? `<span class="tag muted">Stok tidak dilacak</span>` : st === "out" ? `<span class="tag bad">Habis · ${esc(fmtStock(i))}</span>` : st === "low" ? `<span class="tag mid">Menipis · ${esc(fmtStock(i))}</span>` : `<span class="tag good">${esc(fmtStock(i))}</span>`;
    const buy = i.packName ? `${rp(i.price)} / ${esc(i.packName)} isi ${fmtQty(i.buyQty)} ${esc(i.unit)}` : `${rp(i.price)} / ${fmtQty(i.buyQty)} ${esc(i.unit)}`;
    return `<div class="row-card" data-action="edit-item" data-id="${i.id}" role="button" tabindex="0">
      <div class="row-main"><b>${esc(i.name)}</b><div class="row-sub">${t.model === "stock" ? "Modal" : "Beli"}: ${buy}</div>
        <div class="row-price num" style="font-size:14px">${unitCostText(i)}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${stTag}<span class="tag muted">Dipakai ${used} produk</span></div></div>
      <div class="row-actions" style="flex-direction:column">${se ? `<button class="icon-btn green" data-action="restock" data-id="${i.id}" aria-label="Tambah stok">${icon("plus")}</button>` : ""}<button class="icon-btn red" data-action="del-item" data-id="${i.id}" aria-label="Hapus">${icon("trash")}</button></div>
    </div>`;
  }).join("");
}

/* ---------- Product form ---------- */
function newProductDraft(p) {
  const t = T();
  if (p) return { ...deepCopy(p), imageData: undefined };
  return { id: null, name: "", price: 0, category: state.catalog.cats[0] || "Umum", imageId: null, costMode: t.model === "stock" ? (state.catalog.items.length ? "stock" : "manual") : (state.catalog.items.length ? "recipe" : "manual"), manualHpp: 0, recipe: [], extraCost: 0, stockItemId: state.catalog.items[0]?.id ?? null, saleUnits: 1, active: true, groups: [] };
}
function draftHpp(d) { return productHpp(d); }
SHEETS.product = (m) => {
  const d = m.draft, t = T(), items = state.catalog.items;
  const img = d.imageData || ImageCache.url(d.imageId);
  const modes = t.model === "stock" ? [["stock", "Dari stok grosir"], ["manual", "Manual"]] : [["recipe", t.usage + " otomatis"], ["manual", "Manual"]];
  let cost = "";
  if (d.costMode === "manual") {
    cost = `<div class="form-label">${t.cost} per ${t.model === "stock" ? "barang" : "porsi"} <small>modal yang Anda keluarkan</small></div><div class="input-affix"><span>Rp</span><input id="pf-hpp" class="input money" inputmode="numeric" value="${d.manualHpp ? groupDigits(d.manualHpp) : ""}" placeholder="0"></div>`;
  } else if (d.costMode === "stock") {
    const it = items.find(i => i.id === d.stockItemId);
    cost = items.length ? `<div class="form-label">Sumber stok</div><select id="pf-stock" class="select">${items.map(i => `<option value="${i.id}" ${i.id === d.stockItemId ? "selected" : ""}>${esc(i.name)} (${esc(i.packName || i.unit)})</option>`).join("")}</select>
      <div class="form-label">Isi yang terjual per 1 penjualan</div><div class="input-affix suffix"><span>${esc(it?.unit || "")}</span><input id="pf-units" class="input" inputmode="decimal" value="${esc(fmtQty(d.saleUnits))}"></div>
      <div class="help">Contoh: jual 1 botol → isi 1. Jual paket 5 bungkus → isi 5. Modal = harga per ${esc(it?.packName || "kemasan")} ÷ ${fmtQty(it?.buyQty || 1)} × isi terjual.</div>`
      : `<div class="notice warn" style="margin:12px 0 0">${icon("alert")}<span>Belum ada ${esc(t.stock)}. Tambahkan dulu di tab ${esc(t.stock)}, atau pakai ${t.cost} manual.</span></div>`;
  } else {
    cost = `<div class="recipe-box"><div class="recipe-head"><b>${esc(t.usage)} · ${esc(t.usageHint)}</b></div>
      <div id="pf-lines">${(d.recipe || []).map((r, i) => { const it = items.find(x => x.id === r.itemId); return `<div class="recipe-line"><select class="select pf-ing" data-i="${i}" aria-label="Bahan">${items.map(x => `<option value="${x.id}" ${x.id === r.itemId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select><div class="input-affix suffix"><span style="font-size:11px;right:8px">${esc(it?.unit || "")}</span><input class="input pf-qty" data-i="${i}" inputmode="decimal" value="${r.qty ? esc(fmtQty(r.qty)) : ""}" placeholder="0" style="padding-right:34px" aria-label="Jumlah"></div><button class="icon-btn red" data-action="pf-del-line" data-i="${i}" aria-label="Hapus baris">${icon("x")}</button><div class="recipe-cost" id="pf-lc-${i}">${it ? "≈ " + rp(rRound(itemCostR(it, r.qty || 0))) : ""}</div></div>`; }).join("")}</div>
      ${items.length ? `<button class="btn outline block sm" style="margin-top:10px" data-action="pf-add-line">${icon("plus")}Tambah ${esc(t.itemWord)}</button>` : `<div class="help">Belum ada ${esc(t.itemWord)}. Tambahkan di tab ${esc(t.stock)}.</div>`}
      <div class="form-label">Biaya lain per porsi <small>kemasan, gas, listrik (opsional)</small></div><div class="input-affix"><span>Rp</span><input id="pf-extra" class="input money" inputmode="numeric" value="${d.extraCost ? groupDigits(d.extraCost) : ""}" placeholder="0"></div></div>`;
  }
  const body = `
    <div class="upload-row"><div class="upload-preview">${img ? `<img src="${esc(img)}" alt="" style="width:100%;height:100%;object-fit:cover">` : icon("image")}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px"><button class="btn outline sm" data-action="pf-photo">${icon("image")}${img ? "Ganti foto" : "Pilih foto"}</button>${img ? `<button class="btn soft sm" data-action="pf-photo-del">Hapus foto</button>` : `<div class="help" style="margin:0">JPG/PNG/WEBP, otomatis dikecilkan.</div>`}</div>
      <input id="pf-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div>
    <div class="form-label">Nama ${t.model === "stock" ? "produk" : "menu"}</div><input id="pf-name" class="input" maxlength="60" value="${esc(d.name)}" placeholder="${t.model === "stock" ? "Contoh: Minyak Goreng 1L" : t.model === "recipe" && state.settings.type === "service" ? "Contoh: Cuci Kiloan" : "Contoh: Es Kopi Susu"}" autocomplete="off">
    <div class="form-label">Harga jual</div><div class="input-affix"><span>Rp</span><input id="pf-price" class="input money" inputmode="numeric" value="${d.price ? groupDigits(d.price) : ""}" placeholder="0"></div>
    ${state.settings.type === "retail" || d.barcode ? `<div class="form-label">Barcode / SKU <small>opsional · untuk scanner</small></div><input id="pf-barcode" class="input" inputmode="numeric" maxlength="32" value="${esc(d.barcode || "")}" placeholder="Scan atau ketik kode" autocomplete="off">` : ""}
    <div class="form-label">Kategori</div><div class="chips" style="margin:0 -18px;padding:0 18px">${state.catalog.cats.map(c => `<button class="chip ${d.category === c ? "active" : ""}" data-action="pf-cat" data-value="${esc(c)}">${esc(c)}</button>`).join("")}<button class="chip" data-action="pf-newcat">${icon("plus").replace("<svg", '<svg style="width:15px;height:15px;display:inline;vertical-align:-3px"')} Baru</button></div>
    <div class="form-label">Cara hitung ${t.cost}</div><div class="seg">${modes.map(([v, l]) => `<button class="${d.costMode === v ? "on" : ""}" data-action="pf-mode" data-value="${v}">${l}</button>`).join("")}</div>
    ${cost}
    <div id="pf-live">${productLiveHtml(d)}</div>
    ${productGroupsHtml(d)}
    <div class="switch-row" style="margin-top:8px"><div><b>Tampilkan di kasir</b><small>Matikan untuk menu musiman / sementara habis.</small></div>${switchHtml("pf-active", d.active !== false)}</div>`;
  return { title: d.id ? "Edit Produk" : "Produk Baru", icon: "box", tall: true, body, noBackdropClose: true,
    foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="pf-save">${icon("check")}Simpan</button>` };
};
function productLiveHtml(d) {
  const t = T(), h = draftHpp(d), mi = marginInfo(d.price, h);
  const color = mi.level === "good" ? "var(--green-2)" : mi.level === "mid" ? "var(--amber)" : "var(--red)";
  const sugg = h > 0 ? [40, 50, 60, 70].map(pct => suggestPrice(h, pct)) : [];
  return `<div class="margin-meter">
    <div class="kv" style="margin:0"><span>${t.cost} per ${t.model === "stock" ? "barang" : "porsi"}</span><b>${rp(h)}</b></div>
    <div class="kv"><span>Laba per penjualan</span><b style="color:${mi.profit >= 0 ? "var(--green)" : "var(--red)"}">${rp(mi.profit)}</b></div>
    <div class="kv"><span>Margin</span><b>${d.price ? mi.pct + "%" : "—"}</b></div>
    <div class="meter-bar"><i style="width:${clamp(mi.pct, 0, 100)}%;background:${color}"></i></div>
    <div class="help">${!d.price ? "Isi harga jual untuk melihat margin." : mi.pct < 0 ? "⚠️ Harga jual di bawah modal — Anda rugi setiap penjualan." : mi.pct < 30 ? "Margin tipis. Umumnya F&B sehat di 50–70%." : mi.pct < 50 ? "Margin cukup. Pertimbangkan naikkan sedikit bila pasar menerima." : "Margin sehat 👍"}</div>
    ${sugg.length ? `<div class="form-label" style="margin-top:10px">Harga saran <small>ketuk untuk pakai</small></div><div class="quick" style="grid-template-columns:repeat(4,1fr);margin-top:0">${sugg.map((v, i) => `<button data-action="pf-suggest" data-value="${v}" title="Margin ${[40, 50, 60, 70][i]}%"><span style="display:block;font-size:10.5px;color:var(--muted)">${[40, 50, 60, 70][i]}%</span>${rpShort(v).replace("Rp ", "")}</button>`).join("")}</div>` : ""}
  </div>`;
}
function updateProductLive() {
  const m = state.ui.modal; if (m?.type !== "product") return;
  const box = $("#pf-live"); if (box) box.innerHTML = productLiveHtml(m.draft);
  (m.draft.recipe || []).forEach((r, i) => { const el = $("#pf-lc-" + i); const it = findItem(r.itemId); if (el && it) el.textContent = "≈ " + rp(rRound(itemCostR(it, r.qty || 0))); });
}
async function saveProduct() {
  const m = state.ui.modal; if (m?.type !== "product") return;
  const d = m.draft, t = T();
  const name = cleanText(d.name, 60);
  if (!name) return toast("Nama produk wajib diisi.", true);
  if (!(money(d.price) > 0)) return toast("Harga jual harus lebih dari 0.", true);
  if (state.catalog.products.some(p => p.id !== d.id && p.name.toLowerCase() === name.toLowerCase())) return toast("Nama produk sudah dipakai.", true);
  if (d.costMode === "recipe") {
    d.recipe = (d.recipe || []).filter(r => findItem(r.itemId) && r.qty > 0);
    if (!d.recipe.length) return toast(`Tambahkan minimal 1 ${t.itemWord} dengan jumlah > 0, atau pilih ${t.cost} manual.`, true);
  }
  if (d.costMode === "stock") {
    if (!findItem(d.stockItemId)) return toast("Pilih sumber stok.", true);
    if (!(d.saleUnits > 0)) return toast("Isi terjual per penjualan harus lebih dari 0.", true);
  }
  if (!d.id && !isPro() && state.catalog.products.length >= APP.freeProductLimit) return openPro("limit");
  const catalog = deepCopy(state.catalog);
  const id = d.id || nextId(catalog.products);
  let imageId = d.imageId;
  const writes = [];
  if (d.imageData) { imageId = "img-" + uid(); writes.push([imageId, d.imageData]); }
  if (d.imageData === null) imageId = null;
  const prod = sanitizeProduct({ ...d, id, name, imageId }, new Set(catalog.items.map(i => i.id)));
  const idx = catalog.products.findIndex(p => p.id === id);
  if (idx >= 0) catalog.products[idx] = prod; else catalog.products.unshift(prod);
  if (!catalog.cats.includes(prod.category)) catalog.cats.push(prod.category);
  try {
    for (const [k, v] of writes) await DB.put("images", v, k);
    await DB.commit({ catalog });
    for (const [k, v] of writes) ImageCache.set(k, v);
    const old = d.id ? state.catalog.products.find(p => p.id === d.id)?.imageId : null;
    state.catalog = catalog;
    if (old && old !== imageId) await dropImageIfUnused(old);
    if (!state.meta.menuTouched) { state.meta.menuTouched = true; Persist.mark("meta"); }
    closeSheet(); renderScreen(); toast(`${prod.name} disimpan`);
  } catch (e) { reportStorageError(e); }
}
async function dropImageIfUnused(id) {
  if (!id || id.startsWith("demo-")) return;
  if (state.catalog.products.some(p => p.imageId === id) || state.settings.logoId === id || state.settings.qrisImageId === id) return;
  try { await DB.del("images", id); ImageCache.drop(id); } catch (_) {}
}
async function processImage(file, maxSide = 480, target = 60 * 1024) {
  if (!file) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast("Format foto harus JPG, PNG, atau WEBP.", true); return null; }
  if (file.size > 12 * 1024 * 1024) { toast("Foto terlalu besar (maks. 12 MB).", true); return null; }
  try {
    const bmp = await (window.createImageBitmap ? createImageBitmap(file) : new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }));
    let w = bmp.width, h = bmp.height; const s = Math.min(1, maxSide / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
    let q = .82, out = c.toDataURL("image/jpeg", q);
    while (out.length * .75 > target && q > .45) { q -= .08; out = c.toDataURL("image/jpeg", q); }
    return out;
  } catch (e) { toast("Foto tidak dapat diproses.", true); return null; }
}

/* ---------- Item form ---------- */
function newItemDraft(it) {
  const retail = T().model === "stock";
  if (it) return { ...deepCopy(it), track: it.stock !== null && it.stock !== undefined };
  return { id: null, name: "", price: 0, buyQty: retail ? 12 : 1000, unit: retail ? "pcs" : "gram", packName: retail ? "karton" : "", stock: null, minStock: null, track: true };
}
SHEETS.item = (m) => {
  const d = m.draft, t = T(), retail = t.model === "stock", se = stockEnabled();
  const unitSel = (id, val, list) => `<select id="${id}" class="select">${[...new Set([val, ...list].filter(Boolean))].map(u => `<option ${u === val ? "selected" : ""}>${esc(u)}</option>`).join("")}</select>`;
  const packs = retail && d.buyQty > 0 ? Math.floor((d.stock || 0) / d.buyQty) : 0;
  const loose = retail && d.buyQty > 0 ? Number(((d.stock || 0) - packs * d.buyQty).toFixed(6)) : 0;
  const body = retail ? `
    <div class="form-label">Nama barang</div><input id="if-name" class="input" maxlength="60" value="${esc(d.name)}" placeholder="Contoh: Minyak Goreng 1L">
    <div class="form-row"><div><div class="form-label">Dibeli per</div>${unitSel("if-pack", d.packName || "karton", PACKS)}</div><div><div class="form-label">Harga modal / ${esc(d.packName || "kemasan")}</div><div class="input-affix"><span>Rp</span><input id="if-price" class="input money" inputmode="numeric" value="${d.price ? groupDigits(d.price) : ""}" placeholder="0"></div></div></div>
    <div class="form-row"><div><div class="form-label">Isi per ${esc(d.packName || "kemasan")}</div><input id="if-buy" class="input" inputmode="decimal" value="${esc(fmtQty(d.buyQty))}"></div><div><div class="form-label">Satuan eceran</div>${unitSel("if-unit", d.unit, UNITS)}</div></div>
    <div class="margin-meter" id="if-live">${itemLiveHtml(d)}</div>
    ${se ? `<div class="switch-row" style="margin-top:6px"><div><b>Lacak stok</b><small>Stok berkurang otomatis setiap penjualan.</small></div>${switchHtml("if-track", d.track)}</div>
    ${d.track ? `<div class="form-row"><div><div class="form-label">Stok (${esc(d.packName || "kemasan")})</div><input id="if-packs" class="input" inputmode="numeric" value="${packs}"></div><div><div class="form-label">+ eceran lepas (${esc(d.unit)})</div><input id="if-loose" class="input" inputmode="decimal" value="${esc(fmtQty(loose))}"></div></div>
    <div class="form-label">Peringatan bila stok ≤ <small>dalam ${esc(d.unit)}</small></div><input id="if-min" class="input" inputmode="decimal" value="${d.minStock ?? ""}" placeholder="Contoh: ${fmtQty(d.buyQty)}">` : ""}` : proStockHint()}` : `
    <div class="form-label">Nama ${esc(t.itemWord)}</div><input id="if-name" class="input" maxlength="60" value="${esc(d.name)}" placeholder="${state.settings.type === "service" ? "Contoh: Deterjen Cair" : "Contoh: Susu Fresh Milk"}">
    <div class="form-label">Harga beli</div><div class="input-affix"><span>Rp</span><input id="if-price" class="input money" inputmode="numeric" value="${d.price ? groupDigits(d.price) : ""}" placeholder="0"></div>
    <div class="form-row"><div><div class="form-label">Isi / jumlah dibeli</div><input id="if-buy" class="input" inputmode="decimal" value="${esc(fmtQty(d.buyQty))}"></div><div><div class="form-label">Satuan</div>${unitSel("if-unit", d.unit, UNITS)}</div></div>
    <div class="margin-meter" id="if-live">${itemLiveHtml(d)}</div>
    ${se ? `<div class="switch-row" style="margin-top:6px"><div><b>Lacak stok</b><small>Stok berkurang otomatis sesuai resep setiap penjualan.</small></div>${switchHtml("if-track", d.track)}</div>
    ${d.track ? `<div class="form-row"><div><div class="form-label">Stok saat ini (${esc(d.unit)})</div><input id="if-stock" class="input" inputmode="decimal" value="${d.stock ?? ""}" placeholder="0"></div><div><div class="form-label">Peringatan bila ≤</div><input id="if-min" class="input" inputmode="decimal" value="${d.minStock ?? ""}" placeholder="0"></div></div>` : ""}` : proStockHint()}`;
  return { title: d.id ? `Edit ${t.stock}` : `${t.stock} Baru`, icon: "layers", tall: true, body, noBackdropClose: true,
    foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="if-save">${icon("check")}Simpan</button>` };
};
function proStockHint() { return `<div class="notice info" style="margin:14px 0 0">${icon("crown")}<span>Stok otomatis, peringatan stok menipis & riwayat stok tersedia di PRO.</span><button class="act" data-action="open-pro">Lihat</button></div>`; }
function itemLiveHtml(d) {
  if (!(d.buyQty > 0)) return `<div class="help" style="margin:0">Isi jumlah dibeli lebih dari 0.</div>`;
  const it = { price: d.price, buyQty: d.buyQty, unit: d.unit };
  return `<div class="kv" style="margin:0"><span>Biaya per 1 ${esc(d.unit)}</span><b>${unitCostText(it)}</b></div><div class="help">Dihitung presisi: ${rp(d.price)} ÷ ${fmtQty(d.buyQty)} ${esc(d.unit)}. Tanpa pembulatan di tengah perhitungan.</div>`;
}
async function saveItem() {
  const m = state.ui.modal; if (m?.type !== "item") return;
  const d = m.draft, t = T();
  const name = cleanText(d.name, 60);
  if (!name) return toast("Nama wajib diisi.", true);
  if (!(d.buyQty > 0)) return toast("Isi / jumlah dibeli harus lebih dari 0.", true);
  if (money(d.price) < 0) return toast("Harga tidak boleh negatif.", true);
  if (state.catalog.items.some(i => i.id !== d.id && i.name.toLowerCase() === name.toLowerCase())) return toast("Nama sudah dipakai.", true);
  const catalog = deepCopy(state.catalog);
  const id = d.id || nextId(catalog.items);
  const prev = catalog.items.find(i => i.id === id);
  const se = stockEnabled();
  const stock = se ? (d.track ? (normQty(d.stock) ?? 0) : null) : (prev ? prev.stock : null);
  const item = sanitizeItem({ ...d, id, name, stock, minStock: se && d.track ? d.minStock : (prev?.minStock ?? null) });
  const idx = catalog.items.findIndex(i => i.id === id);
  if (idx >= 0) catalog.items[idx] = item; else catalog.items.unshift(item);
  const logs = [];
  const before = prev?.stock ?? null;
  if (se && item.stock !== null && before !== item.stock) logs.push({ itemId: id, delta: scaledToNumber((toScaled(item.stock) ?? 0n) - (toScaled(before ?? 0) ?? 0n)), reason: prev ? "edit" : "awal", at: new Date().toISOString() });
  try { await DB.commit({ catalog, logs }); state.catalog = catalog; closeSheet(); renderScreen(); renderNav(); toast(`${item.name} disimpan · ${T().cost} menu terkait diperbarui`); }
  catch (e) { reportStorageError(e); }
}

/* ---------- Restock / opname & log ---------- */
SHEETS.restock = (m) => {
  const it = findItem(m.id); if (!it) return null;
  const retail = !!it.packName;
  const mode = m.mode || "add";
  const logs = m.logs || [];
  const reasonTxt = { sale: "Terjual", void: "Batal transaksi", restock: "Pembelian", opname: "Stok opname", edit: "Edit manual", awal: "Stok awal", adjust: "Penyesuaian" };
  return { title: it.name, icon: "layers", tall: true, noBackdropClose: true, body: `
    <div class="card" style="padding:13px 14px"><div class="kv" style="margin:0"><span>Stok sekarang</span><b>${esc(fmtStock(it))}</b></div><div class="kv"><span>Biaya per ${esc(it.unit)}</span><b>${unitCostText(it)}</b></div></div>
    <div class="seg" style="margin-top:14px"><button class="${mode === "add" ? "on" : ""}" data-action="rs-mode" data-value="add">Tambah stok</button><button class="${mode === "set" ? "on" : ""}" data-action="rs-mode" data-value="set">Stok opname</button></div>
    ${mode === "add" ? `
      ${retail ? `<div class="form-row"><div><div class="form-label">Jumlah ${esc(it.packName)}</div><input id="rs-packs" class="input" inputmode="numeric" value="${esc(m.v?.["rs-packs"] ?? "")}" placeholder="0"></div><div><div class="form-label">+ eceran (${esc(it.unit)})</div><input id="rs-loose" class="input" inputmode="decimal" value="${esc(m.v?.["rs-loose"] ?? "")}" placeholder="0"></div></div>` : `<div class="form-label">Jumlah masuk (${esc(it.unit)})</div><input id="rs-qty" class="input" inputmode="decimal" value="${esc(m.v?.["rs-qty"] ?? "")}" placeholder="Contoh: ${fmtQty(it.buyQty)}">`}
      <div class="switch-row" style="margin-top:6px"><div><b>Harga beli berubah?</b><small>Perbarui dasar ${T().cost} untuk penjualan berikutnya.</small></div>${switchHtml("rs-price-on", !!m.priceOn)}</div>
      ${m.priceOn ? `<div class="form-row"><div><div class="form-label">Harga beli baru</div><div class="input-affix"><span>Rp</span><input id="rs-price" class="input money" inputmode="numeric" value="${groupDigits(it.price)}"></div></div><div><div class="form-label">per ${retail ? "1 " + esc(it.packName) + " (isi)" : "jumlah (" + esc(it.unit) + ")"}</div><input id="rs-buy" class="input" inputmode="decimal" value="${esc(fmtQty(it.buyQty))}"></div></div>` : ""}
    ` : `<div class="form-label">Hasil hitung fisik (${esc(it.unit)})</div><input id="rs-actual" class="input" inputmode="decimal" value="${esc(m.v?.["rs-actual"] ?? "")}" placeholder="Jumlah sebenarnya di gudang"><div class="help">Stok akan disetel ke angka ini; selisihnya dicatat sebagai "Stok opname".</div>`}
    <div class="section-title" style="margin-top:20px"><h3>${icon("clock")}Riwayat stok</h3></div>
    <div class="card" style="padding:4px 14px">${logs.length ? logs.map(l => `<div class="top-item" style="grid-template-columns:minmax(0,1fr) auto"><span><b style="font-size:13.5px">${esc(reasonTxt[l.reason] || l.reason)}</b><small>${esc(fmtDateTime(l.at))}</small></span><span class="v num" style="color:${l.delta < 0 ? "var(--red)" : "var(--green)"}">${l.delta > 0 ? "+" : ""}${fmtQty(l.delta)} ${esc(it.unit)}</span></div>`).join("") : `<div class="help" style="padding:12px 0">Belum ada pergerakan stok.</div>`}</div>`,
    foot: `<button class="btn soft" data-action="close-sheet">Tutup</button><button class="btn success" data-action="rs-save">${icon("check")}Simpan</button>` };
};
async function openRestock(id) {
  if (!stockEnabled()) return openPro("stock");
  const logs = await DB.logsFor(id, 25).catch(() => []);
  openSheet("restock", { id, logs, mode: "add" });
}
async function saveRestock() {
  const m = state.ui.modal; const it = findItem(m?.id); if (!it) return;
  if (m.mode === "set") {
    const actual = normQtyInput($("#rs-actual")?.value);
    if (actual === null || actual < 0) return toast("Isi hasil hitung fisik.", true);
    const delta = scaledToNumber((toScaled(actual) ?? 0n) - (toScaled(it.stock ?? 0) ?? 0n));
    if (!(await adjustStock(it.id, delta, "opname"))) return;
  } else {
    let q;
    if (it.packName) { const p = normQtyInput($("#rs-packs")?.value || 0) ?? 0, l = normQtyInput($("#rs-loose")?.value || 0) ?? 0; q = scaledToNumber((toScaled(p) ?? 0n) * (toScaled(it.buyQty) ?? SCALE) / SCALE + (toScaled(l) ?? 0n)); }
    else q = normQtyInput($("#rs-qty")?.value);
    if (!(q > 0)) return toast("Isi jumlah stok masuk.", true);
    let price = null, buy = null;
    if (m.priceOn) { price = parseMoneyInput($("#rs-price")?.value); buy = normQtyInput($("#rs-buy")?.value); if (!(buy > 0)) return toast("Jumlah per harga harus > 0.", true); }
    if (it.stock === null) { const c = deepCopy(state.catalog); c.items.find(i => i.id === it.id).stock = 0; state.catalog = c; }
    if (!(await adjustStock(it.id, q, "restock", price, buy))) return;
  }
  closeSheet(); renderScreen(); renderNav(); toast("Stok diperbarui");
}

/* ---------- Delete / duplicate ---------- */
async function deleteProduct(id) {
  const p = findProduct(id); if (!p) return;
  if (state.cart.lines.some(l => l.pid === id)) return toast("Keluarkan produk dari keranjang dulu.", true);
  const ok = await confirmDialog({ title: "Hapus produk?", text: `<b>${esc(p.name)}</b> dihapus dari katalog. Riwayat transaksi lama tetap tersimpan.`, ok: "Hapus", icon: "trash" });
  if (!ok) return;
  const catalog = deepCopy(state.catalog); catalog.products = catalog.products.filter(x => x.id !== id);
  const held = state.held.map(h => ({ ...h, lines: h.lines.filter(l => l.pid !== id) })).filter(h => h.lines.length);
  try { await DB.commit({ catalog, kv: { held } }); state.catalog = catalog; state.held = held; await dropImageIfUnused(p.imageId); renderScreen(); toast("Produk dihapus"); }
  catch (e) { reportStorageError(e); }
}
async function duplicateProduct(id) {
  const p = findProduct(id); if (!p) return;
  if (!isPro() && state.catalog.products.length >= APP.freeProductLimit) return openPro("limit");
  const draft = { ...deepCopy(p), id: null, name: (p.name + " (salinan)").slice(0, 60) };
  openSheet("product", { draft });
}
async function deleteItem(id) {
  const it = findItem(id); if (!it) return;
  const used = itemUsage(id);
  const ok = await confirmDialog({ title: `Hapus ${T().itemWord}?`, text: used.length ? `<b>${esc(it.name)}</b> dipakai di ${used.length} produk. ${T().cost} produk tersebut akan <b>dikunci ke nilai saat ini</b> (manual) supaya laporan laba tetap benar.` : `<b>${esc(it.name)}</b> akan dihapus.`, ok: "Hapus", icon: "trash" });
  if (!ok) return;
  const catalog = deepCopy(state.catalog);
  for (const p of catalog.products) {
    const uses = (p.costMode === "stock" && p.stockItemId === id) || (p.costMode === "recipe" && (p.recipe || []).some(r => r.itemId === id));
    if (uses) { p.manualHpp = productHpp(p, catalog.items); p.costMode = "manual"; p.recipe = []; p.stockItemId = null; p.extraCost = 0; }
  }
  catalog.items = catalog.items.filter(i => i.id !== id);
  try { await DB.commit({ catalog }); state.catalog = catalog; renderScreen(); renderNav(); toast(used.length ? `Dihapus · ${used.length} produk kini memakai ${T().cost} manual` : "Dihapus"); }
  catch (e) { reportStorageError(e); }
}

/* ---------- Categories ---------- */
SHEETS.cats = () => ({ title: "Kelola Kategori", icon: "layers", body: `<div class="list">${state.catalog.cats.map((c, i) => { const n = state.catalog.products.filter(p => p.category === c).length; return `<div class="row-card" style="padding:10px 12px"><div class="row-main"><b>${esc(c)}</b><div class="row-sub">${n} produk</div></div><div class="row-actions"><button class="icon-btn" data-action="cat-up" data-i="${i}" aria-label="Naikkan" ${i === 0 ? "disabled" : ""}>${icon("chev").replace("<svg", '<svg style="transform:rotate(-90deg)"')}</button><button class="icon-btn blue" data-action="cat-rename" data-i="${i}" aria-label="Ubah nama">${icon("edit")}</button><button class="icon-btn red" data-action="cat-del" data-i="${i}" aria-label="Hapus">${icon("trash")}</button></div></div>`; }).join("") || emptyState("layers", "Belum ada kategori", "")}</div>`,
  foot: `<button class="btn primary block" data-action="cat-add">${icon("plus")}Kategori baru</button>` });
async function catAction(kind, i) {
  const cats = state.catalog.cats.slice(); const c = cats[i]; const catalog = deepCopy(state.catalog);
  if (kind === "add") {
    const name = cleanText(await confirmDialog({ title: "Kategori baru", text: "Contoh: Kopi, Snack, Promo.", ok: "Tambah", danger: false, icon: "layers", input: "Nama kategori" }) || "", 30);
    if (!name) return; if (catalog.cats.some(x => x.toLowerCase() === name.toLowerCase())) return toast("Kategori sudah ada.", true);
    catalog.cats.push(name);
  } else if (kind === "rename") {
    const name = cleanText(await confirmDialog({ title: "Ubah nama kategori", text: "Semua produk di kategori ini ikut berubah.", ok: "Simpan", danger: false, icon: "edit", input: "Nama kategori", value: c }) || "", 30);
    if (!name || name === c) return; if (catalog.cats.some(x => x.toLowerCase() === name.toLowerCase())) return toast("Kategori sudah ada.", true);
    catalog.cats[i] = name; catalog.products.forEach(p => { if (p.category === c) p.category = name; });
  } else if (kind === "del") {
    if (catalog.products.some(p => p.category === c)) return toast("Pindahkan/hapus produk di kategori ini dulu.", true);
    catalog.cats.splice(i, 1);
  } else if (kind === "up" && i > 0) { [catalog.cats[i - 1], catalog.cats[i]] = [catalog.cats[i], catalog.cats[i - 1]]; }
  try { await DB.commit({ catalog }); state.catalog = catalog; renderOverlay(); renderScreen(); } catch (e) { reportStorageError(e); }
}
