# 11 — Skema Penjualan & Harga Nyala Kasir (v1.3)

*Diperbarui 27 Sep 2026 untuk build 1.3.0-rc.1. Angka proyeksi adalah skenario, bukan jaminan.*

## 0.1 Keputusan harga v1.3: **harga TETAP** — Sinkronisasi antar perangkat = **Gratis** (untuk semua paket)
Sinkronisasi (menu, transaksi, stok, pelanggan antar HP) memakai proyek Firebase milik pemilik toko sendiri (paket gratis Google) — **tidak menambah biaya ke Nyala Kasir**, jadi tidak perlu dikunci ke PRO. Ini juga jadi pembeda kuat vs pesaing murah yang memaksa langganan bulanan untuk multi-perangkat. Bila nanti dibuat versi **terkelola** (tanpa perlu bikin proyek Firebase sendiri — lihat dokumen 10, paket BISNIS 2.0), versi terkelola itu yang boleh berbayar; sinkron "bawa akun sendiri" ini tetap gratis selamanya sebagai pembeda.

## 0. Keputusan harga v1.2: **harga TETAP**
| Fitur 1.2 | Paket | Alasan |
|---|---|---|
| Mode gelap (otomatis/terang/gelap) | Gratis | Kenyamanan dasar; memperkuat kesan premium di paket Gratis |
| Kategori "Terlaris" & panduan mulai | Gratis | Mempercepat aha-moment → konversi |
| Scan barcode (kamera & scanner) | Gratis | Membuka pasar retail; batas 25 produk tetap jadi pemicu upgrade |
| Promo terjadwal / Happy Hour + saran jam sepi | **PRO** | Fitur penambah omzet → alasan kuat upgrade |
| Daftar belanja stok → WhatsApp | **PRO** (ikut Stok) | Melengkapi "stok habis ±N hari" di Asisten Untung |

**Kenapa harga tidak dinaikkan:** 1.2 terutama rilis *kualitas* (12 perbaikan audit, termasuk keamanan data) — kualitas adalah kewajiban, bukan alasan menaikkan harga. Fitur PRO baru (Happy Hour, daftar belanja) menaikkan nilai paket tanpa menaikkan harga, sehingga rasio nilai/harga membaik dan konversi trial→berbayar diharapkan naik. Harga 1.1 masih 25–30% dari Qasir Pro / Kasir Pintar Pro dan masih di bawah ambang Rp200 rb. Kenaikan sebaiknya menunggu fitur yang menambah biaya penjual (sinkronisasi cloud → paket BISNIS, bagian 10).

Hook konten baru: *"Jam sepi? Kasir ini yang nyaranin Happy Hour"* dan *"Belanja stok tinggal kirim WA"*.

## 1. Apa yang berubah dan kenapa harga ikut naik
Versi 1.1 menambah 8 fitur yang biasanya hanya ada di paket berbayar pesaing — atau belum ada sama sekali di aplikasi kasir UMKM:

| Fitur baru | Nilai untuk pemilik usaha |
|---|---|
| **Asisten Untung** | Saran otomatis dari data toko sendiri: menu bermargin tipis + harga sarannya, perkiraan "stok habis ±N hari lagi" + jumlah belanja, tren vs hari yang sama, jam ramai, menu bintang, menu lambat |
| **Varian & tambahan** | Ukuran, level gula, topping, extra shot — dengan **HPP per pilihan** dan stok bahan ikut berkurang |
| **Kas & laba bersih** | Catat pengeluaran; belanja stok tidak dihitung dobel; buka/tutup kasir dengan hitung laci per pecahan & selisih |
| **Kartu stamp digital** | "Beli 10 gratis 1" tanpa kartu kertas; hadiah otomatis jadi potongan; kirim status stamp via WhatsApp |
| **Poster menu otomatis** | Gambar menu 4:5 (feed) / 9:16 (Status WA) sekali ketuk |
| **Layar pelanggan** | HP diputar ke pelanggan: total besar, QRIS, "Terima kasih + kembalian" |
| **Target harian** | Cincin progres di Kasir + perayaan saat tercapai |
| **Pembulatan & ringkasan WA** | Pembulatan ke bawah Rp100/500/1.000; ringkasan harian 1 ketuk ke WhatsApp |

Kombinasi **HPP presisi + saran harga + laba bersih + stamp** di aplikasi offline yang sekali bayar adalah posisi yang belum ditempati pesaing murah.

## 2. Harga pesaing (dipublikasikan)
| Aplikasi | Paket | Harga | Setara per tahun |
|---|---|---|---|
| Kasir Pintar | Pro | Rp666.000/tahun (≈Rp55.500/bln) | Rp666.000 |
| Qasir | Pro | Rp66.780/bln (tagihan tahunan); sumber lain Rp699.000/tahun | Rp699–801 rb |
| iReap POS | Pro | Rp500.000/tahun | Rp500.000 |
| Pawoon | Basic | Rp149.000/bulan | Rp1.788.000 |
| Majoo | Starter | Rp129.000–249.000/bulan/outlet (beda sumber) | Rp1,5–3,0 jt |
| Moka | Basic | Rp250.000–299.000/bulan/outlet | Rp3,0–3,6 jt |

Pesaing menyertakan sinkronisasi cloud & multi-perangkat. Nyala Kasir belum punya fitur itu, jadi harganya tetap harus jauh lebih rendah.

## 3. Paket & harga (ditetapkan)
| Paket | Harga normal | **Harga perkenalan** (s.d. 31 Des 2026) | Per bulan |
|---|---|---|---|
| **Gratis** | Rp0 | — | — |
| **PRO 3 Bulan** | Rp69.000 | Rp69.000 | ±Rp23.000 |
| **PRO 1 Tahun** ⭐ | **Rp199.000** | **Rp149.000** | ±Rp16.600 (promo ±Rp12.400) |
| **PRO Selamanya** | Rp399.000 | Rp299.000 | — |

Semua pengguna baru mendapat **uji coba PRO 14 hari** (semua fitur).
Harga perkenalan diatur di `APP.promoUntil` (satu baris), dan aplikasi otomatis menampilkan harga coret.

### Pembagian fitur
| Fitur | Gratis | PRO |
|---|---|---|
| Kasir, 4 metode bayar, QRIS tampil, struk cetak/WA, nomor antrean | ✅ | ✅ |
| Jumlah produk | 25 | Tanpa batas |
| Varian & tambahan | 2 grup | Tanpa batas |
| HPP otomatis dari resep + harga saran | ✅ | ✅ |
| Layar pelanggan, target harian, ringkasan WA | ✅ | ✅ |
| Void, backup/restore, PIN pemilik | ✅ | ✅ |
| Laporan | s.d. 7 hari | 30 hari, bulanan, terlaris, jam ramai, grafik |
| Asisten Untung | 2 saran teratas | Semua saran |
| Kas, pengeluaran, tutup kasir, laba bersih | — | ✅ |
| Kartu stamp & data pelanggan | — | ✅ |
| Stok otomatis, opname, riwayat stok | — | ✅ |
| Diskon, pajak, layanan, pembulatan | — | ✅ |
| Promo terjadwal / Happy Hour, daftar belanja stok | — | ✅ |
| Mode gelap, scan barcode, kategori Terlaris | ✅ | ✅ |
| Open bill, Mode Karyawan, poster menu, logo struk, export CSV | — | ✅ |

**Prinsip pembagian:** paket Gratis harus benar-benar bisa dipakai berjualan (sumber pengguna & promosi dari mulut ke mulut). Semua yang menjawab *"sebenarnya untung berapa & bagaimana menambahnya"* ada di PRO. Keamanan data (backup, void) tidak pernah dikunci.

### Kenapa angka ini
- **Rp199.000/tahun = 25–30% harga Qasir Pro / Kasir Pintar Pro**, padahal cakupan fitur untuk 1 outlet F&B kini setara bahkan lebih (HPP varian, laba bersih, saran harga).
- Kenaikan dari Rp149 rb → Rp199 rb (+34%) lebih kecil daripada tambahan nilainya. Harga perkenalan Rp149 rb menjaga daya tarik saat peluncuran dan memberi alasan kuat "beli sekarang".
- **Hitungan balik modal untuk kedai 50 cup/hari:**
  - Harga saran +Rp500/cup = ±Rp750 rb laba tambahan/bulan.
  - Stamp card menambah 1 kunjungan ulang/hari × laba Rp10 rb = ±Rp300 rb/bulan.
  - Aplikasi balik modal dalam **< 1 minggu**.
- Tetap **di bawah Rp200 rb** — ambang psikologis keputusan sekali bayar bagi pemilik usaha kecil.
- 3 bulan (Rp23 rb/bln) sengaja paling mahal per bulan → paket tahunan terlihat jelas paling hemat.

## 4. Ekonomi per penjualan
Asumsi: fee Mayar (Starter) produk digital 4% + QRIS 0,7% ≈ **4,7%**; komisi afiliasi **30%**.

| Paket | Harga | Bersih langsung | Bersih via afiliasi |
|---|---|---|---|
| PRO 3 Bulan | Rp69.000 | Rp65.757 | Rp45.057 |
| PRO 1 Tahun (promo) | Rp149.000 | Rp141.997 | Rp97.297 |
| PRO 1 Tahun (normal) | Rp199.000 | Rp189.647 | Rp129.947 |
| PRO Selamanya (promo) | Rp299.000 | Rp284.947 | Rp195.247 |
| PRO Selamanya (normal) | Rp399.000 | Rp380.247 | Rp260.547 |

Biaya tetap: hosting statis gratis + domain ±Rp150–250 rb/tahun. Tidak ada biaya server per pengguna.

**Skenario pendapatan bersih per bulan.** Campuran penjualan: 20% paket 3 bulan, 55% tahunan, 25% selamanya. 40% penjualan lewat afiliasi.

| Penjualan/bulan | Masa promo (±Rp142 rb/penjualan) | Harga normal (±Rp186 rb/penjualan) |
|---|---|---|
| 30 | ±Rp4,3 juta | ±Rp5,6 juta |
| 60 | ±Rp8,5 juta | ±Rp11,1 juta |
| 100 | ±Rp14,2 juta | ±Rp18,6 juta |
| 250 | ±Rp35,5 juta | ±Rp46,4 juta |

## 5. Skema penjualan (funnel)
1. **Konten → coba gratis** (tanpa daftar akun). Tiga hook video terkuat:
   - "HPP es kopi susu kamu sebenarnya berapa?" (harga saran)
   - "Kasir yang ngasih tahu stok susu habis 2 hari lagi" (Asisten Untung)
   - "Kartu stamp tanpa kertas" (stamp card)
2. **Aha-moment 5 menit:** contoh menu lengkap dengan varian → pengguna melihat laba per cup, Large vs Regular, dan saran Asisten.
3. **Uji coba PRO 14 hari** → pengguna terbiasa dengan laba bersih, stamp, dan tutup kasir.
4. **Pemicu upgrade di dalam app** (sudah dibangun):
   - batas 25 produk dan 2 grup varian
   - laporan lebih dari 7 hari dan export CSV
   - kas/laba bersih, stamp, poster, stok, open bill, Mode Karyawan
   - saran Asisten ke-3 dan seterusnya
   - pengingat 3 hari sebelum masa coba habis
5. **Loop viral gratis:** ringkasan WA dari pengguna Gratis diberi catatan kecil "dibuat dengan Nyala Kasir". Struk WA dan poster ikut menyebarkan nama toko pengguna.
6. **Beli:** tombol Beli → WhatsApp admin (`APP.supportWa`) atau checkout Mayar/Lynk (`APP.buyUrl`).
7. **Aktivasi < 5 menit:** buat kode di Admin Lisensi, lalu kirim link aktivasi 1 ketuk.
8. **Retensi & perpanjangan:** update fitur rutin (roadmap), grup WA pengguna, dan pengingat backup.

## 6. Kanal distribusi
| Kanal | Cara | Target awal |
|---|---|---|
| TikTok & Reels | 4–5 video/minggu, format "masalah → layar HP → hasil" | 10 rb tayangan/minggu |
| Komunitas UMKM/barista (WA, FB) | Kelas gratis 20 menit "HPP & harga jual" + demo | 2 kelas/bulan |
| Program afiliasi 30% | Admin komunitas, konsultan F&B, kreator kuliner | 20 afiliator aktif |
| Mitra printer thermal & supplier bahan kopi | Bundel "printer + PRO 1 Tahun" | 3 mitra |
| Marketplace produk digital | Halaman Mayar/Lynk + checkout otomatis | — |

## 7. Promo peluncuran (s.d. 31 Des 2026)
- PRO 1 Tahun **Rp149.000** (normal Rp199.000), PRO Selamanya **Rp299.000** (normal Rp399.000).
- Bonus **setup menu + resep + varian** 30 menit via WA untuk pembeli tahunan/selamanya.
- **Garansi 7 hari uang kembali.**

## 8. Alur operasional penjualan
1. Pembayaran masuk → catat di spreadsheet: tanggal, no. pesanan, nama, paket, nominal, kanal/afiliasi.
2. Admin Lisensi → isi nama & no. pesanan → *Buat kode* → *Kirim via WhatsApp*.
3. Opsional: batch CSV kode unik untuk platform yang mengirim kode otomatis.
4. Refund → no. pesanan dimasukkan ke `APP.revokedOrders`, lalu rilis ulang.

## 9. Kebijakan & legal (template — sesuaikan)
- **Lisensi:** 1 kode = 1 usaha; boleh dipasang ulang di HP baru milik usaha yang sama.
- **Privasi:** data transaksi & pelanggan tersimpan di perangkat pengguna; penjual tidak mengumpulkan data. *Catatan: kartu stamp menyimpan nama & no. HP pelanggan — pemilik toko sebaiknya meminta izin pelanggan (UU PDP).*
- **Refund:** 7 hari. **Merek:** cek PDKI sebelum iklan berbayar. **Pajak:** konsultasikan dengan konsultan pajak (bukan nasihat pajak).

## 10. Tangga harga berikutnya
**BISNIS** Rp49.000–79.000/bulan setelah ada backend: sinkronisasi cloud, multi-perangkat, multi-cabang, akun karyawan. Pembeli PRO Selamanya mendapat diskon loyalitas.

## 11. KPI mingguan
Kunjungan app · % selesai onboarding · transaksi pertama < 24 jam · % pengguna yang membuka Asisten Untung · konversi trial→berbayar (target 5–8%) · campuran paket · refund (< 5%) · tiket dukungan per 100 pembeli.

---
**Sumber harga:** founderplus.id (Juli 2026) · mas-software.com (Juni 2026) · qasir.id/en/qasir-pro · foliopos.com · mayar.id/pricing · ikhwanalim.com.
