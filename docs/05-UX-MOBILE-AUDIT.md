# 05 — UX / Mobile-First Audit

Uji otomatis di 320, 360, 375, 390, 412 px (MOB-320…MOB-412): **0 overflow horizontal**, tombol Bayar tidak tertutup navigasi, tombol "Proses Pembayaran" selalu terlihat, target sentuh ≥ 36 px (umumnya 44–56 px).

## Prinsip yang diterapkan
| Prinsip | Implementasi |
|---|---|
| Satu tangan | Semua aksi utama di sepertiga bawah: bar keranjang, tombol Bayar, footer sheet (sticky), navigasi bawah. Bottom-sheet, bukan modal tengah. |
| Cepat | Tambah item 1 ketuk (5,6 ms @ CPU 4× lebih lambat); "Uang Pas" sudah terisi; 6 tombol uang cepat; Transaksi Baru 1 ketuk. |
| Tidak kaku / terasa hidup | Badge qty "bump", getar halus, bunyi "ting" saat bayar, centang animasi, nomor antrean besar, kartu margin berwarna, saran harga. `prefers-reduced-motion` dihormati. |
| Ramah | Bahasa manusia ("Uang kurang", "Laba per penjualan"), sapaan onboarding 3 langkah, empty state dengan tombol aksi, panduan 1 menit, pesan error yang menjelaskan langkah berikutnya. |
| Premium | Palet navy + emerald V12 dipertahankan, sudut 15–28 px, bayangan lembut, tipografi tabular untuk angka, ikon garis konsisten. |
| Keyboard | Input uang `inputmode=numeric` + format ribuan saat mengetik; qty `inputmode=decimal`; font 16 px (tanpa auto-zoom iOS); `interactive-widget=resizes-content` agar footer sheet naik di atas keyboard. |
| Safe area | `env(safe-area-inset-*)` di header, nav, sheet footer, toast. |
| Back Android | Menutup sheet → lalu kembali ke Kasir → baru keluar app. |
| Aksesibilitas | Zoom diizinkan, `aria-label` pada tombol ikon, `role=dialog`, fokus terlihat, teks utama gelap di atas latar terang (kontras tinggi). |

## Layar & keputusan
- **Kasir:** header ringkas (logo/nama, mode, status paket), cari + kategori (chip scroll), grid 2 kolom (3 kolom ≥520 px), label stok "Sisa 3/Habis", chip pesanan tersimpan, notifikasi stok menipis.
- **Pembayaran:** tata letak V12 yang disetujui dipertahankan (total besar, 4 metode 2×2, kotak uang diterima, kembalian). Tambahan: rincian diskon/pajak, gambar QRIS toko, info rekening transfer.
- **Sukses:** tombol Cetak/WhatsApp/Bagikan di atas struk (terjangkau jempol), Transaksi Baru di footer.
- **Laporan:** hero laba kotor ala V12 + periode; kartu metode bayar, terlaris, grafik harian, jam ramai.
- **Katalog:** kartu dengan chip margin (hijau ≥50%, kuning 30–49%, merah <30%); form produk dengan meter margin & "Harga saran" 40/50/60/70%.

## Sisa catatan UX (tidak memblokir rilis)
- Pengujian di perangkat Android fisik (Chrome, Gboard) tetap disarankan sebelum publikasi — uji otomatis memakai emulasi.
- Mode gelap belum tersedia (POS dipakai di area terang; masuk roadmap).

## Tambahan v1.1 (terasa hidup, tetap cepat)
- **Menu dengan varian = 1 ketuk tambahan:** picker bottom-sheet dengan pilihan default sudah terpilih (Regular, Normal) → cukup "Tambah". Harga & margin berubah langsung saat memilih.
- **Sapaan** sesuai jam & nama pemilik, **titik hidup** saat shift berjalan, **cincin target** yang terisi setiap transaksi dan **confetti** saat target tercapai (menghormati *reduced motion*).
- **Layar pelanggan**: tombol di sheet bayar & sukses; tampilan gelap kontras tinggi dengan total besar & QRIS; ketuk di mana saja untuk kembali.
- **Asisten Untung** berupa kartu dengan garis warna tingkat (hijau/kuning/merah/biru) + tombol aksi langsung (Ubah harga, Tambah stok, Atur target).
- **Tutup kasir** dengan penghitung per pecahan (100 rb … Rp100) memakai tombol ± besar — cocok untuk satu tangan.
- Perbaikan: sheet tidak lagi beranimasi ulang setiap isinya berubah (lebih tenang & terasa premium).
- Uji otomatis 320–412 px tetap 0 overflow setelah header diberi cincin target.

## Tambahan v1.2
- **Mode gelap** penuh (token warna + override komponen), otomatis mengikuti HP; diuji di 320 px.
- **Kontras AA**: teks bantu 4,9:1, harga 4,7:1, tombol Bayar ≥4,5:1 (sebelumnya 2,2–3,5:1).
- **Checklist siap jualan** dibuat ringkas (1 baris chip geser) agar menu tetap terlihat di layar kecil.
- **Banner Happy Hour** di Kasir memberi tahu kasir promo yang sedang berjalan tanpa perlu menghafal.
- Form tidak lagi kehilangan isian saat memilih opsi (pajak/pembulatan, stok masuk, promo).
