# 08 — Changelog

## 1.3.0-rc.2 — V19-RC5 (27 Sep 2026) — HOTFIX deployment/instalasi
**Masalah dilaporkan:** setelah deploy `source Zip` ke GitHub lalu sync ke Netlify, aplikasi bisa dibuka sebagai halaman web tapi **tidak bisa dipasang (Install)** sebagai aplikasi — Chrome hanya menawarkan "Tambah ke layar utama" versi bookmark biasa.

**Akar masalah (2 hal, dua-duanya diperbaiki):**
1. **`netlify.toml` hanya ada di dalam folder `app/`.** Saat pengguna menghubungkan SELURUH repo (isi paket rilis: `app/`, `docs/`, `source/`, `versions/`, dll) ke Netlify lewat GitHub, Netlify mencari `netlify.toml` di **akar repo** untuk tahu folder mana yang harus dipublikasikan — tidak ditemukan di sana, sehingga folder yang dipublikasikan salah/tidak sesuai dan `_headers` (yang mengatur tipe konten `manifest.webmanifest`) ikut tidak terpakai. **Fix:** menambahkan `netlify.toml` baru di **akar paket rilis** (`publish = "app"`), sehingga menghubungkan seluruh repo langsung berjalan benar tanpa perlu mengatur folder publikasi secara manual.
2. **Field `id` di manifest diset ke path absolut `"/"`.** Ini valid bila aplikasi ada di akar domain, tapi berisiko dianggap di luar `scope` (`"./"`) bila aplikasi ternyata terpasang di sub-folder — beberapa implementasi browser bisa jadi lebih ketat/tidak konsisten menilai kelayakan pasang pada kasus ini. **Fix:** diubah ke `"."` (relatif terhadap manifest, selalu cocok dengan `scope`), diuji ulang khusus dengan aplikasi disajikan dari sub-path tiruan (`/app/`) — manifest, service worker (scope benar), dan seluruh ikon terverifikasi termuat sempurna.

**Perbaikan cepat untuk situs Netlify yang SUDAH terlanjur di-deploy** (tanpa menunggu paket baru): cukup tambahkan SATU file `netlify.toml` (isinya ada di paket ini, akar folder) ke repo GitHub yang sudah ada, lalu deploy ulang — **atau** di Netlify: Site settings → Build & deploy → Publish directory → isi `app` → Clear cache and deploy site.

Tidak ada perubahan fitur/perilaku aplikasi lain di rilis ini. Uji regresi penuh 135/135 + sinkronisasi 10/10 tetap PASS.

## 1.3.0-rc.1 — V19-RC4 (27 Sep 2026) — PRODUCTION CANDIDATE
**Sinkronisasi antar perangkat** (baru, opsional, tidak menaikkan harga):
- Backend: proyek **Firebase Firestore milik pengguna sendiri** (gratis untuk toko kecil) — bukan server Nyala Kasir, tanpa biaya tambahan bagi penjual aplikasi. Login anonim (tanpa akun/email pelanggan).
- Penyiapan sepenuhnya **copy-paste**: tempel `firebaseConfig` dari situs Firebase + tempel aturan Firestore yang sudah disediakan di dalam app (Pengaturan → Sinkronisasi Antar Perangkat) — tidak perlu mengetik kode apa pun.
- Model penggabungan data dipilih agar **tidak pernah menghapus data diam-diam**: transaksi, kartu stok, pengeluaran & tutup kasir hanya bertambah/ditandai (mis. lunas→batal saat void), tidak pernah ditimpa atau hilang walau digabung dari banyak perangkat. Menu, pelanggan, pesanan tertahan & pengaturan memakai "yang terakhir disimpan menang" (keterbatasan disadari — lihat dokumen 09).
- Perangkat kedua yang bergabung dengan kode toko yang sama ditawari pilihan eksplisit: pakai data yang sudah tersinkron, atau tetap pakai data HP ini (cadangan otomatis dibuat lebih dulu di kedua pilihan).
- Foto produk tidak ikut disinkronkan (ukurannya besar untuk kuota gratis).
- Diuji dengan `qa/test_sync.py`: 2 "perangkat" simulasi + Firestore/Auth tiruan (bukan Firebase asli) — 10/10 pemeriksaan lulus, termasuk memastikan tidak ada transaksi yang hilang dan pembatalan (void) menyebar ke perangkat lain.
- CSP diperluas (`connect-src`) untuk domain Firebase Auth & Firestore saja; tidak ada `eval()`, tidak ada SDK pihak ketiga (REST langsung).

## 1.2.0-rc.1 — V18-RC3 (25 Sep 2026) — PRODUCTION CANDIDATE
**Audit & perbaikan** (detail: dokumen 12): 12 temuan diperbaiki, di antaranya XSS lewat file cadangan palsu, pesanan tersimpan yang bisa terhapus diam-diam, tutup kasir yang menyembunyikan selisih, tampilan kas yang basi, isian form yang hilang, dan kontras warna di bawah standar.

**Inovasi baru**
- **Mode Gelap** (Otomatis ikut HP / Terang / Gelap) untuk seluruh aplikasi; struk tetap bergaya kertas.
- **Promo Otomatis / Happy Hour**: potongan % per hari & jam (termasuk lewat tengah malam), per kategori; promo terbaik dipilih otomatis; banner di Kasir; tercatat di struk, laporan & CSV.
- **Asisten Untung → saran Happy Hour** di jam paling sepi toko (1 ketuk membuat promo).
- **🔥 Terlaris**: chip di Kasir yang mengurutkan menu dari penjualan 30 hari (akses cepat saat ramai).
- **Barcode**: scanner USB/Bluetooth (ketik + Enter langsung masuk keranjang) + scan kamera (BarcodeDetector, Chrome Android); field barcode di produk retail.
- **Daftar belanja pintar**: kebutuhan 7 hari dari pemakaian nyata & batas minimum, dibulatkan ke kemasan beli, perkiraan biaya, kirim ke supplier via WhatsApp.
- **Checklist "Siap jualan"** untuk pemilik baru (menu, QRIS, transaksi pertama, cadangan).
- CSV item terjual kini memuat varian & kategori; CSV transaksi memuat promo, hadiah stamp, pembulatan.
- Uji otomatis: 115 → **135** kasus + uji upgrade dari RC1 & RC2.

## 1.1.0-rc.1 — V17-RC2 "Nyala Kasir" (24 Sep 2026) — PRODUCTION CANDIDATE
**Inovasi (nilai jual baru)**
- **Asisten Untung:** saran otomatis berbasis data lokal — margin tipis + harga saran 50%, menu dijual rugi, HPP belum diisi, perkiraan stok habis (hari) + jumlah belanja 7 hari, tren kemarin vs hari yang sama, jam ramai, menu bintang, menu lambat, ajakan target.
- **Varian & tambahan:** grup global (pilih satu/boleh banyak, wajib/opsional), harga & HPP per pilihan, bahan tambahan ikut mengurangi stok; picker bottom-sheet; baris keranjang digabung per kombinasi.
- **Kas & laba bersih:** pengeluaran berkategori (operasional / belanja stok / ambil pemilik — tidak dobel dengan HPP), buka/tutup kasir dengan hitung per pecahan & selisih, riwayat shift, ringkasan tutup kasir ke WhatsApp.
- **Pelanggan & kartu stamp digital:** min. belanja per stamp, target, hadiah jadi potongan otomatis, dibatalkan → stamp dikembalikan, kirim status stamp via WA.
- **Poster menu** 1080×1350 / 1080×1920 dari menu + foto + logo, siap dibagikan.
- **Layar pelanggan** (total, QRIS, terima kasih + kembalian + stamp).
- **Target harian** dengan cincin progres di Kasir + confetti saat tercapai.
- **Pembulatan total** ke bawah Rp100/500/1.000; **ringkasan harian** 1 ketuk ke WhatsApp.
- Sapaan sesuai waktu & nama pemilik; indikator shift aktif.

**Teknis**
- IndexedDB v2 (store `exp`, `shifts`) + schema 4; upgrade dari RC1 teruji (UPG-01) tanpa kehilangan transaksi/keranjang.
- Sheet hanya beranimasi saat dibuka (tidak "melompat" saat isi berubah).
- Query log stok mundur dari data terbaru (cepat pada 40 rb+ baris).
- Build memasukkan semua modul bernomor + `99-start.js` (boot paling akhir).
- Uji otomatis: 92 → **115** kasus.

## 1.0.0-rc.1 — V16-RC1 "Nyala Kasir" (23 Sep 2026) — PRODUCTION CANDIDATE
**Fondasi**
- Penyimpanan pindah ke IndexedDB; commit atomik transaksi+stok+log; migrasi otomatis dari V12/V13 (kunci lama tidak dihapus).
- Matematika uang & qty presisi (BigInt), dasar biaya bahan terpisah dari stok (akhir drift HPP), parser angka gaya Indonesia.
- Rendering per-region: scroll, fokus keyboard, dan isian form tidak lagi rusak.
- Penanganan error non-destruktif + log diagnostik + unduh data darurat.
- PWA: manifest, service worker offline, ikon, banner pembaruan, tombol Back Android.

**Kasir & pembayaran**
- Keranjang: ubah qty (termasuk desimal), catatan item, hapus, nama pelanggan/meja.
- Diskon % / Rp, pajak & biaya layanan (urutan hitung standar), nomor antrean harian.
- Input tunai format ribuan + uang cepat pintar; QRIS toko tampil di layar bayar; info rekening transfer.
- Open bill (simpan & lanjutkan pesanan).
- Struk: cetak 58/80 mm (termasuk printer Bluetooth via layanan cetak), kirim WhatsApp ke nomor pelanggan, bagikan.

**Laporan**
- Periode hari ini, kemarin, 7/30 hari, bulan ini, bulan lalu; laba kotor & margin; metode bayar; produk terlaris; jam ramai; grafik harian; void beralasan; export CSV (transaksi + item).

**Katalog & stok**
- Mode HPP: resep otomatis / stok grosir (retail) / manual + biaya lain per porsi; meter margin live; **harga saran** 40–70%.
- Stok otomatis, batas minimum, stok masuk (dengan perubahan harga beli), stok opname, log pergerakan; peringatan stok menipis; label "Sisa n / Habis" di kasir.
- Kategori: tambah, ubah nama (ikut ke produk), hapus aman, urutkan; duplikat produk; sembunyikan produk.

**Bisnis & keamanan**
- Onboarding 3 langkah; 4 jenis usaha dengan istilah & model biaya masing-masing.
- Paket Gratis / PRO + uji coba 14 hari; lisensi offline ECDSA; link aktivasi `#lic=`; Seller Kit (CLI + halaman admin).
- PIN pemilik (PBKDF2), kunci saat dibuka, Mode Karyawan.
- Backup/restore penuh, pengingat mingguan, hapus data dengan konfirmasi berlapis.

## V13 — Audit + Critical Fix (23 Sep 2026)
Perbaikan minimal di atas V12: BUG-01, 02, 03, 04 (sebagian), 05 (sebagian), 06, 07, 08, 09, 10, 14, 15, 16, 17, 21; klaim menyesatkan dihapus. Tidak ada perubahan tata letak.

## V14/V15
Dilebur ke siklus build RC (stabilisasi + polish diuji otomatis setiap iterasi). Titik pulih yang tersedia: **V12 (baseline)**, **V13**, **RC1**.
