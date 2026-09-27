# 03 — Bug Register & Bug Fix Report

Status: **VERIFIED** = diperbaiki + lulus uji otomatis (ID uji di kolom Regresi). Tidak ada bug yang ditandai "fixed" tanpa verifikasi.
V13 = perbaikan minimal langsung pada V12 (file terpisah). RC = rilis kandidat (arsitektur baru, UI V12 dipertahankan).

| ID | Sev | Ringkas | Akar masalah | Perbaikan | Regresi | Status |
|---|---|---|---|---|---|---|
| BUG-01 | Critical | Ketik uang tunai 50000 → tercatat 5 | `type=number` dirender ulang per ketikan, caret ke awal; `setSelectionRange` exception | V13: input teks numerik + update di tempat. RC: sama + format ribuan, tanpa render ulang | F-12…F-17 | VERIFIED |
| BUG-02 | Critical | HPP naik setiap penjualan (6.300 → 64.583) | `qty` bahan = stok **dan** pembagi biaya | V13: field `buyQty` terpisah. RC: model `buyQty` (dasar biaya) ≠ `stock` | REG-01, REG-02, CALC-03 | VERIFIED |
| BUG-03 | Critical | Error di layar login menghapus semua data + reload | handler error `removeItem` + auto-reload | V13: layar pemulihan, data disalin ke kunci `-recovery`. RC: error → toast + log; boot gagal → layar pemulihan + "Unduh data darurat"; tidak ada jalur penghapusan | M-01 (kunci lama tetap), ERR-01 | VERIFIED |
| BUG-04 | Critical | Preset retail tak bisa dijual | `stockUsageQty` 12 desimal ditolak parser; model pecahan kemasan tidak eksak | V13: 6 desimal. RC: stok eceran disimpan dalam satuan eceran, `saleUnits` bilangan eksak | R-01, R-02 | VERIFIED |
| BUG-05 | Critical | Transaksi hilang setelah kuota localStorage penuh (±10 foto) | foto 450 KB di localStorage 5 MB | V13: foto ≤60 KB/480 px. RC: IndexedDB + foto ≤60 KB + commit atomik (sukses hanya setelah tersimpan) + minta penyimpanan permanen | C-09, F-23, PWA-02 | VERIFIED |
| BUG-06 | High | Keranjang tak bisa dibuka | tidak ada pemicu `open-cart` | Bar keranjang dapat diketuk → sheet keranjang (qty ±, ubah qty, catatan, hapus) | F-06…F-10 | VERIFIED |
| BUG-07 | High | CSV rusak (`﻿` literal, 1 baris) | escape ganda | BOM & CRLF benar; 2 file (transaksi & item); anti CSV-injection | F-30 | VERIFIED |
| BUG-08 | High | Teks "Bagikan" berisi `\n` literal | escape ganda | Teks struk rapi + kirim WhatsApp langsung | SHARE-01 | VERIFIED |
| BUG-09 | High | Toast menghapus isian form | toast memanggil render penuh | Toast di layer sendiri; render per-region | R8 (V13), C-11 | VERIFIED |
| BUG-10 | High | Reset/ganti jenis usaha tanpa konfirmasi | aksi destruktif langsung | Konfirmasi; ganti jenis usaha default "istilah saja"; ganti katalog/hapus data → cadangan otomatis dulu; hapus semua → ketik "HAPUS" + PIN | S-01, D-01 | VERIFIED |
| BUG-11 | High | PRO gratis sekali tap; fitur yang diiklankan tidak ada; klaim "terenkripsi" | UI demo | Lisensi bertanda tangan ECDSA; daftar fitur PRO = fitur yang benar-benar ada; klaim dihapus | L-01…L-04 | VERIFIED |
| BUG-12 | High | Nama "Kasir Pintar" bentrok merek terdaftar; sisa nama `TTM` | penamaan warisan | Rebrand kerja **Nyala Kasir** (1 konstanta `APP.name`), semua sisa `ttm`/`TTM` dihapus kecuali kunci migrasi | — (inspeksi) | VERIFIED* |
| BUG-13 | High | Login palsu (apa saja diterima) | demo | Login dihapus; diganti onboarding + PIN pemilik PBKDF2 (opsional) + Mode Karyawan | P-01…P-04 | VERIFIED |
| BUG-14 | Medium | Ikon metode bayar/riwayat kosong | ikon tak terdefinisi | Set ikon lengkap | smoke screenshot | VERIFIED |
| BUG-15 | Medium | Tombol × nominal tidak berfungsi | handler tidak ada | `cash-clear` | F-12 | VERIFIED |
| BUG-16 | Medium | Nominal desimal diterima | tanpa normalisasi | Uang = bilangan bulat Rupiah (digit saja) | F-16 | VERIFIED |
| BUG-17 | Medium | "Laba bersih" sebenarnya laba kotor | label | Label "Laba kotor"; pajak dikecualikan dari laba | CALC-06, F-28 | VERIFIED |
| BUG-18 | Medium | Riwayat tanpa filter/void, render semua | — | Periode (hari ini … bulan lalu), paginasi 40+60, void beralasan | F-28, F-29 | VERIFIED |
| BUG-19 | Medium | Tampilan stok grosir menyesatkan | makna `qty` retail | "Rp180.000 / karton isi 12 pcs", stok "4 karton + 11 pcs" | R-02 | VERIFIED |
| BUG-20 | Medium | Hapus bahan → HPP produk jadi 0 diam-diam | tidak ada perlindungan | HPP produk dikunci ke nilai terakhir (manual) + peringatan | C-14 | VERIFIED |
| BUG-21 | Medium | Nama toko kosong masuk state | validasi terlambat | Validasi saat simpan | inspeksi | VERIFIED |
| BUG-22 | Medium | Pencarian render ulang seluruh app | full render | Hanya grid diperbarui (debounce 90 ms), fokus tetap | F-01 | VERIFIED |
| BUG-23 | Medium | Ketuk latar menutup form & draft hilang | backdrop | Form memakai `noBackdropClose` | inspeksi | VERIFIED |
| BUG-24 | Medium | Penjualan diblokir total saat stok bahan tak cukup | aturan kaku | Default boleh jual (stok bisa minus, ditandai); opsi "Tolak jual saat stok habis" | inspeksi + CALC-09 | VERIFIED |
| BUG-25 | Medium | "Offline Ready" tanpa PWA | — | Manifest, service worker, ikon, banner pembaruan | PWA-01, PWA-02 | VERIFIED |
| BUG-26 | Low | Zoom diblokir | `user-scalable=no` | Zoom diizinkan; input 16px (tanpa auto-zoom) | inspeksi | VERIFIED |
| BUG-27 | Low | Struk monospace penuh; nama toko tidak snapshot | CSS / data | Modal normal, struk snapshot `tx.store`, template cetak 58/80 mm terpisah | PRINT-01 | VERIFIED |
| BUG-28 | Low | Placeholder ☕ untuk semua usaha; "Andy" hard-coded | hard-code | Placeholder inisial berwarna; nama pemilik dari onboarding | smoke | VERIFIED |
| BUG-29 | Low | Tak ada umpan balik tambah item | — | Badge qty di kartu + animasi + getar + suara sukses (bisa dimatikan) | F-03 | VERIFIED |
| BUG-30 | High | Daftar menu melompat ke atas saat tambah item | full render | Update DOM terarah | F-04 | VERIFIED |

\* BUG-12: nama "Nyala Kasir" adalah nama kerja — **wajib cek PDKI (pdki-indonesia.dgip.go.id) sebelum rilis publik**.

## Bug baru yang ditemukan & diperbaiki selama pengembangan RC (tertangkap oleh uji otomatis)
| ID | Sev | Temuan | Perbaikan | Uji |
|---|---|---|---|---|
| RC-01 | Medium | Biaya/ml ditampilkan terpotong (86,66 seharusnya 86,67) | pembulatan half-up tampilan | C-11 |
| RC-02 | Medium | Link aktivasi `#lic=` tidak terbaca bila app sudah terbuka | listener `hashchange` | L-04 |
| RC-03 | Medium | Keranjang hilang bila app ditutup <160 ms setelah tambah item | tulis langsung untuk record kecil (cart/held/meta) | PWA-02 |
| RC-04 | Medium | Nomor WA "08…" kehilangan 0 → tidak diawali 62 | normalisasi nomor | SHARE-01 |
| RC-05 | High | Input "1.000" (gaya Indonesia) dibaca 1 → HPP bisa 1000× | parser qty Indonesia (`1.000`=1000, `0,5`=0,5) | CALC-10 |
| RC-06 | High | Tombol Back Android keluar dari aplikasi saat sheet terbuka | riwayat navigasi untuk sheet & tab | NAV-01…03 |
| RC-07 | Critical (build) | Refaktor menghapus fungsi render overlay → app gagal boot (layar pemulihan tampil, data aman) | fungsi dipulihkan + `node --check` & uji boot wajib di build | seluruh suite |

## Temuan & perbaikan selama pengembangan 1.1 (RC2)
| ID | Sev | Temuan | Perbaikan | Uji |
|---|---|---|---|---|
| RC2-01 | Medium | Setiap isi sheet berubah (tambah qty, pilih varian), sheet beranimasi naik ulang → terasa "melompat" (ada sejak RC1) | animasi hanya saat sheet baru dibuka | smoke visual + seluruh suite |
| RC2-02 | Medium | Header Kasir terlalu padat di 320–360 px (nama toko terpotong) setelah cincin target ditambah | pill paket dipadatkan (ikon + sisa hari) | MOB-320…412 |
| RC2-03 | Medium | Build hanya memuat modul `0*.js` → modul baru tidak ikut | glob `NN-*.js` + boot di `99-start.js` | seluruh suite |
| RC2-04 | Low | Pencarian pelanggan merender ulang seluruh sheet per huruf (risiko IME Android) | hanya daftar yang diperbarui | C-S1 |
| RC2-05 | Low | Teks saran Asisten bisa memuat nama satuan/produk tanpa escape | escape saat render | SEC-01 (pola sama) |
| RC2-06 | Low | Saran "menu bintang" muncul dengan 1 transaksi | minimal 10 transaksi | AI-01…03 |
| RC2-07 | Low | Perhitungan log stok memuat seluruh riwayat (lambat pada data besar) | cursor mundur dari data terbaru | perf |

## Audit v1.1 → perbaikan 1.2 (RC3)
Lihat dokumen **12-AUDIT-REPORT-V1.1.md** — 12 temuan (A-01…A-12), semuanya VERIFIED dengan uji SEC-02, H-01, H-02, K-05…K-07, F-40, F-41, PR-03, A11Y-01, AI-02, PO-01.
