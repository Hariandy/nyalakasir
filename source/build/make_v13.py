import re,sys
src=open('/home/claude/work/PROFESSIONAL-POS-APPROVED-BASELINE-V12.html',encoding='utf-8').read()
def R(old,new,count=1):
    global src
    n=src.count(old)
    if n!=count: sys.exit(f"PATCH FAIL ({n}x): {old[:90]!r}")
    src=src.replace(old,new)

# title
R('<title>TTM POS — Mobile-First Reference Match V8</title>','<title>Kasir UMKM — V13 (Audit + Critical Fix)</title>')
# BUG-03: global error handler must never delete data / reload-loop
R('''      try { localStorage.removeItem("ttm-pos-payment-reference-v7"); } catch (_) {}
      root.innerHTML='<div class="login"><div class="login-card" style="justify-content:center"><div class="logo">'+(window.__ttmErrorIcon||"⚠")+'</div><h1>Kasir Pintar UMKM</h1><div class="login-sub">Memulihkan aplikasi…</div></div></div>';
      setTimeout(function(){ try { location.reload(); } catch (_) {} }, 50);''',
'''      /* V13 BUG-03: never delete user data, never auto-reload (loop risk). Show recovery UI. */
      console.error("Unhandled error:", ev && ev.error || ev && ev.message);
      if(!document.getElementById("recover-box")){
        root.innerHTML='<div class="login"><div class="login-card" id="recover-box" style="justify-content:center;text-align:center"><div class="logo">⚠</div><h1>Terjadi kendala</h1><div class="login-sub">Data Anda tetap aman di perangkat ini.</div><button class="login-btn" onclick="location.reload()">Muat Ulang</button></div></div>';
      }''')
# BUG-03 boot catch
R('''  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
  state = seedFromPreset("coffee");''','''  /* V13 BUG-03: back up raw data before falling back; never delete. */
  try { const raw=localStorage.getItem(STORAGE_KEY); if(raw) localStorage.setItem(STORAGE_KEY+"-recovery-"+Date.now(), raw); } catch (_) {}
  state = seedFromPreset("coffee");''')
# also corrupted parse at load: back up
R('''}catch(e){state=seedFromPreset("coffee");}''','''}catch(e){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)localStorage.setItem(STORAGE_KEY+"-recovery-"+Date.now(),raw);}catch(_){ }state=seedFromPreset("coffee");}''')

# BUG-02: separate cost basis (buyQty) from stock (qty)
R('''function ingredientUnitCost(ing){
 const price=BigInt(Math.trunc(Number(ing.price)||0));
 const qty=toScaled(ing.qty);''','''function ingredientUnitCost(ing){
 const price=BigInt(Math.trunc(Number(ing.price)||0));
 /* V13 BUG-02: cost basis uses purchase size (buyQty), never the depleting stock (qty). */
 const qty=toScaled(ing.buyQty??ing.qty);''')
# migrate buyQty on seed and load
R('''cats:[...p.cats],ingredients:p.ingredients.map(x=>({...x})),''','''cats:[...p.cats],ingredients:p.ingredients.map(x=>({...x,buyQty:x.buyQty??x.qty})),''')
R('''  if(!Array.isArray(state.ingredients)||!Array.isArray(state.products)) throw new Error("bad data");''','''  if(!Array.isArray(state.ingredients)||!Array.isArray(state.products)) throw new Error("bad data");
  state.ingredients.forEach(i=>{if(i.buyQty===undefined)i.buyQty=i.qty;});
  if(state.type==="retail")state.products.forEach(p=>{if(typeof p.stockUsageQty==="number"&&String(p.stockUsageQty).split(".")[1]?.length>6)p.stockUsageQty=Number(p.stockUsageQty.toFixed(6));});''')
# BUG-04 retail preset precision
R('stockUsageQty:0.083333333333','stockUsageQty:0.083333')
# ingredient form: purchase size + stock
R('''<div class="form-row"><div><div class="form-label">${state.type==="retail"?"Harga Modal Grosir / Kemasan":"Harga Pembelian"}</div><input id="ing-price" class="form-input" type="number" min="0" step="1" value="${i?i.price:""}"></div><div><div class="form-label">${state.type==="retail"?"Jumlah Stok Grosir / Isi Kemasan":"Jumlah Pembelian"}</div><input id="ing-qty" class="form-input" type="number" min="0.000001" step="any" value="${i?i.qty:""}"></div></div>''',
'''<div class="form-row"><div><div class="form-label">${state.type==="retail"?"Harga Modal per Kemasan":"Harga Pembelian"}</div><input id="ing-price" class="form-input" type="number" min="0" step="1" value="${i?i.price:""}"></div><div><div class="form-label">${state.type==="retail"?"Per Jumlah Kemasan":"Jumlah per Pembelian"}</div><input id="ing-buy" class="form-input" type="number" min="0.000001" step="any" value="${i?(i.buyQty??i.qty):(state.type==="retail"?1:"")}"></div></div>
   <div class="form-label">Stok Saat Ini</div><input id="ing-qty" class="form-input" type="number" step="any" value="${i?i.qty:""}">''')
R('''const qty=Number(document.getElementById("ing-qty")?.value||0);const unit''','''const qty=Number(document.getElementById("ing-qty")?.value||0);const buyQty=Number(document.getElementById("ing-buy")?.value||0);const unit''')
R('''if(!name||!Number.isFinite(price)||price<0||!Number.isFinite(qty)||qty<=0){''','''if(!name||!Number.isFinite(price)||price<0||!Number.isFinite(qty)||qty<0||!Number.isFinite(buyQty)||buyQty<=0){''')
R('''const data={id,name,price:Math.round(price),qty,unit,''','''const data={id,name,price:Math.round(price),qty,buyQty,unit,''')
# retail ingredient meta display
R('''<div class="ingredient-meta">${state.type==="retail"?"Harga modal: ":"Harga beli: "}${formatIDR(i.price)} / ${formatQty(i.qty)} ${esc(i.unit)}</div>''','''<div class="ingredient-meta">${state.type==="retail"?"Harga modal: ":"Harga beli: "}${formatIDR(i.price)} / ${formatQty(i.buyQty??i.qty)} ${esc(i.unit)} · Stok: ${formatQty(i.qty)} ${esc(i.unit)}</div>''')

# BUG-01: cash input as text/numeric + in-place update (no full re-render)
R('''<input id="cash-input" class="pay-input payment-ref-input" type="number" min="0" step="1" inputmode="numeric" value="${m.cash||""}"''','''<input id="cash-input" class="pay-input payment-ref-input" type="text" inputmode="numeric" autocomplete="off" value="${m.cash?Number(m.cash).toLocaleString("id-ID"):""}"''')
R('''<div class="payment-ref-change ${enough?"good":"bad"}">''','''<div id="pay-change" class="payment-ref-change ${enough?"good":"bad"}">''')
R('''if(ev.target.id==="cash-input"){const val=ev.target.value,pos=ev.target.selectionStart??val.length;state.modal.cash=Math.max(0,Number(val)||0);render();const el=document.getElementById("cash-input");if(el){el.focus();el.setSelectionRange(pos,pos);}}''',
'''if(ev.target.id==="cash-input"&&state.modal?.type==="payment"){const digits=ev.target.value.replace(/\\D/g,"").slice(0,12);const cash=digits?Number(digits):0;state.modal.cash=cash;ev.target.value=digits?cash.toLocaleString("id-ID"):"";updatePaymentLive();}''')
R('''function checkout(){''','''function updatePaymentLive(){
 if(state.modal?.type!=="payment")return;
 const total=cartTotal(),cash=Number(state.modal.cash||0),enough=(state.modal.method||"Tunai")!=="Tunai"||cash>=total;
 const ch=document.getElementById("pay-change");
 if(ch){ch.className="payment-ref-change "+(enough?"good":"bad");ch.innerHTML=`<span>${enough?"Kembalian":"Uang Kurang"}</span><strong>${enough?formatIDR(cash-total):formatIDR(Math.max(0,total-cash))}</strong>`;}
 const btn=document.querySelector("[data-action=checkout]");if(btn)btn.disabled=!enough;
 document.querySelectorAll("[data-action=quick-cash]").forEach(b=>b.classList.toggle("active",Number(b.dataset.value)===cash));
}
function checkout(){''')
R('''function setQuickCash(v){if(state.modal?.type!=="payment")return;state.modal.cash=Number(v);render();}''','''function setQuickCash(v){if(state.modal?.type!=="payment")return;state.modal.cash=Math.max(0,Math.trunc(Number(v)||0));render();}''')
R('''const cash=method==="Tunai"?Number(state.modal.cash||0):totals.total;''','''const cash=method==="Tunai"?Math.trunc(Number(state.modal.cash||0)):totals.total;''')
# BUG-11 cash-clear
R('''if(action==="quick-cash")return setQuickCash(el.dataset.value);''','''if(action==="quick-cash")return setQuickCash(el.dataset.value);
 if(action==="cash-clear"){if(state.modal?.type==="payment"){state.modal.cash=0;const i=document.getElementById("cash-input");if(i){i.value="";i.focus();}updatePaymentLive();}return;}''')
# BUG-05 open cart from cartbar
R('''<div class="cartbar"><div class="cart-info">''','''<div class="cartbar"><div class="cart-info" data-action="open-cart" role="button" tabindex="0" aria-label="Lihat keranjang" style="cursor:pointer">''')
R('''<div class="cart-label">Total Tagihan</div>''','''<div class="cart-label">Total Tagihan · Ketuk untuk ubah</div>''')
# BUG-06 CSV escapes
R('''const csv="\\\\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\\\\r\\\\n");''','''const csv="\\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\\r\\n");''')
# BUG-07 share text
R('''`Metode: ${t.method}`].join("\\\\n");''','''`Metode: ${t.method}`].join("\\n");''')
# BUG-08 toast without full re-render
R('''function toast(message,error=false){
 state.toast={message,error};
 render();
 clearTimeout(window.__ttmToastTimer);
 window.__ttmToastTimer=setTimeout(()=>{state.toast=null;render();},1900);
}''','''function toast(message,error=false){
 /* V13 BUG-08: toast is drawn in its own layer; it never re-renders forms (no input loss). */
 state.toast={message,error};
 drawToast();
 clearTimeout(window.__ttmToastTimer);
 window.__ttmToastTimer=setTimeout(()=>{state.toast=null;drawToast();},2200);
}
function drawToast(){
 const phone=document.querySelector("#app .phone")||document.getElementById("app");if(!phone)return;
 let el=document.getElementById("toast-layer");
 if(!state.toast){if(el)el.remove();return;}
 if(!el){el=document.createElement("div");el.id="toast-layer";el.setAttribute("role","status");phone.appendChild(el);}
 el.className="toast "+(state.toast.error?"error":"");el.textContent=(state.toast.error?"⚠ ":"✓ ")+state.toast.message;
}''')
R('''${state.toast?`<div class="toast ${state.toast.error?"error":""}">${state.toast.error?"⚠":"✓"} ${esc(state.toast.message)}</div>`:""}</div>`;''','''</div>`;
 drawToast();''')
# BUG-10 icons
R('''  refresh:'<path''','''  wallet:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M16 14.5h2"/>',
  qr:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9.5h18M7 15h4"/>',
  transfer:'<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
  refresh:'<path''')
R('''const methods=[["Tunai","wallet"],["QRIS","qr"],["Transfer","wallet"],["Debit-Kredit","card"]];''','''const methods=[["Tunai","wallet"],["QRIS","qr"],["Transfer","transfer"],["Debit-Kredit","card"]];''')
# BUG-16 label
R('''<span class="history-percent">%</span> LABA BERSIH HARI INI''','''<span class="history-percent">%</span> LABA KOTOR HARI INI''')
# BUG-24/25: confirmation before destructive preset/reset
R('''if(action==="preset")return applyPreset(el.dataset.value);''','''if(action==="preset"){if(el.dataset.value===state.type)return;state.modal={type:"confirm-preset",value:el.dataset.value};return render();}
 if(action==="confirm-preset"){const v=state.modal?.value;state.modal=null;return applyPreset(v);}
 if(action==="confirm-reset"){state.modal=null;return resetData();}''')
R('''if(action==="reset-data")return resetData();''','''if(action==="reset-data"){state.modal={type:"confirm-reset"};return render();}''')
R(''' if(m.type==="confirm-delete-ingredient"){''',''' if(m.type==="confirm-preset")return `<div class="overlay"><div class="confirm-box"><h3>Ganti Jenis Usaha?</h3><p>Katalog produk & stok saat ini akan <b>diganti</b> dengan contoh jenis usaha baru dan keranjang dikosongkan. Riwayat transaksi tetap disimpan.</p><div class="confirm-actions"><button style="background:#f0f3f7;color:#5e6b7e" data-action="close-modal">Batal</button><button style="background:#e45d6d;color:#fff" data-action="confirm-preset">Ya, Ganti</button></div></div></div>`;
 if(m.type==="confirm-reset")return `<div class="overlay"><div class="confirm-box"><h3>Reset Semua Data?</h3><p>Katalog, stok, keranjang, dan <b>seluruh riwayat transaksi</b> akan dihapus permanen dari perangkat ini.</p><div class="confirm-actions"><button style="background:#f0f3f7;color:#5e6b7e" data-action="close-modal">Batal</button><button style="background:#e45d6d;color:#fff" data-action="confirm-reset">Ya, Reset</button></div></div></div>`;
 if(m.type==="confirm-delete-ingredient"){''')
# BUG-13 store name empty
R('''if(ev.target.id==="store-input"){state.store=ev.target.value;}''','''if(ev.target.id==="store-input"){const v=ev.target.value.trim();if(v)state.store=v;}''')
# BUG-12 image size (localStorage quota)
R('''const IMAGE_TARGET_BYTES = 450 * 1024;''','''const IMAGE_TARGET_BYTES = 60 * 1024; /* V13 BUG-12: 450KB/photo exhausted the ~5MB localStorage quota after ~10 photos */''')
R('''let w=img.width,h=img.height,max=1280;''','''let w=img.width,h=img.height,max=480;''')
# receipt: snapshot store name
R('''<div style="text-align:center;font-weight:900">${esc(state.store)}</div>''','''<div style="text-align:center;font-weight:900">${esc(t.store||state.store)}</div>''')
# BUG-09 misleading claims
R('''Sistem Kasir Aman Terenkripsi&nbsp; • &nbsp;Offline Ready''','''Data tersimpan di perangkat ini&nbsp; • &nbsp;Bisa offline''')
R('''["Sinkronisasi Cloud Real-time","Export CSV & Analitik Mendalam","Manajemen Stok & Bahan Baku","Dukungan Multi-Cabang","Tanpa Iklan & Prioritas CS"]''','''["Export CSV Laporan","Analitik Produk Terlaris","Manajemen Stok & Bahan Baku","Backup & Pulihkan Data","Prioritas Bantuan"]''')
R('''toast("PRO aktif di preview");''','''toast("PRO aktif (mode pratinjau)");''')
open('/home/claude/work/build/V13-AUDIT-CRITICAL-FIX.html','w',encoding='utf-8').write(src)
print("V13 written", len(src))
