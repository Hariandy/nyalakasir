# 04 — Test Matrix & Regression Report

Build diuji: **Nyala Kasir 1.3.0-rc.1 (V19-RC4)** · Chromium (Playwright) · emulasi Android (is_mobile, touch) · 27 Sep 2026

**Hasil: 138 / 138 PASS · 0 FAIL** — `source/qa/test_rc.py` (135 kasus) + `source/qa/test_upgrade.py` (UPG-01 RC1→1.3, UPG-02 RC2→1.3, UPG-03 RC3(1.2)→1.3). Performa: `source/qa/perf.py`. Sinkronisasi: `source/qa/test_sync.py` (lihat bawah).

## Regresi
- Seluruh kasus RC1, RC2 & RC3 (1.2) dijalankan ulang pada 1.3 → **semua PASS**. Tidak ada perubahan schema IndexedDB (tetap 4) — data `syncCfg`/`syncMeta` baru disimpan di store `kv` yang sudah ada, tanpa migrasi.
- 12 temuan audit v1.1 (dokumen 12) tetap tertutup.
- Bug V12 (dokumen 01) tetap tertutup: BUG-01 → F-12…F-17 · BUG-02 → REG-01/02 · BUG-03 → M-01/ERR-01 · BUG-04 → R-01/R-02 · BUG-05 → C-09/F-23 · BUG-06 → F-06…F-10 · BUG-07 → F-30 · BUG-08 → SHARE-01 · BUG-30 → F-04.
- Performa 1.3 (CPU 4× lebih lambat): tambah item 9,2 ms · ganti laporan 30 hari ±530 ms · heap ±12 MB (sinkron tidak aktif berpengaruh ke ukuran ini; siklus sinkron berjalan di latar setiap 30 dtk saat aktif & tab terlihat).

| ID | Area | Scenario | Expected | Actual | Status | Evidence |
|----|------|----------|----------|--------|--------|----------|
| CALC-01 | Kalkulasi | Parser kuantitas: '0,5', 7 desimal, teks, float panjang | 500000 / 1234568 / null / 83333 / 12000000 | {'a': '500000', 'b': '1234568', 'c': None, 'd': '83333', 'e': '12000000'} | ✅ PASS | automated |
| CALC-02 | Kalkulasi | Pembulatan half-up sekali di akhir | [3,2,-3,0] | [3, 2, -3, 0] | ✅ PASS | automated |
| CALC-03 | HPP | HPP resep Es Kopi Susu Aren (18g×150 + 120ml×20 + 20ml×45 + 1 cup×300) | 6300 | 6300 | ✅ PASS | automated |
| CALC-04 | HPP | Biaya pecahan Rp10.000/3 pcs × 1, 2, 0,5 tanpa pembulatan tengah | [3333,6667,1667] | [3333, 6667, 1667] | ✅ PASS | automated |
| CALC-05 | Kalkulasi | Qty pecahan (0,5 kg; 0,333) & nilai besar (Rp999.999.999 × 1000) & keranjang kosong | [9000,3330,999999999000,0] | [9000, 3330, 999999999000, 0] | ✅ PASS | automated |
| CALC-06 | Kalkulasi | Diskon 10% → layanan 5% → pajak 11% dari (base+layanan); diskon nominal dibatasi subtotal | [100000,10000,4500,10395,104895,54500,100000,0] | [100000, 10000, 4500, 10395, 104895, 54500, 100000, 0] | ✅ PASS | automated |
| CALC-07 | Kalkulasi | Harga saran margin 60%/50%, HPP 0, persen koma, basis poin | [16000,13000,0,250,250] | [16000, 13000, 0, 250, 250] | ✅ PASS | automated |
| CALC-08 | Payment | Saran uang cepat untuk Rp58.000 | berisi 58000, 60000, 100000 & semua ≥ total | [58000, 60000, 100000] | ✅ PASS | automated |
| REG-01 | Regresi V12 | HPP tidak berubah setelah 8 cup terjual (BUG-02) | [6300, 6000-960=5040] | [6300, 5040] | ✅ PASS | automated |
| REG-02 | Regresi V12 | HPP tetap benar saat stok bahan 0 | 6300 | 6300 | ✅ PASS | automated |
| CALC-09 | Stok | Stok cup berkurang sesuai resep (150 − 8) | 142 | 142 | ✅ PASS | automated |
| F-01 | Kasir | Cari produk 'mat' (fokus input tetap) | ['Matcha Latte'], fokus #pos-search | [['Matcha Latte'], 'pos-search'] | ✅ PASS | automated |
| F-02 | Kasir | Filter kategori Makanan | ['Butter Croissant'] | ['Butter Croissant'] | ✅ PASS | automated |
| F-03 | Kasir | Tambah produk yang sama 3× | badge 3, 1 baris keranjang | ['3', 1] | ✅ PASS | automated |
| F-04 | Kasir/Mobile | Posisi scroll tetap setelah tambah item (V12 BUG-30) | 250 | 250 | ✅ PASS | automated |
| F-05 | Kasir | Total bar = 3×22.000 + 6.000 | Rp 72.000 | Rp 72.000 | ✅ PASS | automated |
| F-06 | Keranjang | Kurangi qty dari 3 → 2 | 2 | 2 | ✅ PASS | automated |
| F-07 | Keranjang | Hapus baris Air Mineral | 1 baris tersisa | 1 | ✅ PASS | automated |
| F-08 | Keranjang | Catatan item tersimpan | less sugar | less sugar | ✅ PASS | automated |
| F-09 | Keranjang | Qty 0 → keranjang kosong, sheet & bar tertutup | 0 / tidak ada bar / tidak ada sheet | [0, False, False] | ✅ PASS | automated |
| F-10 | Keranjang | Tambah ulang setelah kosong | Rp 33.000 | Rp 33.000 | ✅ PASS | automated |
| F-11 | Payment | Buka lalu batalkan pembayaran — keranjang utuh | 2 baris | 2 | ✅ PASS | automated |
| F-12 | Payment | Uang kosong → tombol nonaktif, 'Uang kurang Rp 33.000' | disabled + kurang | [True, 'Uang kurangRp 33.000'] | ✅ PASS | automated |
| F-13 | Payment | Default uang diterima = total (Uang Pas, perilaku V12) | 33.000 | 33.000 | ✅ PASS | automated |
| F-14 | Payment | Uang kurang (20.000) → nonaktif | True | True | ✅ PASS | automated |
| F-15 | Payment | Ketik manual 50000 → format & kembalian (V12 BUG-01) | 50.000 / Kembalian Rp 17.000 | ['50.000', 'KembalianRp 17.000'] | ✅ PASS | automated |
| F-16 | Payment | Input tidak valid '4a5.0,00-0' → hanya digit | 450.000 | 450.000 | ✅ PASS | automated |
| F-17 | Payment | Tombol uang cepat mengisi nominal | >= 33000 | 40000 | ✅ PASS | automated |
| F-18 | Payment | Double-tap Proses → hanya 1 transaksi | 1 | 1 | ✅ PASS | automated |
| F-19 | Payment | Transaksi: total, uang, kembalian, metode, no. antrean | 33000 / Tunai / change=cash-33000 / #1 | [33000, 'Tunai', 40000, 7000, 1] | ✅ PASS | automated |
| F-20 | Payment | Keranjang reset setelah bayar | 0 baris, bar hilang | [0, False] | ✅ PASS | automated |
| F-21-QRIS | Payment | Bayar via QRIS | method QRIS, cash=total, change 0 | ['QRIS', 15000, 0] | ✅ PASS | automated |
| F-21-Transfer | Payment | Bayar via Transfer | method Transfer, cash=total, change 0 | ['Transfer', 15000, 0] | ✅ PASS | automated |
| F-21-Kartu | Payment | Bayar via Kartu | method Kartu, cash=total, change 0 | ['Kartu', 15000, 0] | ✅ PASS | automated |
| F-22 | Payment | Buka ulang pembayaran → metode & uang di-reset (Tunai, = total) | Tunai / 15.000 | ['Tunai', '15.000'] | ✅ PASS | automated |
| F-23 | Persistensi | Reload → 4 transaksi & keranjang (1 item) tetap | 4 / 1 | [4, 1] | ✅ PASS | automated |
| F-24 | Diskon | Diskon 10% atas Rp15.000 | discount 1500, total 13500, profit = 13500 - HPP | [{'type': 'pct', 'value': 1000, 'amount': 1500}, 13500, 10500, 3000] | ✅ PASS | automated |
| F-25 | Antrean | Nomor pesanan bertambah per hari | #5 | 5 | ✅ PASS | automated |
| F-26 | Open bill | Simpan pesanan 'Meja 4' | held=1, keranjang kosong, chip tampil | [1, 0, 'Meja 4 · Rp 18 rb'] | ✅ PASS | automated |
| F-27 | Open bill | Lanjutkan & bayar pesanan tersimpan → held terhapus | held=0, customer 'Meja 4' | [0, 'Meja 4'] | ✅ PASS | automated |
| F-28 | Laporan | Ringkasan hari ini = jumlah transaksi | sales 109500, 6 transaksi | {'sales': 109500, 'count': 6, 'profit': 81900} | ✅ PASS | automated |
| F-29 | Void | Batalkan transaksi terakhir (Es Kopi 18.000): stok kopi kembali +18 g, laporan tidak menghitung | stok +18, sales 91500, voids 1 | [874, 892, {'sales': 91500, 'count': 5, 'voids': 1}] | ✅ PASS | automated |
| F-30 | Export | Export CSV: 2 file, BOM UTF-8, CRLF, 1 header + 6 baris, status BATAL | 2 file valid | [2, '239,187,191\|"ID Transaksi","No","Tanggal","Jam","Status","Pe'] | ✅ PASS | automated |
| F-31 | Riwayat | Detail struk memuat total, metode, antrean & kembalian | TOTAL, Tunai, #00, Kembali | Kopi Senja          27 Sep 2026, 04.47 · #005     TRX-20260927-044715-D5779          Americano ColdRegular, Normal ice1  | ✅ PASS | automated |
| C-01 | Katalog | Form produk: HPP live dari resep (20 g kopi + 1 cup = 3.000+300) | HPP Rp 3.300, margin 84% |      HPP per porsiRp 3.300     Laba per penjualanRp 16.700     Margin84%         | ✅ PASS | automated |
| C-02 | Katalog | Tombol harga saran (margin 50%) mengisi harga | 7.000 | 7.000 | ✅ PASS | automated |
| C-03 | Katalog | Simpan produk baru dengan resep | tersimpan, costMode recipe, 2 baris | ['recipe', 2] | ✅ PASS | automated |
| C-04 | Katalog | Produk baru tampil di Kasir | tampil | True | ✅ PASS | automated |
| C-05 | Katalog | Edit harga produk | 22000 | 22000 | ✅ PASS | automated |
| C-06 | Katalog | Duplikat produk | ada '(salinan)' | True | ✅ PASS | automated |
| C-07 | Katalog | Hapus produk yang ada di keranjang ditolak | ditolak + toast | True | ✅ PASS | automated |
| C-08 | Katalog | Hapus produk (konfirmasi) | terhapus | False | ✅ PASS | automated |
| SEC-01 | Keamanan | Nama produk berisi HTML/JS dirender sebagai teks | tidak dieksekusi, 0 <img src=x> | [0, 0] | ✅ PASS | automated |
| C-09 | Katalog | Upload foto 3000×2000 → dikompres ≤ 60 KB & tersimpan | ≤ 61440 byte | 1679 | ✅ PASS | automated |
| C-10 | Katalog | Upload format tidak didukung (GIF) ditolak | toast error | True | ✅ PASS | automated |
| C-11 | Bahan | Tambah bahan: biaya/ml presisi (65.000 ÷ 750 = 86,67) | Rp 86,67 / ml, stok 750 | ['Biaya per 1 mlRp 86,67 / mlDihitung pres', 750] | ✅ PASS | automated |
| C-12 | Stok | Tambah stok 750 ml + log pergerakan | 1500, log [awal, restock] | [1500, ['awal', 'restock']] | ✅ PASS | automated |
| C-13 | Stok | Stok opname 100 (≤ min 150) → peringatan menipis di Kasir | 100 + notice | [100, True] | ✅ PASS | automated |
| C-14 | Bahan | Hapus bahan yang dipakai → HPP produk dikunci manual (V12 BUG-20) | manual 3000 | ['manual', 3000] | ✅ PASS | automated |
| C-15 | Katalog | Ganti nama kategori ikut mengubah produk | Kopi→Coffee | ['Coffee', 5] | ✅ PASS | automated |
| ERR-01 | Stabilitas | Tidak ada exception JS selama alur katalog | [] | [] | ✅ PASS | automated |
| R-01 | Retail | Harga modal eceran: 180.000/12 ×1; mi 120.000/40 ×5 | [15000,15000] | [15000, 15000] | ✅ PASS | automated |
| R-02 | Retail | Checkout retail (V12 BUG-04) & stok eceran berkurang | [59,155] · '4 karton + 11 pcs' | [[59, 155], '4 karton + 11 pcs'] | ✅ PASS | automated |
| R-03 | Retail | Terminologi retail: Produk & Stok / Stok Grosir / Kemasan (bukan resep) | Produk & Stok, Stok Grosir | ['Produk & Stok', '4 barang · Stok Grosir / Kemasan'] | ✅ PASS | automated |
| R-04 | Retail | Form produk retail memakai 'Sumber stok' & 'Isi terjual', tanpa kata 'Resep' | tanpa 'Resep' | False | ✅ PASS | automated |
| S-01 | Jasa | Terminologi 'Perlengkapan' & biaya modal (40ml×12 + 20ml×9 + 1.200) | Perlengkapan / 1860 | ['Perlengkapan', 1860] | ✅ PASS | automated |
| L-01 | Lisensi | Kode valid diterima; tanda tangan rusak, payload dipalsukan & kedaluwarsa ditolak | true/false/false/false(expired) | [True, False, False, False, True] | ✅ PASS | automated |
| L-02 | Paket | Trial habis → FREE; produk ke-26+ memunculkan paket PRO | FREE / pro | ['FREE', 'pro'] | ✅ PASS | automated |
| L-03 | Lisensi | Aktivasi PRO via form & tetap PRO setelah reload | PRO / PRO | ['PRO', 'PRO'] | ✅ PASS | automated |
| L-04 | Lisensi | Link aktivasi #lic=… membuka form terisi | sheet license terisi | license | ✅ PASS | automated |
| P-01 | Keamanan | Buat PIN → disimpan sebagai hash PBKDF2 (bukan teks) | True | True | ✅ PASS | automated |
| P-02 | Keamanan | Kunci saat dibuka: PIN salah ditolak, PIN benar membuka | terkunci lalu terbuka | [True, True] | ✅ PASS | automated |
| P-03 | Mode Karyawan | Mode Karyawan: tab Menu hilang, HPP/laba tidak tampil di keranjang | 3 tab, tanpa 'HPP' | [['pos', 'history', 'settings'], False] | ✅ PASS | automated |
| P-04 | Mode Karyawan | Pembatalan oleh karyawan butuh PIN; PIN salah → tidak batal | PIN diminta, status paid | [True, 'paid'] | ✅ PASS | automated |
| D-01 | Data | Cadangan → pulihkan di perangkat baru (dari layar sambutan) | Kopi Senja, 6 produk, 1 transaksi | [['Kopi Senja', 6], 1] | ✅ PASS | automated |
| D-02 | Data | File cadangan asing ditolak tanpa mengubah data | error toast, data utuh | ['File ini bukan cadangan Nyala Kasir.', 6] | ✅ PASS | automated |
| D-03 | Data | File JSON rusak ditolak | error toast | File cadangan rusak / bukan JSON. | ✅ PASS | automated |
| M-01 | Migrasi | Data V12/V13 dipindah otomatis (produk, bahan, keranjang, transaksi) & kunci lama tidak dihapus | Kedai Lama/2/1/50/notice · Kartu · legacy kept | [{'name': 'Kedai Lama', 'prods': 2, 'cart': 1, 'cupBuy': 50, 'notice': 1}, ['Kartu', True, '2026-09-20'], True] | ✅ PASS | automated |
| M-02 | Migrasi | Plan 'PRO' palsu dari V12 tidak ikut terbawa (lisensi harus valid) | TRIAL (bukan PRO) | TRIAL | ✅ PASS | automated |
| PWA-01 | PWA/Offline | Service worker aktif, manifest standalone + 3 ikon | controller, standalone | [True, ['standalone', 3, './?source=pwa']] | ✅ PASS | automated |
| PWA-02 | PWA/Offline | Mode pesawat: aplikasi tetap terbuka & transaksi tersimpan | 1 transaksi offline | 1 | ✅ PASS | automated |
| CALC-10 | Kalkulasi | Input qty gaya Indonesia: '1.000','0,5','1.5','1.250,5','abc','' | [1000,0.5,1.5,1250.5,null,null] | [1000, 0.5, 1.5, 1250.5, None, None] | ✅ PASS | automated |
| NAV-01 | Mobile | Tombol Back Android menutup sheet (tidak keluar aplikasi) | modal null, tetap di app | [None, 'http://localhost:8765/'] | ✅ PASS | automated |
| NAV-02 | Mobile | Tutup sheet dengan × tetap di tab yang sama | catalog | catalog | ✅ PASS | automated |
| NAV-03 | Mobile | Back dari tab lain kembali ke Kasir | pos | pos | ✅ PASS | automated |
| PRINT-01 | Struk | Cetak struk: window.print dipanggil, template 58mm berisi TOTAL (tanpa CSS aplikasi) | [1, true, 48mm] | [1, True, '48mm'] | ✅ PASS | automated |
| SHARE-01 | Struk | Kirim struk WA: nomor 08… → 628…, teks struk ter-encode | https://wa.me/628123456789?text=…TOTAL | https://wa.me/628123456789?text=*Kopi%20Senja*%0A27%20Sep%20 | ✅ PASS | automated |
| V-01 | Varian | Picker: default Regular/Normal; Large (+4.000, +60ml susu +6g kopi) + Extra shot (+5.000, +18g kopi) | harga 27000, HPP 6300+2100+2700=11100 | [{'g-size': ['reg'], 'g-sugar': ['normal'], 'g-add': []}, 'Tambah · Rp 27.000', [27000, 11100, 27000]] | ✅ PASS | automated |
| V-02 | Varian | Pilihan sama digabung, pilihan beda jadi baris terpisah | [[1,2,3],[1,1,2]] | [[1, 2, 3], [1, 1, 2]] | ✅ PASS | automated |
| V-03 | Varian/Stok | Stok kopi berkurang termasuk bahan varian: 2×(18+6+18) + 1×18 | 1000−84−18 = 898 | [1000, 898] | ✅ PASS | automated |
| V-04 | Varian | Transaksi menyimpan label varian, harga & HPP per unit | Large, Normal, Extra shot · 27000 · 11100 | [['Large, Normal, Extra shot', 27000, 11100, 2], ['Regular, Normal', 18000, 6300, 1]] | ✅ PASS | automated |
| V-05 | Varian | Buat varian baru via UI (multi, +3.000, +HPP 1.200) & pasang ke Croissant | [multi,1,3000,1200,true] | ['multi', 1, 3000, 1200, True] | ✅ PASS | automated |
| V-06 | Varian | Varian baru muncul di picker menu terkait | ['Keju parut'] | ['Keju parut'] | ✅ PASS | automated |
| V-07 | Paket | Paket Gratis: grup varian ke-3+ memunculkan paket PRO | pro | pro | ✅ PASS | automated |
| K-01 | Laba bersih | Laba bersih = laba kotor − biaya operasional; belanja stok tidak dikurangkan (anti dobel HPP) | op 125000, stock 50000, net = profit−125000 | [15500, 125000, 50000, -109500] | ✅ PASS | automated |
| K-02 | Tutup kasir | Modal 200.000 + tunai 6.000 − keluar tunai 75.000 = 131.000; hitung pecahan 220.000 → lebih 89.000 | expected 131000, 2 transaksi, diff +89000 | [131000, 6000, 2, 'Dihitung Rp 220.000Lebih Rp 89.000', [1, 220000, 89000], None] | ✅ PASS | automated |
| K-03 | Tutup kasir | Transaksi saat shift terbuka ditandai shiftId | [true,true] | [True, True] | ✅ PASS | automated |
| K-04 | Ringkasan WA | Ringkasan harian berisi penjualan, laba kotor, biaya & laba bersih | teks lengkap | *Ringkasan Hari ini — Kopi Senja* 27 Sep 2026  Penjualan: Rp 21.000 (2 transaksi | ✅ PASS | automated |
| C-S1 | Kartu stamp | Stamp: 15.000 ≥ min → +1; 2 stamp → hadiah Rp5.000 dipakai; total 10.000 < min → tanpa stamp baru | stamps 1,2 → reward 5000, total 10000, sisa 0; phone 62812… | [1, 2, 5000, 10000, 0, 3, '6281234567890'] | ✅ PASS | automated |
| C-S2 | Kartu stamp | Hadiah mengurangi laba (profit = total − HPP) | profit = 10000 − HPP | [7000, 3000] | ✅ PASS | automated |
| C-S3 | Kartu stamp | Batalkan transaksi hadiah → stamp terpakai dikembalikan | stamps 2, visits 2 | [2, 2] | ✅ PASS | automated |
| R-05 | Pembulatan | 18.000 + pajak 11% = 19.980 → bulat ke bawah Rp500/Rp100; laba berkurang sebesar pembulatan | [19500,480,11520,19900,80] | [19500, 480, 11520, 19900, 80] | ✅ PASS | automated |
| T-01 | Target | Target Rp50.000: penjualan melewati target → dirayakan (confetti) & cincin 🎯 | hit, confetti, chip berubah | ['60%', True, True, '🎯'] | ✅ PASS | automated |
| CD-01 | Layar pelanggan | Layar pelanggan menampilkan total besar & kembali ke kasir saat diketuk | Rp 6.000 lalu tertutup | ['Kopi SenjaTotal pembayaranRp 6.0001 item\n      \n      1× Air', False] | ✅ PASS | automated |
| PO-01 | Poster menu | Poster PNG 1080×1350 (feed) & 1080×1920 (status WA) dibuat dari menu + foto | [1080,1350] / [1080,1920] | [[1080, 1350, 1467609], [1080, 1920]] | ✅ PASS | automated |
| D-04 | Data | Cadangan mencakup pelanggan, pengeluaran, shift & varian | [1,true,true,4] | [1, True, True, 4] | ✅ PASS | automated |
| ERR-02 | Stabilitas | Tidak ada exception JS di alur fitur v1.1 | [] | [] | ✅ PASS | automated |
| AI-01 | Asisten Untung | Deteksi menu rugi (Air Mineral Rp3.000 < HPP 2.500? → margin 17%) + harga saran margin 50% | thin-6 dengan saran Rp5.000 | ['thin-6', 'warn', 'Margin Air Mineral cuma 17%', 'HPP Rp 2.500, harga Rp 3.000. Harga Rp 5.000 memberi margin ±50% (+Rp 2.000 laba/penjualan).'] | ✅ PASS | automated |
| AI-02 | Asisten Untung | Perkiraan stok habis: 3 pcs, terpakai 12 pcs/14 hari → ±3,5 hari | stk-6 'habis ±4 hari lagi' | ['stk-6', 'warn', 'Croissant Beku habis ±4 hari lagi', 'Rata-rata terpakai 0,86 pcs/hari. Belanja ±3 pcs untuk 7 hari.'] | ✅ PASS | automated |
| AI-03 | Asisten Untung | Kartu saran tampil di Laporan | ≥2 kartu | 3 | ✅ PASS | automated |
| H-01 | Open bill | Kosongkan keranjang dari pesanan tersimpan lalu jual item lain → pesanan tersimpan TIDAK ikut terhapus | ['Meja 3'] | ['Meja 3'] | ✅ PASS | automated |
| H-02 | Open bill | Pesanan tersimpan membawa pelanggan (kartu stamp) & berpindah pesanan tidak menggandakan data | customerId ada, id unik | [True, ['hce274b80e8ca4c23', 'hb00536d238f445e9']] | ✅ PASS | automated |
| K-05 | Kas | Ringkasan kas diperbarui otomatis setelah transaksi (tidak basi) | 0 → 1 | [0, 1] | ✅ PASS | automated |
| K-06 | Tutup kasir | Uang dihitung wajib diisi (tidak diisi otomatis = sistem); tombol 'pas' mengisi jumlah sistem | kosong, ditolak, lalu 'Pas ✓' | ['', True, 'Dihitung Rp 6.000Pas ✓'] | ✅ PASS | automated |
| K-07 | Tutup kasir | Shift yang terbuka tetap bisa ditutup setelah masa coba PRO berakhir | tombol Tutup kasir ada | True | ✅ PASS | automated |
| SEC-02 | Keamanan | File cadangan jahat (HTML di nomor pesanan, stamp, shift, target, no. HP) disanitasi saat dipulihkan | tidak ada skrip jalan; no. HP kosong | [0, '', 10] | ✅ PASS | automated |
| PR-01 | Promo otomatis | Promo terbaik dipilih (20% Kopi = 7.200 > 10% semua = 4.200); diskon manual 10% dihitung setelah promo; jam di luar jadwal tidak berlaku | [42000,7200,'HH Kopi',3480,31320,0,7200] | [42000, 7200, 'HH Kopi', 3480, 31320, 0, 7200] | ✅ PASS | automated |
| PR-02 | Promo otomatis | Banner promo tampil di Kasir; transaksi & struk mencatat promo; laba ikut berkurang | promo 3000, total 12000, profit=12000−HPP | [True, {'id': 'a', 'name': 'Happy Hour', 'bp': 2000, 'amount': 3000}, 12000, True] | ✅ PASS | automated |
| PR-03 | Promo otomatis | Buat promo via UI (15%, Makanan, Sen–Jum 14–16) | bp 1500, cats [Makanan], days [1..5] | [['Happy Hour', 2000, ['Kopi'], []], ['Happy Hour', 1500, ['Makanan'], [1, 2, 3, 4, 5]]] | ✅ PASS | automated |
| PR-04 | Paket | Setelah masa coba habis, promo tersimpan tidak lagi memotong harga (fitur PRO) | 0 | 0 | ✅ PASS | automated |
| BC-01 | Barcode | Scanner USB/Bluetooth (ketik kode + Enter) langsung menambah produk & mengosongkan pencarian | Teh Botol ×1, pencarian kosong | [[[25, 1]], ''] | ✅ PASS | automated |
| BC-02 | Barcode | Field barcode di form produk tersimpan (karakter asing dibuang) | 899-ABC12 | 899-ABC12 | ✅ PASS | automated |
| SH-01 | Daftar belanja | Susu: pakai 500 ml/hari × 7 hari = 3.500 ml − stok 1.500 = 2.000 ml → 2 kemasan 1 L = Rp40.000 | [2,2,40000] | [[2, 2, 40000]] | ✅ PASS | automated |
| SH-02 | Daftar belanja | Daftar belanja dibagikan sebagai teks WhatsApp | berisi 'Susu Fresh Milk — 2×' | *Daftar belanja Kopi Senja* 27 Sep 2026  1. Susu Fresh Milk — 2× 1.000 ml  Perki | ✅ PASS | automated |
| GS-01 | Onboarding | Checklist 'Siap jualan' tampil untuk pemilik baru & bisa disembunyikan | tampil lalu hilang | [True, False] | ✅ PASS | automated |
| POP-01 | Kasir | Chip '🔥 Terlaris' mengurutkan menu dari penjualan 30 hari | ['Americano Cold','Air Mineral'] | ['Americano Cold', 'Air Mineral'] | ✅ PASS | automated |
| TH-01 | Tampilan | Mode gelap manual & otomatis mengikuti pengaturan HP | dark / dark / light | [['dark', 'rgb(11, 16, 32)'], 'dark', 'light'] | ✅ PASS | automated |
| A11Y-01 | Aksesibilitas | Kontras teks bantu, harga & tombol Bayar ≥ 4,5:1 (WCAG AA) | semua ≥ 4.5 | {'help': 4.87, 'price': 4.69, 'pay': 4.69} | ✅ PASS | automated |
| F-40 | Form | Isian pajak tidak hilang saat memilih pembulatan (form tetap utuh) | 11 → taxBp 1100, bulat 500 | ['11', [1100, 500]] | ✅ PASS | automated |
| F-41 | Form | Jumlah stok masuk tidak hilang saat menyalakan 'Harga beli berubah?' | 1500 | 1500 | ✅ PASS | automated |
| MOB-320 | Mobile | Viewport 320px: tanpa overflow horizontal, tombol Bayar/Proses terlihat, target sentuh ≥36px | 0 masalah | [] | ✅ PASS | automated |
| MOB-360 | Mobile | Viewport 360px: tanpa overflow horizontal, tombol Bayar/Proses terlihat, target sentuh ≥36px | 0 masalah | [] | ✅ PASS | automated |
| MOB-375 | Mobile | Viewport 375px: tanpa overflow horizontal, tombol Bayar/Proses terlihat, target sentuh ≥36px | 0 masalah | [] | ✅ PASS | automated |
| MOB-390 | Mobile | Viewport 390px: tanpa overflow horizontal, tombol Bayar/Proses terlihat, target sentuh ≥36px | 0 masalah | [] | ✅ PASS | automated |
| MOB-412 | Mobile | Viewport 412px: tanpa overflow horizontal, tombol Bayar/Proses terlihat, target sentuh ≥36px | 0 masalah | [] | ✅ PASS | automated |
| UPG-01 | Migrasi | Upgrade dari RC1 (1.0, IndexedDB v1, schema 3) ke 1.3 di origin yang sama: data, transaksi & keranjang tetap; bisa langsung jualan | tx 1→2, keranjang tetap, 0 error | tx 1 → 2, cart 1, groups 4, exp/shifts 0, errors [] | ✅ PASS | qa/test_upgrade.py |
| UPG-02 | Migrasi | Upgrade dari RC2 (1.1, IndexedDB v2, schema 4) ke 1.3 di origin yang sama | tx 1→2, keranjang tetap, 0 error | tx 1 → 2, cart 1, groups 4, exp/shifts 0, errors [] | ✅ PASS | qa/test_upgrade.py |
| UPG-03 | Migrasi | Upgrade dari RC3 (1.2) ke 1.3 (sinkronisasi ditambahkan, schema tetap 4, tanpa migrasi) di origin yang sama | tx 1→2, keranjang tetap, 0 error | tx 1 → 2, cart 1, groups 4, exp/shifts 0, errors [] | ✅ PASS | qa/test_upgrade.py |


## Sinkronisasi antar perangkat (`qa/test_sync.py`, terpisah dari matrix di atas)
Auth & Firestore ditiru (bukan Firebase asli) dengan Playwright network mocking, dijalankan terhadap kode modul `15-sync.js` yang sesungguhnya — 2 "perangkat" (browser context terpisah) berbagi backend tiruan yang sama.

| ID | Skenario | Hasil |
|---|---|---|
| SYNC-A-enable | Perangkat A aktifkan sinkron | ✅ PASS |
| SYNC-A-has-tx / SYNC-A-pushed-tx / SYNC-A-pushed-catalog | Transaksi & katalog lokal A terkirim ke "Firestore" | ✅ PASS |
| SYNC-B-enable / SYNC-B-adopted-catalog / SYNC-B-pulled-tx | Perangkat B bergabung kode toko sama, memilih pakai data yang sudah ada → katalog & riwayat transaksi A ikut termuat | ✅ PASS |
| SYNC-A-sees-B-sale | Penjualan baru di B muncul di A setelah sinkron berikutnya | ✅ PASS |
| SYNC-void-propagates | Pembatalan (void) transaksi di A menjadi status batal juga di B (lunas→batal, tidak pernah sebaliknia) | ✅ PASS |
| SYNC-no-tx-lost | Tidak ada transaksi yang hilang di kedua sisi setelah beberapa putaran sinkron | ✅ PASS |

**10/10 PASS.**
