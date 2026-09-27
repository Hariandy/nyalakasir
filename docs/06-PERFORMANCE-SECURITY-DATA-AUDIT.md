# 06 — Performance, Security & Data Integrity Audit

## A. Performance (Chromium, CPU throttling 4× ≈ HP Android kelas menengah)
| Metrik | Hasil |
|---|---|
| Ukuran rilis | `index.html` 263 KB (termasuk 3 foto demo ±23 KB); tanpa request eksternal |
| Tambah item ke keranjang | **5,6 ms** rata-rata (update DOM terarah, tanpa render ulang grid) |
| Laporan 30 hari berisi 6.000 transaksi | **~300 ms** (query indeks `day` IndexedDB) |
| DOM layar Laporan | ±720 node (riwayat dipaginasi 40, +60 per ketuk) |
| Heap JS | ±10 MB dengan 200 produk + 6.000 transaksi |
| Gambar | produk ≤60 KB/480 px, dirender via `blob:` URL (bukan string base64 di DOM) |
| Pencarian | debounce 90 ms, hanya grid yang diperbarui |
| Listener | satu listener terdelegasi per jenis event (tidak ada duplikasi/kebocoran) |

## B. Security
| Area | Status |
|---|---|
| XSS | Semua teks pengguna lewat `esc()`; uji SEC-01 (nama produk berisi `<img onerror>`) tidak tereksekusi |
| CSP | `default-src 'self'`, tanpa `unsafe-eval` (terbukti memblokir eval), `object-src 'none'`, `form-action 'none'` |
| Tidak ada `eval`/`new Function` | ✔ |
| Import cadangan | Divalidasi skema; teks dibersihkan; gambar hanya `data:image/(jpeg|png|webp)` ≤2 MB; ukuran file ≤80 MB |
| CSV injection | Sel diawali `= + - @` diberi prefiks `'` |
| Upload foto | MIME whitelist, ≤12 MB, dikompres ulang lewat canvas (metadata EXIF/GPS ikut terbuang) |
| PIN | PBKDF2-SHA256 120.000 iterasi + salt acak; tidak pernah disimpan teks |
| Lisensi | ECDSA P-256; payload yang diubah/kunci palsu ditolak (L-01); jam mundur dideteksi (`lastSeen`) |
| Header hosting | `_headers`/`vercel.json`: nosniff, X-Frame-Options DENY, no-referrer, Permissions-Policy |
| Privasi | Tidak ada analitik, tidak ada pengiriman data ke server |
**Batasan jujur:** aplikasi client-side selalu bisa dimodifikasi oleh orang yang paham teknis (mis. mengubah kode untuk melewati lisensi). Lisensi melindungi dari berbagi kode/klaim gratis biasa, bukan dari peretas. Kunci privat **tidak boleh** ikut di-hosting.

## C. Data integrity
| Area | Status |
|---|---|
| Penyimpanan | IndexedDB (fallback localStorage + peringatan jelas) |
| Atomik | Transaksi, stok, log stok, nomor antrean, keranjang kosong ditulis dalam **satu** transaksi IndexedDB; UI sukses hanya setelah tersimpan |
| Duplikasi | Guard `checkoutBusy` (F-18: double-tap = 1 transaksi); ID transaksi = waktu + acak kriptografis |
| Snapshot | Item, harga, HPP, nama toko disimpan di transaksi (edit produk tidak mengubah riwayat) |
| Void | Tidak menghapus; menandai `void` + alasan + waktu; stok dikembalikan atomik |
| Log stok | Append-only (penjualan, batal, pembelian, opname, edit, stok awal) |
| Skema & migrasi | `schema: 3`; migrasi otomatis V12/V13 (M-01) tanpa menghapus kunci lama |
| Backup/restore | JSON lengkap (termasuk foto & log); bisa dibagikan ke Drive/WhatsApp; restore memvalidasi & membuat cadangan otomatis dulu; pengingat mingguan |
| Korupsi | Data rusak disanitasi (ID ganda, resep ke bahan yang hilang, angka non-finite); tidak pernah "reset" diam-diam |
| Penyimpanan permanen | `navigator.storage.persist()` diminta setelah transaksi pertama/pemasangan |
| Pembulatan | Half-up sekali di akhir; uang selalu bilangan bulat Rupiah; qty presisi 6 desimal |
