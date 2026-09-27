# 12 — Laporan Audit Menyeluruh v1.1 → v1.2

Tanggal: 25 Sep 2026 · Objek: build 1.1.0-rc.1 (V17-RC2), 13 modul, ±3.400 baris JS
Metode: baca kode per modul (domain, penyimpanan, UI) + uji eksploratif otomatis pada skenario tepi (`qa/audit12.py`) + audit kontras warna + uji upgrade data.

## Ringkasan
Ditemukan **12 masalah**. Tidak ada yang menyebabkan salah hitung uang pada alur normal, tetapi ada:
- 1 celah keamanan (Tinggi): XSS lewat file cadangan palsu;
- 3 masalah integritas data operasional (Tinggi/Sedang);
- beberapa kekurangan UX & aksesibilitas.

Semuanya sudah diperbaiki dan diuji otomatis di 1.2.0-rc.1.

| ID | Sev | Temuan (direproduksi) | Akar masalah | Perbaikan | Uji |
|---|---|---|---|---|---|
| A-01 | **Tinggi (keamanan)** | File cadangan palsu berisi HTML di nomor pesanan / jumlah shift / stamp **menjalankan skrip** saat dipulihkan (terbukti: `window.__x=3`) | Record transaksi, shift & pengeluaran dari file tidak disanitasi; beberapa angka dirender tanpa escape | Sanitizer per record (`sanitizeTx/Exp/Shift`, pengaturan & held), angka dipaksa `Number`, no. HP hanya digit | SEC-02 |
| A-02 | Sedang (keamanan) | No. HP pelanggan dari cadangan `x@evil.com/` → link `wa.me/x@evil.com/` mengarah ke domain lain | no. HP tidak dinormalisasi | normalisasi 62…, link WA hanya digit | SEC-02 |
| A-03 | **Tinggi** | Pesanan tersimpan (open bill) **terhapus diam-diam**: buka pesanan "Meja 3" → hapus semua item → jual pesanan lain → "Meja 3" hilang | `cart.heldId` tetap menempel pada keranjang kosong | keranjang kosong dilepas dari pesanan tersimpan | H-01 |
| A-04 | Sedang | Berpindah antar pesanan tersimpan menggandakan entri; pelanggan/kartu stamp hilang saat pesanan dilanjutkan | entri lama tidak diganti; `customerId` tidak disimpan | `parkCart()` tunggal (ganti, bukan tambah) + simpan pelanggan & status hadiah | H-02 |
| A-05 | **Tinggi (integritas kas)** | Tutup kasir: kolom "uang dihitung" **terisi otomatis = jumlah sistem**, jadi selisih tidak pernah ketahuan kalau kasir langsung menekan Tutup | nilai default | kolom wajib diisi; tombol eksplisit "Uang di laci pas Rp…" | K-06 |
| A-06 | Sedang | Masa coba habis saat shift terbuka → tombol tutup kasir hilang (shift menggantung selamanya) | seluruh tampilan Kas dikunci | shift berjalan tetap bisa ditutup; fitur lain tetap PRO | K-07 |
| A-07 | Sedang | Ringkasan Kas basi: setelah buka kasir/transaksi, angka "seharusnya di laci" tidak berubah | cache tampilan tanpa invalidasi | versi data global (`DB.ver`) bertambah di setiap tulis; tampilan Kas, Asisten & Terlaris memuat ulang otomatis | K-05 |
| A-08 | Sedang | Isian pajak hilang saat memilih pembulatan; jumlah stok masuk hilang saat menyalakan "Harga beli berubah?"; isian % promo hilang saat memilih hari | sheet dirender ulang dari data lama | nilai disimpan di draft / tanpa render ulang | F-40, F-41, PR-03 |
| A-09 | Sedang (aksesibilitas) | Kontras teks bantu 3,4:1, harga hijau 3,5:1, tombol Bayar putih-di-hijau **2,2:1** (di bawah WCAG AA 4,5:1) — sulit dibaca di bawah matahari | palet warna | teks bantu #657287 (4,9:1), hijau #07845f (4,7:1), tombol Bayar hijau tua | A11Y-01 |
| A-10 | Rendah | Perkiraan stok habis mengabaikan transaksi yang dibatalkan (pemakaian terhitung terlalu besar) | log `void` tidak dikurangkan | pemakaian bersih = jual − batal | AI-02 |
| A-11 | Rendah | Tombol Back Android saat Layar Pelanggan terbuka menutup sheet di belakangnya, layar pelanggan tetap tampil | urutan penanganan `popstate` | Back menutup layar pelanggan dulu | manual/NAV |
| A-12 | Rendah | Poster menu memotong daftar menu tanpa pemberitahuan saat menu sangat banyak | batas kanvas | teks "+N menu lainnya" | PO-01 |

## Yang diperiksa & dinyatakan baik
- Aritmetika uang: BigInt/rasional, pembulatan sekali di akhir, urutan promo → diskon → hadiah → layanan → pajak → pembulatan (CALC-01…10, PR-01).
- Commit atomik transaksi+stok+log+pelanggan; double-tap aman; void mengembalikan stok & stamp.
- Upgrade data RC1 → 1.2 dan RC2 → 1.2 tanpa kehilangan transaksi/keranjang (UPG-01, UPG-02).
- Performa: tambah item 9 ms, laporan 30 hari 6.000 transaksi ±0,3–0,5 dtk pada CPU 4× lebih lambat.
- CSP tanpa `unsafe-eval` (terbukti memblokir eval), tidak ada request eksternal.
