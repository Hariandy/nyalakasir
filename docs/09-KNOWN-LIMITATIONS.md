# 09 — Known Limitations (jujur)

1. **Satu perangkat per toko.** Tidak ada sinkronisasi cloud/multi-perangkat/multi-cabang. Data hidup di browser perangkat itu.
2. **Data bisa hilang bila pengguna menghapus data browser** atau HP rusak tanpa cadangan. Mitigasi: pengingat backup, penyimpanan permanen, share ke Drive/WA.
3. **Lisensi client-side**: melindungi dari berbagi kode biasa; orang yang paham teknis bisa memodifikasi kode. Satu kode bisa dipakai di beberapa HP bila dibagikan (nama pembeli tampil di aplikasi sebagai pencegah sosial).
4. **Cetak Bluetooth** bergantung pada layanan cetak Android (mis. RawBT) — belum ada koneksi ESC/POS langsung (Web Bluetooth).
5. **QRIS statis** (gambar). Belum QRIS dinamis/verifikasi otomatis dana masuk.
6. **Mode Karyawan** di perangkat yang sama; belum ada akun per karyawan & laporan per kasir/shift.
7. Belum ada: retur parsial, laporan per kasir, bundel/paket promo (beli 2 gratis 1). (Barcode & promo terjadwal **sudah ada** sejak 1.2.) (Varian, pelanggan/stamp, pengeluaran, tutup kasir, pembulatan **sudah ada** sejak 1.1.)
8. Diuji otomatis di Chromium dengan emulasi Android; **belum** diuji di perangkat fisik & iOS Safari (iOS: PWA didukung, tapi kuota & perilaku penyimpanan berbeda).
9. Uji coba 14 hari tercatat lokal: mereset data = trial baru (risiko kecil, karena data juga hilang).
10. Nama "Nyala Kasir" belum dicek di PDKI.
11. **Asisten Untung** memakai aturan (heuristik) atas data lokal, bukan AI server — saran bergantung pada kelengkapan HPP & stok yang diisi. Tren butuh ≥2 minggu data; beberapa saran baru muncul setelah ≥10–20 transaksi.
12. Varian: satu baris bahan tambahan per pilihan di UI (data mendukung lebih); HPP Large dihitung sama untuk semua menu yang memakai grup tersebut.
13. Layar pelanggan memakai layar HP yang sama (belum layar kedua terpisah).
14. Poster memakai font sistem perangkat; tampilan huruf bisa sedikit berbeda antar HP.
15. Data pelanggan (nama, no. HP) tersimpan lokal — pemilik toko bertanggung jawab meminta izin pelanggan (UU PDP).
16. Scan barcode lewat kamera butuh browser yang mendukung BarcodeDetector (Chrome Android); di browser lain gunakan scanner USB/Bluetooth atau ketik kode.
17. Promo otomatis memakai jam perangkat — pastikan jam & zona waktu HP benar.


## Tambahan 1.3 — Sinkronisasi antar perangkat
18. **Menu/pelanggan/pesanan tertahan/pengaturan** memakai "yang terakhir disimpan menang" antar perangkat. Bila 2 perangkat mengedit MENU saat SAMA-SAMA offline, perubahan yang tersambung ke internet lebih akhir bisa menimpa punya yang lain untuk jenis data ini saja. Transaksi, kartu stok, pengeluaran & tutup kasir tidak pernah terkena risiko ini (lihat dokumen 08 & kode `15-sync.js`).
19. **Foto produk tidak disinkronkan** (ukurannya besar untuk kuota gratis Firestore) — tambahkan foto yang sama di tiap perangkat, atau tunggu versi mendatang yang memakai penyimpanan file terpisah.
20. **Jangan buka kasir (shift) di 2 perangkat bersamaan** untuk kasir yang sama — status kasir aktif juga memakai aturan "terakhir menang".
21. Sinkronisasi memakai proyek Firebase **milik pengguna sendiri** (paket gratis Spark) — cukup untuk 1 toko dengan beberapa perangkat; penggunaan sangat tinggi (>puluhan ribu baca/tulis per hari) perlu upgrade ke paket Firebase berbayar (tetap sangat murah, bukan biaya ke Nyala Kasir).
22. Penomoran struk harian (`meta.seq`) bersifat per-perangkat — 2 perangkat yang membuat transaksi di hari sama saat sama-sama offline bisa menghasilkan nomor urut struk yang sama (kosmetik saja, tidak memengaruhi data transaksi).
