# 01 — Laporan Audit Baseline V12 (dibuat SEBELUM perubahan besar)

Tanggal audit: 23 Sep 2026 · Auditor: Claude (Lead Eng/QA) · File: `PROFESSIONAL-POS-APPROVED-BASELINE-V12.html` (128 KB, 979 baris, 1 file HTML: CSS 188 baris, JS ~780 baris, 3 foto base64 ~23 KB)

Status baseline: **V12 tidak diubah** (tetap di paket sebagai titik pemulihan).

## Ringkasan eksekutif

V12 tampil rapi dan alur kasir dasarnya jalan, tetapi **tidak aman untuk dijual**. Ditemukan **5 bug Critical** yang langsung memengaruhi uang dan data pelanggan:

1. **Uang diterima salah saat diketik manual.** Mengetik `50000` di kolom tunai menghasilkan `5`; mengetik `25000` bisa menjadi `52`. Kasir hanya aman memakai tombol nominal cepat.
2. **HPP "melonjak" setiap ada penjualan.** Stok bahan dan dasar biaya memakai field yang sama (`qty`). Setelah 8 cup terjual, HPP Es Kopi Susu naik dari Rp6.300 → **Rp64.583**. Laporan laba jadi salah total.
3. **Error apa pun di layar login menghapus SEMUA data** (produk, stok, transaksi), lalu reload otomatis (berisiko loop).
4. **Preset Retail tidak bisa berjualan.** "Minyak Goreng Eceran" selalu ditolak ("stok belum dikonfigurasi") karena angka pemakaian >6 desimal ditolak parser.
5. **Kapasitas penyimpanan habis setelah ±10 foto** (450 KB/foto di localStorage ±5 MB). Setelah penuh, transaksi tetap tampil "berhasil" tetapi **hilang saat aplikasi dibuka ulang**.

Temuan utama di bawah **sudah direproduksi otomatis** dengan Playwright (Chromium, viewport 360×780). Bukti: `qa/repro_v12.py` + output di laporan regresi.

## Hasil reproduksi (bukti)

| Uji | Hasil V12 (aktual) | Yang seharusnya |
|---|---|---|
| Ketik `50000` di Uang Diterima | nilai jadi `5`, 6 exception `setSelectionRange` | 50.000 |
| HPP Es Kopi Susu setelah 0/2/4/6/8 cup terjual | 6.300 → 7.209 → 8.829 → 12.962 → **64.583** | 6.300 tetap |
| HPP bila stok cup tersisa 1 | 21.000 | 6.300 |
| Checkout Minyak Goreng Eceran (preset Retail) | ditolak: "Stok grosir belum dikonfigurasi" | berhasil |
| Error di layar login | data localStorage **terhapus** | data utuh |
| Export CSV | awalan teks `\uFEFF` literal, semua baris jadi 1 baris (`\r\n` literal) | CSV valid multi-baris |
| Ikon metode bayar & riwayat | 4 SVG kosong (ikon `wallet/qr/card` tidak didefinisikan) | ikon tampil |
| Membuka keranjang untuk ubah qty/hapus item | tidak ada tombol yang memicu `open-cart` (0 elemen) | bisa dibuka |
| Isi form Bahan lalu toast lain muncul | input yang sedang diketik **terhapus** | input tetap |

## Peta arsitektur V12

- **Satu IIFE** di `<script>`; state global `state` (objek tunggal) → `render()` membangun ulang **seluruh** DOM (`innerHTML`) pada setiap aksi, termasuk setiap ketikan di pencarian & kolom tunai.
- **Persistensi:** `localStorage["ttm-pos-payment-reference-v7"]` = JSON seluruh state (termasuk foto base64). Versi skema `2`, tanpa migrasi.
- **Event:** delegasi klik/input/change di `document` (baik — tidak ada listener ganda).
- **Perhitungan uang:** BigInt rasional untuk HPP (baik), tapi sumber data salah (lihat BUG-02).
- **State map:**
  - Persisted: `store,type,plan,cats,products[],ingredients[],transactions[],cart[],tab,catalog,logged`
  - UI sementara: `modal` (termasuk draft form `__name/__price/...`), `toast`, `search`, `cat`
  - Turunan: total keranjang, HPP produk, laporan hari ini (dihitung ulang tiap render)
  - Ketergantungan: `products.recipe[].ingredientId → ingredients.id`; retail `products.stockItemId → ingredients.id`; `transactions.items` = snapshot (baik).

## Register bug (V12)

| ID | Sev | Area | Ringkas | Akar masalah |
|---|---|---|---|---|
| BUG-01 | Critical | Payment | Ketik nominal tunai menghasilkan angka salah | `input type=number` di-render ulang per ketikan → caret kembali ke awal ("05"→5); `setSelectionRange` melempar exception pada type number |
| BUG-02 | Critical | HPP | HPP naik tiap penjualan; bila stok 0, HPP = harga beli penuh | `ingredient.qty` dipakai sebagai stok **dan** pembagi biaya per unit |
| BUG-03 | Critical | Data | Error apa pun di luar `.phone` → `localStorage.removeItem` + reload; safe-boot juga menghapus | penanganan error "reset" alih-alih "pulihkan" |
| BUG-04 | Critical | Retail | Produk preset retail tak bisa dijual | `stockUsageQty:0.083333333333` (>6 desimal) → `toScaled()` = null; model "pecahan kemasan" juga tidak eksak (12×0,083333≠1) |
| BUG-05 | Critical | Data | Kuota localStorage habis ±10 foto → transaksi hilang setelah reload | foto target 450 KB & maks 1280 px disimpan di localStorage; tidak ada IndexedDB |
| BUG-06 | High | Kasir | Keranjang tidak bisa dibuka (ubah qty/hapus item mustahil) | modal `cart` ada, tapi tidak ada elemen `data-action="open-cart"` |
| BUG-07 | High | Export | CSV rusak | string `"\\uFEFF"`/`"\\r\\n"` di-escape ganda |
| BUG-08 | High | Struk | Teks "Bagikan" berisi `\n` literal | escape ganda `"\\n"` |
| BUG-09 | High | UX | Toast me-render ulang seluruh app → isian form bahan hilang, fokus/keyboard tertutup | `toast()` & timer memanggil `render()` |
| BUG-10 | High | Data | "Reset Data Demo" & ganti Jenis Usaha menghapus katalog/transaksi **tanpa konfirmasi** | aksi destruktif langsung |
| BUG-11 | High | Komersial | "Langganan Sekarang" langsung mengaktifkan PRO gratis; fitur PRO yang diiklankan tidak ada (cloud sync, multi-cabang, tanpa iklan); klaim "Aman Terenkripsi" tidak benar | UI demo, tanpa lisensi |
| BUG-12 | High | Brand | Nama "Kasir Pintar UMKM" berbenturan dengan merek POS komersial yang sudah ada ("Kasir Pintar"); sisa nama proyek lain (`TTM POS`, `ttm-pos-*`, `TTMPOS_AUDIT`) | penamaan warisan |
| BUG-13 | High | Login | Login menerima kredensial apa pun ("keamanan palsu") | demo login |
| BUG-14 | Medium | UI | Ikon metode bayar & riwayat kosong | `icon('wallet'|'qr'|'card')` tak terdefinisi |
| BUG-15 | Medium | Payment | Tombol × (hapus nominal) tidak berfungsi | handler `cash-clear` tidak ada |
| BUG-16 | Medium | Payment | Nominal desimal diterima (Rp1.500,5) → kembalian pecahan | tidak ada normalisasi integer |
| BUG-17 | Medium | Laporan | "Laba Bersih" sebenarnya laba kotor (omzet − HPP) | label salah |
| BUG-18 | Medium | Riwayat | Semua transaksi dirender sekaligus; tidak ada filter tanggal, void/refund | tidak ada paginasi/void |
| BUG-19 | Medium | Retail | Tampilan stok grosir menyesatkan ("Rp180.000 / 5 karton") | `qty` retail = jumlah stok, bukan isi harga |
| BUG-20 | Medium | Katalog | Hapus bahan → produk resep bisa ber-HPP Rp0 diam-diam | tidak ada peringatan |
| BUG-21 | Medium | Pengaturan | Nama toko dikosongkan → state kosong di memori | handler `input` menulis sebelum validasi |
| BUG-22 | Medium | Mobile | Pencarian me-render ulang seluruh app per huruf (IME Android/Gboard rawan dobel huruf, boros) | full re-render |
| BUG-23 | Medium | Form | Ketuk area gelap menutup form produk → draft hilang | `close-overlay` di form |
| BUG-24 | Medium | Stok | Penjualan diblokir total bila stok bahan tak cukup, padahal banyak UMKM belum mencatat stok | tidak ada mode "stok opsional" |
| BUG-25 | Medium | PWA | Klaim "Offline Ready" tapi tanpa manifest/service worker (tidak bisa di-install) | belum ada PWA |
| BUG-26 | Low | A11y | `user-scalable=no` memblokir zoom | meta viewport |
| BUG-27 | Low | Struk | Modal struk seluruhnya monospace; nama toko diambil dari setting terkini, bukan snapshot | CSS `.receipt` |
| BUG-28 | Low | UI | Placeholder ☕ untuk semua jenis usaha; nama pemilik "Andy" hard-coded | hard-code |
| BUG-29 | Low | UX | Tidak ada umpan balik saat tambah produk (badge qty di kartu, getar) | — |
| BUG-30 | High | Mobile | Setiap tambah produk, daftar menu melompat ke paling atas (scrollTop 294 → 0, terbukti) | `render()` mengganti seluruh `.screen` |

## Keputusan rencana (PLAN)

1. **V13** = perbaikan *minimal* atas V12 untuk seluruh bug Critical + sebagian High (diff kecil, bisa diaudit). Dipertahankan sebagai titik pulih.
2. **RC (V16)** = refaktor terstruktur yang **mempertahankan bahasa visual yang sudah disetujui** (navy + hijau, kartu produk foto, payment sheet, hero laporan) dengan: IndexedDB, model stok terpisah dari biaya, model retail per satuan eceran, backup/restore, void, diskon, laporan periode, lisensi offline, onboarding + PIN, PWA.
3. Tidak ada data pengguna yang dihapus dalam kondisi error apa pun; migrasi dari V12 membaca kunci lama **tanpa menghapusnya**.
