# 07 — Deployment Readiness, Release & Operations

Status: **PRODUCTION CANDIDATE (1.3.0-rc.2)** (menunggu persetujuan pemilik produk). Claude tidak menyatakan APPROVED/LOCKED.

## Checklist sebelum publikasi
| # | Item | Status |
|---|---|---|
| 1 | Build `dist/` lolos `node --check` & 138/138 uji otomatis (termasuk upgrade RC1/RC2/RC3→1.3) + sinkronisasi 10/10 (`qa/test_sync.py`) | ✅ |
| 2 | Isi `APP.supportWa` (nomor WA admin, format `628…`) **atau** `APP.buyUrl` (link Mayar/Lynk) di `source/src/01-core.js`, lalu `python3 source/build/build.py` | ⏳ Pemilik |
| 3 | Cek merek "Nyala Kasir" di PDKI; bila bentrok, ganti `APP.name/short` + `short_name` manifest | ⏳ Pemilik |
| 4 | Uji di 1–2 HP Android fisik (Chrome): pasang ke layar utama, 10 transaksi, cetak struk (RawBT/printer), backup & restore | ⏳ Pemilik |
| 5 | Hosting HTTPS (wajib untuk PWA, PIN, lisensi) | ⏳ Pemilik |
| 6 | Simpan **Seller Kit** (kunci privat) di tempat aman + cadangan offline. **Jangan** unggah ke hosting/Git publik | ⏳ Pemilik |
| 7 | Halaman kebijakan privasi & syarat lisensi (template di dokumen 11) | ⏳ Pemilik |

## Cara hosting (gratis, cukup folder `app/`)
Isi folder `app/` = `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`, `_headers`, `netlify.toml`, `vercel.json`, `robots.txt`. **Paket rilis ini JUGA punya `netlify.toml` di akar folder (sejajar dengan `app/`, `docs/`, `source/`)** — kalau Anda menghubungkan seluruh repo (bukan hanya isi `app/`) ke Netlify lewat GitHub, file akar ini otomatis memberi tahu Netlify untuk memublikasikan folder `app/`. Tanpa file ini, aplikasi bisa terbuka sebagai halaman web tapi **tidak bisa dipasang (Install)** sebagai aplikasi — lihat dokumen 08 §1.3.0-rc.2.
- **Netlify — unggah manual:** app.netlify.com → Add new site → Deploy manually → seret folder `app/` → pasang domain.
- **Netlify — lewat GitHub:** hubungkan **seluruh repo** paket ini apa adanya (berkat `netlify.toml` di akar, Netlify otomatis memublikasikan folder `app/` — tidak perlu mengisi Publish directory manual). Situs yang SUDAH terlanjur salah: Site settings → Build & deploy → Publish directory → ketik `app` → Save → Clear cache and deploy site.
- **Cloudflare Pages:** Workers & Pages → Create → Pages → hubungkan repo → isi **Build output directory** = `app` (atau Upload assets manual dari isi folder `app/`).
- **GitHub Pages (bisa dari HP):** GitHub Pages tidak bisa diarahkan ke sub-folder sembarang seperti `app/` — buat repo **khusus berisi ISI folder `app/` saja** (bukan seluruh paket rilis ini), lalu Settings → Pages → Deploy from branch `main` / root.
- **Vercel:** import repo → isi **Root Directory** = `app` di pengaturan proyek.
Domain disarankan: subdomain sendiri, mis. `kasir.namabrand.id` (Rp ±150–250 rb/tahun).

## Versi & rilis
- Versi di `APP.version` (SemVer) + `APP.build`. Service worker memakai `version-hash` otomatis dari build → cache lama dibersihkan saat aktif.
- **Update strategy:** navigasi network-first (timeout 3,5 dtk → cache). Versi baru terpasang di latar; pengguna melihat banner "Versi baru siap — Muat ulang" (tidak pernah reload paksa di tengah transaksi).
- **Rilis:** ubah versi → build → uji (`python3 qa/test_rc.py` dengan server lokal di `dist/`) → unggah `dist/` → cek banner update di HP uji.

## Rollback
1. Simpan setiap rilis sebagai zip bernomor (`nyala-1.0.0-rc.1.zip`, …).
2. Rollback = unggah ulang folder rilis sebelumnya. Data pengguna tidak terpengaruh (ada di perangkat mereka).
3. Aturan: jangan menurunkan `APP.schema`. Bila rilis baru menaikkan skema, rilis rollback wajib tetap bisa membaca skema baru (atau tahan rollback).

## Backup (untuk pengguna)
- Pengaturan → Buat cadangan → file JSON → simpan ke Google Drive / WhatsApp "Pesan ke diri sendiri".
- Aplikasi mengingatkan bila >7 hari belum backup (titik oranye di menu Pengaturan + kartu di Laporan).
- Pindah HP: pasang app di HP baru → layar sambutan → "Pulihkan dari cadangan" → masukkan kode lisensi yang sama.

## Monitoring & dukungan (tanpa server)
- Log kesalahan lokal (30 terakhir): Pengaturan → Tentang & diagnostik → **Salin log** → pelanggan kirim via WhatsApp.
- Layar pemulihan saat gagal boot menyediakan **Unduh data darurat** (IndexedDB + kunci lama).
- Saat nanti ada backend: tambahkan pelaporan error opt-in (mis. Sentry) — belum dipasang karena CSP & privasi.

## Keterbatasan hosting yang perlu diketahui
- Data per perangkat & per browser. Membuka app di Chrome lalu di Samsung Internet = dua data terpisah.
- "Hapus data situs" di pengaturan browser menghapus data → edukasi backup.

## Catatan upgrade 1.0 → 1.1
Pengguna RC1 cukup membuka aplikasi seperti biasa: database otomatis ditingkatkan (IndexedDB v1→v2, schema 3→4) tanpa menghapus data, keranjang, atau transaksi (uji UPG-01). Varian contoh tidak ditambahkan ke katalog lama — pengguna membuatnya di Menu → Varian.
