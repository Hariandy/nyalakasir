# 14 — Panduan Deploy: GitHub → Netlify → Install App (langkah pasti)

Ikuti persis urutan ini. Paket yang dipakai: **isi lengkap zip rilis ini** (`Nyala-Kasir-v1.3.0-rc.2-release.zip` atau lebih baru) — bukan cuma folder `app/`.

## Bagian A — Upload ke GitHub
1. Ekstrak zip rilis di komputer/HP Anda. Hasilnya harus berupa folder berisi: `app/`, `docs/`, `source/`, `versions/`, `netlify.toml`, `README.md`, `HANDOFF-NEXT.md` — **sejajar**, bukan bertumpuk di dalam folder lain.
2. Buka **github.com** → login → tombol **+** (kanan atas) → **New repository**.
3. Beri nama (mis. `nyala-kasir-toko-saya`) → **Public** atau **Private** (bebas, Netlify bisa akses keduanya) → **Create repository**.
4. Di halaman repo kosong → klik **uploading an existing file** (atau *Add file → Upload files*).
5. Seret **semua isi** folder hasil ekstrak (bukan folder zip-nya, isinya) ke kotak upload — pastikan `netlify.toml` dan folder `app` ikut ter-upload di level paling atas.
6. Scroll ke bawah → **Commit changes**.
7. ✅ Cek: buka repo, di daftar file paling atas harus ada `netlify.toml` dan folder `app` sejajar (bukan `nama-repo/app/netlify.toml` — harus `netlify.toml` langsung terlihat di root).

## Bagian B — Sambungkan ke Netlify
8. Buka **app.netlify.com** → login (bisa pakai akun GitHub yang sama) → **Add new site → Import an existing project**.
9. Pilih **Deploy with GitHub** → izinkan akses → pilih repo yang baru dibuat.
10. Di halaman **Site settings** sebelum deploy:
    - **Base directory**: kosongkan.
    - **Build command**: kosongkan.
    - **Publish directory**: ketik manual **`app`** (walau `netlify.toml` seharusnya otomatis mengisi ini, mengetiknya manual sekali di awal memastikan 100% benar sejak deploy pertama).
11. Klik **Deploy site**. Tunggu status berubah dari "Building" → **"Published"** (biasanya <1 menit, situs ini tanpa proses build).
12. Anda akan dapat URL seperti `https://nama-acak-123.netlify.app`. Opsional: **Site settings → Domain management → Options → Edit site name** untuk mengganti jadi nama yang lebih rapi.

## Bagian C — Verifikasi sebelum coba install (jangan dilewati)
13. Buka `https://situs-anda.netlify.app/manifest.webmanifest` di browser — harus tampil teks JSON (`{"id": ".", "name": "Nyala Kasir", ...}`), **bukan** halaman 404 atau file kosong.
14. Buka `https://situs-anda.netlify.app/sw.js` — harus tampil kode JavaScript, bukan 404.
15. Kalau salah satu di atas 404: kembali ke langkah 10 → **Site settings → Build & deploy → Publish directory** → pastikan isinya persis `app` → **Save** → tombol **Trigger deploy → Clear cache and deploy site**. Ulangi langkah 13–14.

## Bagian D — Install lewat browser (Android/Chrome)
16. Buka `https://situs-anda.netlify.app` di **Chrome Android** (bukan browser dalam-app seperti WhatsApp/Instagram — itu tidak bisa install PWA).
17. Selesaikan pendaftaran usaha singkat (nama toko, jenis usaha) sampai layar Kasir muncul.
18. Tunggu sekitar 10–15 detik memakai aplikasi (buka menu, dsb) — Chrome butuh sedikit interaksi sebelum menawarkan instalasi.
19. Tanda **berhasil** (bukan sekadar bookmark):
    - Muncul **banner/pop-up "Tambahkan Nyala Kasir ke layar Utama"** dengan ikon aplikasi, **atau**
    - Menu titik tiga (⋮) Chrome menampilkan **"Install app"** / **"Pasang aplikasi"** (bukan cuma "Tambahkan ke layar Utama" versi bookmark biasa — bedanya: hasil install App muncul di app drawer HP seperti aplikasi asli, tanpa bilah alamat browser).
    - Di dalam app: **Pengaturan → Aplikasi → "Pasang di layar utama"** juga bisa dipakai sebagai tombol cepat kalau `beforeinstallprompt` sudah tertangkap.
20. Ketuk **Install/Pasang** → ikon Nyala Kasir muncul di layar utama → buka dari sana: tampil **tanpa bilah alamat browser** = berhasil 100%.

## Kalau masih gagal — checklist troubleshooting
| Gejala | Penyebab paling mungkin | Solusi |
|---|---|---|
| `manifest.webmanifest` 404 | Publish directory bukan `app`, atau `netlify.toml` tidak ikut ter-upload di root | Ulangi langkah 10 & 15 |
| Situs tampil tapi isinya daftar file/README, bukan aplikasi | Publish directory kosong/salah (Netlify mempublikasikan root repo) | Sama seperti di atas |
| Manifest & sw.js OK (langkah 13–14 lolos) tapi tetap tidak ada tawaran install | Browser bukan Chrome Android, atau dibuka dari dalam app chat (WA/IG), atau situs belum HTTPS (Netlify otomatis HTTPS — tunggu 1–2 menit setelah deploy pertama) | Buka manual di Chrome, tunggu, coba lagi |
| Sudah pernah dibuka sebelum perbaikan ini | Service worker versi lama masih ter-cache di HP | Di Chrome: ⋮ → Info situs → Hapus data situs, lalu buka ulang |

## Setelah berhasil install
- Isi nomor WhatsApp admin (`supportWa`) di pengaturan build (`source/src/01-core.js`) sebelum benar-benar berjualan, supaya tombol "Beli" di aplikasi berfungsi — lihat dokumen 07.
- Update berikutnya: build ulang → upload file yang berubah ke repo GitHub yang sama (**commit**) → Netlify otomatis deploy ulang dalam hitungan detik. Tidak perlu ulang dari Bagian A.
