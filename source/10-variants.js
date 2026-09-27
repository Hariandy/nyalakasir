/* =====================================================================
   10-variants.js — Varian & tambahan (option groups):
   - picker sheet saat menu dengan varian diketuk di Kasir
   - kelola grup varian (tab "Varian" di Menu)
   - lampirkan grup ke produk (form produk)
   Harga & HPP varian dihitung presisi (lihat computeTotals / choiceCostR).
   ===================================================================== */
function productGroups(p) { return (p.groups || []).map(id => findGroup(id)).filter(Boolean); }
function defaultPick(p) {
  const sel = {};
  for (const g of productGroups(p)) sel[g.id] = g.type === "single" && g.required ? [g.choices[0].id] : [];
  return sel;
}
function openPicker(pid, sel = null) {
  const p = findProduct(pid); if (!p) return;
  openSheet("pick", { pid, sel: sel || defaultPick(p), qty: 1, note: "" });
}
function pickLine(m) {
  const p = findProduct(m.pid);
  const opts = []; for (const g of productGroups(p)) for (const c of m.sel[g.id] || []) opts.push({ g: g.id, c });
  return { id: "preview", pid: m.pid, qty: m.qty, note: m.note, opts };
}
SHEETS.pick = (m) => {
  const p = findProduct(m.pid); if (!p) return null;
  const groups = productGroups(p);
  const t = computeTotals({ lines: [pickLine(m)], discount: null }, state.catalog, { ...state.settings, taxBp: 0, serviceBp: 0, roundingStep: 0 });
  const unit = t.lines[0]?.unitPrice ?? p.price;
  const missing = groups.filter(g => g.required && !(m.sel[g.id] || []).length);
  const body = `
    <div style="display:flex;gap:12px;align-items:center">${productVisual(p, "thumb")}<div style="min-width:0"><div class="cart-name" style="font-size:17px">${esc(p.name)}</div><div class="row-price num">${rp(unit)}</div>${state.ui.owner && !state.settings.staffMode ? `<div class="help" style="margin:2px 0 0">${T().cost} ${rp(t.lines[0]?.unitHpp ?? 0)} · margin ${marginInfo(unit, t.lines[0]?.unitHpp ?? 0).pct}%</div>` : ""}</div></div>
    ${groups.map(g => `<div class="opt-group"><div class="form-label">${esc(g.name)} <small>${g.type === "multi" ? "boleh lebih dari satu" : g.required ? "wajib pilih 1" : "opsional"}</small></div>
      <div class="opt-chips">${g.choices.map(c => { const on = (m.sel[g.id] || []).includes(c.id); return `<button class="opt ${on ? "on" : ""}" data-action="pick-opt" data-g="${esc(g.id)}" data-c="${esc(c.id)}" aria-pressed="${on}"><span>${esc(c.name)}</span>${c.price ? `<small>${c.price > 0 ? "+" : "−"}${rpShort(Math.abs(c.price)).replace("Rp ", "")}</small>` : ""}</button>`; }).join("")}</div></div>`).join("")}
    <div class="form-label">Catatan <small>opsional</small></div><input id="pick-note" class="input" maxlength="60" value="${esc(m.note)}" placeholder="Contoh: dipisah, tanpa sedotan">
    <div class="brand-row" style="margin-top:14px"><b>Jumlah</b><div class="stepper" style="margin:0"><button data-action="pick-qty" data-value="-1" aria-label="Kurangi">${icon("minus")}</button><span class="q num">${m.qty}</span><button data-action="pick-qty" data-value="1" aria-label="Tambah">${icon("plus")}</button></div></div>`;
  return { title: "Pilih varian", icon: "layers", body,
    foot: `<button class="btn success block" data-action="pick-add" ${missing.length ? "disabled" : ""} style="height:54px">${icon("plus")}${missing.length ? "Pilih " + esc(missing[0].name) : `Tambah · ${rp(rRound({ n: BigInt(unit) * BigInt(m.qty), d: 1n }))}`}</button>` };
};
function pickToggle(gid, cid) {
  const m = state.ui.modal; const g = findGroup(gid); if (!g) return;
  const cur = m.sel[gid] || [];
  if (g.type === "single") m.sel[gid] = cur.includes(cid) && !g.required ? [] : [cid];
  else m.sel[gid] = cur.includes(cid) ? cur.filter(x => x !== cid) : [...cur, cid];
  haptic(5); renderOverlay();
}
function pickAdd() {
  const m = state.ui.modal; const p = findProduct(m.pid); if (!p) return closeSheet();
  const line = pickLine(m); const key = optsKey(line.opts); const note = cleanText(m.note, 60);
  const same = state.cart.lines.find(l => l.pid === p.id && optsKey(l.opts) === key && (l.note || "") === note);
  if (same) same.qty = scaledToNumber((toScaled(same.qty) ?? 0n) + (toScaled(m.qty) ?? SCALE));
  else state.cart.lines.push({ id: uid("l"), pid: p.id, qty: m.qty, note, opts: line.opts });
  Persist.mark("cart"); haptic(8); closeSheet();
  const card = $(`.product-card[data-pid="${p.id}"]`);
  if (card) { card.classList.add("in-cart"); let b = $(".qty-badge", card); if (!b) { b = document.createElement("span"); b.className = "qty-badge"; card.insertBefore(b, $(".product-body", card)); } b.textContent = fmtQty(cartQtyAll(p.id)); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  updateCartBar(true);
}

/* ---------- Group manager (Menu → tab Varian) ---------- */
function renderGroupRows() {
  const gs = state.catalog.optionGroups || [];
  if (!gs.length) return emptyState("layers", "Belum ada varian", "Buat pilihan seperti <b>Ukuran</b>, <b>Level gula</b>, atau <b>Topping</b> sekali, lalu pasang ke banyak menu. Harga & HPP tambahan dihitung otomatis.", `<button class="btn primary sm" data-action="add-group">${icon("plus")}Buat Varian</button>`);
  return gs.map(g => {
    const used = state.catalog.products.filter(p => (p.groups || []).includes(g.id)).length;
    return `<div class="row-card" data-action="edit-group" data-id="${esc(g.id)}" role="button" tabindex="0"><div class="row-main"><b>${esc(g.name)}</b>
      <div class="row-sub">${g.choices.map(c => esc(c.name) + (c.price ? ` (${c.price > 0 ? "+" : "−"}${rpShort(Math.abs(c.price)).replace("Rp ", "")})` : "")).join(" · ")}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px"><span class="tag ${g.type === "multi" ? "blue" : "good"}">${g.type === "multi" ? "Boleh banyak" : g.required ? "Wajib pilih 1" : "Pilih 1 (opsional)"}</span><span class="tag muted">Dipakai ${used} menu</span></div></div>
      <div class="row-actions"><button class="icon-btn red" data-action="del-group" data-id="${esc(g.id)}" aria-label="Hapus varian">${icon("trash")}</button></div></div>`;
  }).join("");
}
function newGroupDraft(g) {
  if (g) return deepCopy(g);
  return { id: null, name: "", type: "single", required: true, choices: [{ id: uid("c").slice(0, 10), name: "", price: 0, cost: 0, recipe: [] }, { id: uid("c").slice(0, 10), name: "", price: 0, cost: 0, recipe: [] }], attach: [] };
}
SHEETS.group = (m) => {
  const d = m.draft, items = state.catalog.items;
  const body = `
    <div class="form-label">Nama varian</div><input id="gf-name" class="input" maxlength="30" value="${esc(d.name)}" placeholder="Contoh: Ukuran, Level gula, Topping">
    <div class="form-label">Cara memilih</div><div class="seg"><button class="${d.type === "single" ? "on" : ""}" data-action="gf-type" data-value="single">Pilih satu</button><button class="${d.type === "multi" ? "on" : ""}" data-action="gf-type" data-value="multi">Boleh lebih dari satu</button></div>
    ${d.type === "single" ? `<div class="switch-row" style="margin-top:6px"><div><b>Wajib dipilih</b><small>Pilihan pertama otomatis terpilih — kasir tetap 1–2 ketuk.</small></div>${switchHtml("gf-req", d.required)}</div>` : ""}
    <div class="form-label">Pilihan <small>+harga jual · +modal (${esc(T().cost)})</small></div>
    <div class="list" style="gap:8px">${d.choices.map((c, i) => { const r = (c.recipe || [])[0]; return `<div class="choice-card">
      <div class="choice-top"><input class="input gf-cname" data-i="${i}" maxlength="30" value="${esc(c.name)}" placeholder="Nama pilihan ${i + 1}"><button class="icon-btn red" data-action="gf-del" data-i="${i}" aria-label="Hapus pilihan" ${d.choices.length <= 1 ? "disabled" : ""}>${icon("x")}</button></div>
      <div class="form-row" style="margin-top:7px"><div class="input-affix"><span>+Rp</span><input class="input money gf-cprice" data-i="${i}" inputmode="numeric" value="${c.price ? groupDigits(c.price) : ""}" placeholder="0" style="padding-left:50px" aria-label="Tambahan harga"></div><div class="input-affix"><span>+HPP</span><input class="input money gf-ccost" data-i="${i}" inputmode="numeric" value="${c.cost ? groupDigits(c.cost) : ""}" placeholder="0" style="padding-left:56px" aria-label="Tambahan modal"></div></div>
      ${items.length ? `<div class="form-row" style="margin-top:7px;grid-template-columns:minmax(0,1fr) 96px"><select class="select gf-ritem" data-i="${i}" aria-label="Bahan tambahan"><option value="">— tanpa bahan tambahan —</option>${items.map(x => `<option value="${x.id}" ${r && r.itemId === x.id ? "selected" : ""}>+ ${esc(x.name)} (${esc(x.unit)})</option>`).join("")}</select><input class="input gf-rqty" data-i="${i}" inputmode="decimal" value="${r ? esc(fmtQty(r.qty)) : ""}" placeholder="jml" aria-label="Jumlah bahan"></div>` : ""}
      <div class="help" id="gf-cost-${i}" style="margin-top:5px">${choiceCostText(c)}</div></div>`; }).join("")}</div>
    <button class="btn outline block sm" style="margin-top:10px" data-action="gf-add" ${d.choices.length >= 12 ? "disabled" : ""}>${icon("plus")}Tambah pilihan</button>
    ${!d.id ? `<div class="form-label">Pasang ke menu <small>bisa diubah di form menu</small></div><div class="opt-chips">${state.catalog.products.map(p => `<button class="opt ${(d.attach || []).includes(p.id) ? "on" : ""}" data-action="gf-attach" data-id="${p.id}"><span>${esc(p.name)}</span></button>`).join("") || `<span class="help">Belum ada menu.</span>`}</div>` : ""}
    <div class="help">Tip: bahan tambahan (mis. Extra shot = +18 g kopi) ikut mengurangi stok & menambah ${esc(T().cost)} secara presisi.</div>`;
  return { title: d.id ? "Edit Varian" : "Varian Baru", icon: "layers", tall: true, noBackdropClose: true, body,
    foot: `<button class="btn soft" data-action="close-sheet">Batal</button><button class="btn primary" data-action="gf-save">${icon("check")}Simpan</button>` };
};
function choiceCostText(c) {
  const r = choiceCostR({ cost: c.cost, recipe: (c.recipe || []).filter(x => x.itemId && x.qty > 0) }, state.catalog.items);
  const v = rRound(r); const m = c.price ? marginInfo(c.price, v) : null;
  return v || c.price ? `Modal tambahan ${rp(v)}${m ? ` · laba tambahan ${rp(m.profit)}` : ""}` : "Tanpa biaya tambahan";
}
function gfRead(i) { return state.ui.modal?.draft?.choices?.[i]; }
async function saveGroup() {
  const m = state.ui.modal; const d = m.draft;
  d.name = cleanText(d.name, 30);
  if (!d.name) return toast("Nama varian wajib diisi.", true);
  d.choices = d.choices.map(c => ({ ...c, name: cleanText(c.name, 30), recipe: (c.recipe || []).filter(x => x.itemId && x.qty > 0) })).filter(c => c.name);
  if (!d.choices.length) return toast("Isi minimal 1 pilihan.", true);
  const names = d.choices.map(c => c.name.toLowerCase()); if (new Set(names).size !== names.length) return toast("Nama pilihan tidak boleh sama.", true);
  if ((state.catalog.optionGroups || []).some(g => g.id !== d.id && g.name.toLowerCase() === d.name.toLowerCase())) return toast("Nama varian sudah dipakai.", true);
  const catalog = deepCopy(state.catalog); catalog.optionGroups = catalog.optionGroups || [];
  const g = sanitizeGroup({ ...d, id: d.id || uid("g").slice(0, 12) }, new Set(catalog.items.map(i => i.id)));
  const idx = catalog.optionGroups.findIndex(x => x.id === g.id);
  if (idx >= 0) catalog.optionGroups[idx] = g; else catalog.optionGroups.push(g);
  if (!d.id) for (const p of catalog.products) if ((d.attach || []).includes(p.id) && !(p.groups || []).includes(g.id)) p.groups = [...(p.groups || []), g.id];
  // cart lines that reference removed choices lose them (resolved safely by lineChoices)
  try { await DB.commit({ catalog }); state.catalog = catalog; closeSheet(); renderScreen(); toast(`Varian ${g.name} disimpan`); } catch (e) { reportStorageError(e); }
}
async function deleteGroup(id) {
  const g = findGroup(id); if (!g) return;
  const used = state.catalog.products.filter(p => (p.groups || []).includes(id)).length;
  const ok = await confirmDialog({ title: "Hapus varian?", text: `<b>${esc(g.name)}</b>${used ? ` dilepas dari ${used} menu` : ""}. Riwayat transaksi tetap menyimpan pilihan lama.`, ok: "Hapus", icon: "trash" });
  if (!ok) return;
  const catalog = deepCopy(state.catalog); catalog.optionGroups = catalog.optionGroups.filter(x => x.id !== id);
  for (const p of catalog.products) p.groups = (p.groups || []).filter(x => x !== id);
  try { await DB.commit({ catalog }); state.catalog = catalog; renderScreen(); toast("Varian dihapus"); } catch (e) { reportStorageError(e); }
}
/* product form section */
function productGroupsHtml(d) {
  const gs = state.catalog.optionGroups || [];
  return `<div class="form-label">Varian & tambahan <small><a href="#" data-action="pf-manage-groups" style="color:var(--blue);font-weight:750">Kelola</a></small></div>
    ${gs.length ? `<div class="opt-chips">${gs.map(g => { const on = (d.groups || []).includes(g.id); return `<button class="opt ${on ? "on" : ""}" data-action="pf-group" data-id="${esc(g.id)}" aria-pressed="${on}"><span>${esc(g.name)}</span><small>${g.choices.length} pilihan</small></button>`; }).join("")}</div>` : `<div class="help" style="margin:0">Belum ada varian. Buat di Menu → tab Varian (mis. Ukuran, Topping).</div>`}`;
}

Object.assign(ACTIONS, {
  "pick-opt": el => pickToggle(el.dataset.g, el.dataset.c),
  "pick-qty": el => { const m = state.ui.modal; m.qty = clamp(m.qty + Number(el.dataset.value), 1, 999); renderOverlay(); },
  "pick-add": () => pickAdd(),
  "add-group": () => { if (!isPro() && (state.catalog.optionGroups || []).length >= 2) return openPro("variants"); openSheet("group", { draft: newGroupDraft(null) }); },
  "edit-group": (el, ev) => { if (ev.target.closest("[data-action]") !== el) return; const g = findGroup(el.dataset.id); if (g) openSheet("group", { draft: newGroupDraft(g) }); },
  "del-group": el => deleteGroup(el.dataset.id),
  "gf-type": el => { const d = state.ui.modal.draft; d.type = el.dataset.value; if (d.type === "multi") d.required = false; else d.required = true; renderOverlay(); },
  "gf-add": () => { state.ui.modal.draft.choices.push({ id: uid("c").slice(0, 10), name: "", price: 0, cost: 0, recipe: [] }); renderOverlay(); setTimeout(() => { const q = $$(".gf-cname"); q[q.length - 1]?.focus(); }, 30); },
  "gf-del": el => { state.ui.modal.draft.choices.splice(Number(el.dataset.i), 1); renderOverlay(); },
  "gf-attach": el => { const d = state.ui.modal.draft; const id = Number(el.dataset.id); d.attach = (d.attach || []).includes(id) ? d.attach.filter(x => x !== id) : [...(d.attach || []), id]; renderOverlay(); },
  "gf-save": () => saveGroup(),
  "pf-group": el => { const d = state.ui.modal.draft; const id = el.dataset.id; d.groups = (d.groups || []).includes(id) ? d.groups.filter(x => x !== id) : [...(d.groups || []), id]; renderOverlay(); },
  "pf-manage-groups": async (el, ev) => { ev.preventDefault?.(); const ok = await confirmDialog({ title: "Kelola varian?", text: "Form menu ini akan ditutup (perubahan yang belum disimpan hilang).", ok: "Buka Varian", danger: false, icon: "layers" }); if (!ok) return; closeSheet(); state.ui.catalogTab = "varian"; renderScreen(); },
});
document.addEventListener("input", ev => {
  const el = ev.target, m = state.ui.modal;
  if (m?.type === "pick" && el.id === "pick-note") { m.note = el.value; return; }
  if (m?.type !== "group") return;
  const d = m.draft, i = Number(el.dataset.i), c = d.choices[i];
  if (el.id === "gf-name") d.name = el.value;
  else if (c && el.classList.contains("gf-cname")) c.name = el.value;
  else if (c && el.classList.contains("gf-cprice")) moneyField(el, v => { c.price = v; });
  else if (c && el.classList.contains("gf-ccost")) moneyField(el, v => { c.cost = v; });
  else if (c && el.classList.contains("gf-rqty")) { const q = normQtyInput(el.value) ?? 0; c.recipe = c.recipe?.[0]?.itemId ? [{ itemId: c.recipe[0].itemId, qty: q }] : []; }
  if (c) { const h = $("#gf-cost-" + i); if (h) h.textContent = choiceCostText(c); }
});
document.addEventListener("change", ev => {
  const el = ev.target, m = state.ui.modal; if (m?.type !== "group") return;
  const d = m.draft;
  if (el.id === "gf-req") d.required = el.checked;
  if (el.classList.contains("gf-ritem")) { const c = d.choices[Number(el.dataset.i)]; const id = Number(el.value); const q = normQtyInput($(`.gf-rqty[data-i="${el.dataset.i}"]`)?.value) || 1; c.recipe = id ? [{ itemId: id, qty: q }] : []; renderOverlay(); }
});
