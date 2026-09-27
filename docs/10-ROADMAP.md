# 10 — Next Development Roadmap

Urutan berdasarkan dampak ke penjualan (jawaban keberatan pembeli) × biaya bangun.

| Fase | Target | Isi | Alasan bisnis |
|---|---|---|---|
| 1.0 (sekarang) | Rilis publik | RC1 + checklist dokumen 07 | Mulai jual, kumpulkan umpan balik |
| 1.1 ✅ | Kedai kopi | Varian & HPP per pilihan, pembulatan, tutup kasir, pengeluaran & laba bersih, kartu stamp, Asisten Untung, poster, layar pelanggan, target | **Selesai (RC2)** |
| 1.2 ✅ | Kualitas & pertumbuhan | Audit + 12 perbaikan, mode gelap, promo otomatis, barcode, daftar belanja, Terlaris, checklist | **Selesai (RC3)** |
| 1.3 ✅ | Sinkronisasi antar perangkat | Firestore milik pengguna sendiri (gratis), penyiapan copy-paste, transaksi/stok/kas hanya bertambah (tidak pernah hilang), menu/pelanggan LWW dengan konfirmasi saat bergabung | **Selesai (RC4)** — lihat dokumen 08 §1.3.0-rc.1 |
| 1.4 | Operasional | Retur parsial, bundel promo (beli X gratis Y), laporan per kasir/shift, varian per-menu (override HPP), cetak ESC/POS Bluetooth langsung | Retensi tahun ke-2 |
| 1.4 | Hardware | Cetak ESC/POS langsung via Web Bluetooth; scanner barcode (kamera) untuk retail | Retail & printer thermal |
| 2.0 | Cloud terkelola (paket BISNIS) | Sinkron **tanpa perlu bikin proyek Firebase sendiri** (dikelola Nyala Kasir), multi-cabang, akun karyawan berbasis akun, backup otomatis cloud | Upsell berulang (Rp49–79 rb/bln) — inti sinkronnya sendiri sudah gratis sejak 1.3 |
| 2.1 | Integrasi | QRIS dinamis (payment gateway), webhook/n8n, laporan harian otomatis ke WhatsApp | Diferensiasi premium |
| Terus | Kualitas | Uji perangkat fisik, telemetry opt-in, mode gelap, i18n | Retensi |
