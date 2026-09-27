# 02 — Peta Arsitektur (Nyala Kasir RC)

## Bentuk rilis
Satu file `index.html` mandiri (CSS + JS inline, tanpa CDN, tanpa backend) + `manifest.webmanifest` + `sw.js` + ikon. Bisa di-hosting statis gratis (Netlify / Cloudflare Pages / GitHub Pages / Vercel) dan dipasang ke layar utama Android sebagai PWA.

Kode sumber dipisah per modul di `source/src/`, digabung oleh `source/build/build.py` (build juga menjalankan `node --check`).

| Modul | Tanggung jawab |
|---|---|
| `00-assets.js` | 3 foto demo (dibawa dari V12) |
| `01-core.js` | Konfigurasi `APP`, matematika uang presisi (BigInt fixed-point 6 desimal + rasional, pembulatan half-up sekali di akhir), format Rupiah deterministik, util, ikon SVG |
| `02-db.js` | IndexedDB (`kv`, `tx`, `images`, `stocklog`) + fallback localStorage; **commit atomik** transaksi+katalog+log stok; write-behind `Persist` |
| `03-domain.js` | Istilah per jenis usaha, preset, sanitizer, HPP, keranjang/total (diskon→layanan→pajak), checkout, void, stok, laporan, lisensi (ECDSA P-256), PIN (PBKDF2), migrasi V12/V13, validasi backup |
| `04-ui-shell.js` | Render per-region (screen / nav / cartbar / overlay / dialog / toast / banner), sheet & dialog, tombol Back Android, cache gambar blob: |
| `05-ui-pos.js` | Kasir, keranjang, pembayaran, sukses/struk, cetak, WhatsApp, open bill |
| `06-ui-reports.js` | Laporan periode, metode bayar, terlaris, jam ramai, grafik harian, riwayat, detail, void, CSV |
| `07-ui-catalog.js` | Menu/produk, bahan/stok grosir/perlengkapan, form produk (resep/stok/manual + margin live + harga saran), stok masuk/opname + log, kategori |
| `08-ui-settings.js` | Onboarding, kunci PIN, pengaturan, profil & struk, pembayaran/QRIS, pajak, mode karyawan, paket PRO, aktivasi lisensi, backup/restore/hapus, panduan, diagnostik |
| `09-events-boot.js` | Delegasi event (satu listener per jenis), boot + migrasi, error handling non-destruktif, PWA/SW, siklus hidup |
| `10-variants.js` | Grup varian global, picker, pengelola varian, lampiran ke produk |
| `11-cash.js` | Pengeluaran, buka/tutup kasir (shift, hitung pecahan), laba bersih, ringkasan WhatsApp |
| `12-insights.js` | Asisten Untung (aturan atas data lokal), perkiraan stok, target harian + cincin, confetti, layar pelanggan |
| `13-customers-poster.js` | Pelanggan & kartu stamp, poster menu (canvas) |
| `14-v12.js` | Mode gelap, promo otomatis, Terlaris, barcode (scanner & kamera), daftar belanja, checklist siap jualan |
| `99-start.js` | Hook uji + `boot()` (dijalankan paling akhir) |

## Model data (schema 4 · IndexedDB v2)
```
settings  { theme, promos[{id,name,bp,days[],from,to,cats[],active}], roundingStep, dailyTarget, stamp{enabled,minSpend,target,reward}, storeName, ownerName, address, phone, footer, type, logoId, methods{Tunai,QRIS,Transfer,Kartu},
            qrisImageId, transferInfo, taxBp, taxLabel, serviceBp, stockEnabled, blockOversell, askCustomer,
            paper, sound, haptic, pinHash, pinSalt, lockOnOpen, staffMode, license{key,at} }
catalog   { cats[], items[], products[], optionGroups[] }
  group   { id, name, type: single|multi, required, choices[{id,name,price,cost,recipe[]}] }   // product.groups = [groupId]
  item    { id, name, price, buyQty, unit, packName?, stock|null, minStock|null }
          biaya per unit = price ÷ buyQty (retail: harga per kemasan ÷ isi kemasan). STOK TERPISAH dari dasar biaya.
  product { id, name, price, category, imageId, costMode: recipe|stock|manual, recipe[{itemId,qty}],
            stockItemId, saleUnits, manualHpp, extraCost, active }
cart      { lines[{id,pid,qty,note,opts[{g,c}]}], discount{type:pct|amt,value}, customer, customerId, redeem, heldId? }
customers [{ id, name, phone, stamps, visits, spent, lastAt }]          (kv)
shift     { id, openAt, openingCash } | null                            (kv, shift aktif)
exp       { id, day, date, cat, type: op|stock|owner, amount, method, note, shiftId }   (store, index day)
shifts    { …shift, closeAt, count, sales, byMethod, cashSales, cashOut, expected, counted, diff } (store)
held[]    { id, name, lines, discount, customer, at }
meta      { schema, installId, firstRun, trialStart, seq{day,n}, lastBackupAt, lastSeen, hasSales, notices[] }
tx (store){ id, no, day, date, store{…snapshot}, items[{pid,name,price,qty,lineTotal,hpp,hppTotal,note}],
            subtotal, discount{…amount}, reward, rounding, shiftId, cust{earned,used,stamps}, service, tax, taxLabel, total, totalHpp, profit, method, cash, change,
            customer, status: paid|void, voidReason, voidAt, stockMoves[{itemId,qty}], by }
stocklog  { seq, itemId, delta, reason: sale|void|restock|opname|edit|awal, ref?, at }
images    id → dataURL JPEG (≤60 KB produk, ≤30 KB logo, ≤220 KB QRIS)
```

## State & ketergantungan
- **Persisten:** settings, catalog, cart, held, meta (kv) · tx · images · stocklog.
- **UI sementara (tidak disimpan):** `ui.{tab, cat, search, catalogTab, period, modal(draft form), dialog, owner, locked}`, toast, cache laporan.
- **Turunan (dihitung, tidak disimpan):** total keranjang, HPP produk, porsi tersisa, laporan periode, status stok, paket (`lic`).
- `product.recipe.itemId → item.id`, `product.stockItemId → item.id` (hapus item ⇒ HPP produk dikunci manual), `tx.items` = **snapshot** (tidak berubah bila produk diedit/dihapus), `tx.stockMoves` dipakai untuk mengembalikan stok saat void.

## Alur kritis
1. **Checkout:** validasi → hitung total & kebutuhan stok (BigInt) → susun tx + katalog baru + log → `DB.commit` (1 transaksi IndexedDB) → **baru** state diubah & struk tampil. Gagal simpan ⇒ keranjang tetap, pesan jelas.
2. **Void:** PIN (bila ada) + alasan wajib → status `void` + stok dikembalikan atomik → laporan mengecualikan.
3. **Boot:** buka DB → bila kosong baca kunci lama V12/V13 → migrasi (kunci lama **tidak dihapus**) → muat gambar → hitung paket → render.
4. **Error:** tidak ada jalur yang menghapus data. Error runtime → toast + log diagnostik; error saat boot → layar pemulihan dengan tombol "Unduh data darurat".

## Keputusan desain
- **Offline-first tanpa backend** (sesuai kebutuhan UMKM & biaya nol). Konsekuensi: satu perangkat per toko, sinkronisasi cloud = roadmap.
- **IndexedDB** menggantikan localStorage (kuota jauh lebih besar; transaksi atomik).
- **Rendering per-region** menggantikan render penuh V12 → scroll, fokus keyboard, dan form tidak rusak.
- **Lisensi offline bertanda tangan digital** (ECDSA P-256). Kunci publik di app, kunci privat hanya di Seller Kit.

## Urutan hitung total (1.1)
Subtotal (harga + varian) − promo otomatis terbaik − diskon − hadiah stamp = dasar → + layanan → + pajak (dari dasar+layanan) → − pembulatan ke bawah = **Total**. Laba kotor = dasar + layanan − pembulatan − HPP (pajak bukan laba). Laba bersih = laba kotor − biaya operasional (belanja stok & ambil pemilik tidak dikurangkan).

## Invalidasi cache (1.2)
Setiap penulisan database menaikkan `DB.ver`. Tampilan turunan (Kas & laba bersih, Asisten Untung, Terlaris) menyimpan versi data saat dihitung dan memuat ulang otomatis bila berbeda — tidak ada angka basi.


## Tambahan 1.3 — `src/15-sync.js`
- Modul terpisah (pola sama seperti `14-v12.js`): tidak mengubah modul lama.
- REST langsung ke Firebase Auth (anonim) & Firestore — tanpa SDK, tanpa `eval()`. Encode/decode nilai Firestore ditulis manual (±20 baris, mudah diaudit).
- Setiap catatan yang disinkronkan diberi field `_v` (epoch ms) yang dipakai sebagai kursor kueri bertahap (`_v > kursor`) dan penentu "menang" pada data kondisi-saat-ini.
- `kv.syncCfg` (projectId, apiKey, kode toko) & `kv.syncMeta` (bookkeeping lokal: token auth, hash yang sudah dikirim, kursor per koleksi) — **tidak** ikut dalam file cadangan (backup/restore), sengaja dipisah dari data bisnis.
- Data yang disinkronkan lewat sanitizer yang sama dengan pemulihan cadangan (`sanitizeCatalog`, `sanitizeTx`, `sanitizeExp`, `sanitizeShift`, plus `sanitizeCustomer`/`sanitizeHeldOne` yang kini diekstrak agar dipakai bersama oleh `validateBackup`) sebelum dipercaya masuk ke IndexedDB lokal — mempertahankan jaminan keamanan BUG-SEC1 (audit V12) untuk jalur data baru ini juga.
