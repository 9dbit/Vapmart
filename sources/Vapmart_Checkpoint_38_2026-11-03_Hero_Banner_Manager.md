# Vapmart CP38: Hero Banner Manager

Tanggal: 3 November 2026, Asia/Jakarta.
Status: DEPLOYED; pengujian pra-rilis dan pascarilis LULUS.

## Rilis yang terverifikasi
Repository: 9dbit/Vapmart. Branch rilis: release/vapmart-stable.
Kedua aplikasi live dikunci ke commit `af47f967f5e32a8508ee274edc2de47237792bb6`.
Branch rilis juga menyimpan tindak lanjut pengujian dan dokumentasi; commit aplikasi live tidak berubah oleh pembaruan dokumentasi.

| Layanan | Status teramati | Deployment ID | Waktu SUCCESS |
| --- | --- | --- | --- |
| vapmart-api | SUCCESS / online | 1141356d-da71-4783-9580-3d87259a90a4 | 2026-11-03 14:44:05 WIB |
| vapmart-web | SUCCESS / online | f50da9bf-9e90-45c8-9834-7c16c9d514ad | 2026-11-03 14:46:21 WIB |
| Postgres | SUCCESS / online | 19ee1b92-92d7-42c9-a7fc-6cb676bcfa21 | Deployment database tetap |

Railway project: 7c01e4d8-6152-4f04-9750-6e7031aa0830. Environment yang melayani domain publik masih bernama staging: 04586a07-99b0-4cfd-95fa-bb6d8f1719e3.
Pemeriksaan kesehatan menunjukkan tiga layanan online, masing-masing satu replica berjalan, tanpa crashed replica, warning atau critical pada pemeriksaan tersebut. Tidak ada patch Railway lama yang diterapkan.

## Akses dan fitur
Akses: https://vapmart.id/admin/banners. Masuk sebagai administrator, lalu buka Media & Aset > Hero Banner.

- Tambah pasangan gambar desktop/mobile, isi nama dan teks alternatif, lihat preview, lalu Simpan draft.
- Aktifkan dilakukan terpisah dengan konfirmasi. Draft belum tampil di homepage.
- Edit mengganti gambar atau teks. Menyimpan perubahan pada banner aktif memperbarui tampilan pada pemuatan homepage berikutnya.
- Panah naik/turun menyimpan urutan banner.
- Nonaktifkan menyembunyikan banner tanpa memindahkannya ke Sampah.
- Hapus meminta konfirmasi dan memindahkan banner ke Sampah; file original tidak dihapus permanen.
- Pulihkan sebagai draft mengembalikan banner dalam keadaan nonaktif.
- Jika tidak ada banner aktif, area hero disembunyikan tanpa memunculkan ulang banner lama. Satu banner tidak menampilkan kontrol carousel; beberapa banner memakai carousel existing.

Perubahan konten tersimpan di PostgreSQL dan tidak membutuhkan deploy kode berikutnya. Homepage yang sudah terbuka perlu dimuat ulang untuk mengambil versi terbaru. Tampilan storefront dan identitas visual existing dipertahankan.

## Gambar, batas dan penyimpanan
Format: PNG, JPG/JPEG, WebP statis. Maksimal 5 MiB per file. Rekomendasi bidang existing: desktop 1024 x 320 px, mobile 1024 x 448 px.
Validasi server: minimal 64 px per sisi, maksimal 8192 px per sisi dan 16 megapiksel. SVG, gambar animasi, MIME palsu, payload terlalu besar dan file gagal decode ditolak.
Sharp 0.35.3 dikunci dalam package.json dan lockfile. Gambar didecode, orientasi diterapkan, metadata dibuang dari versi tampil, dan derivative WebP dibuat. Original upload tetap tersimpan privat dengan checksum.
Maksimal 30 banner di luar Sampah, 60 upload baru per administrator per jam, dan kuota penyimpanan banner 512 MiB. Hapus bersifat soft-delete, bukan pembebasan storage otomatis.

Migration `016_hero_banners.sql` menambahkan tabel content terpisah untuk banner, gambar, revision dan audit. Log API pada 2026-11-03T07:43:54.844697581Z mengonfirmasi migrasi ini terpasang serta 59 original media terverifikasi, tanpa menambah atau mengganti original tersebut.
Tiga slide referensi existing diinisialisasi sekali dengan path desktop/mobile aslinya. Migrasi ulang tidak mengaktifkan kembali banner yang sudah dinonaktifkan atau dihapus. File legacy statis tetap dipertahankan; menghapus banner menghapus penampilannya, bukan menghapus file legacy dari server.

## Otorisasi dan integritas
AdminGuard dan validasi Supabase existing digunakan tanpa perubahan. Mutasi memerlukan administrator terverifikasi, bukan sekadar kontrol UI.
Edit menggunakan expectedVersion; perubahan bersamaan ditolak dengan HTTP 409 dan input form yang belum disimpan dipertahankan. Reorder memerlukan revision daftar dan seluruh ID yang relevan. Mutasi dan audit disimpan secara transaksional. Request create memiliki idempotency key.
Original upload tidak disajikan oleh endpoint publik. Endpoint gambar publik hanya memberikan derivative yang masih dipakai oleh banner aktif dan tidak berada di Sampah. Data privat dan respons banner memakai no-store. Tidak ada input URL gambar eksternal atau panggilan provider dari fitur ini.

## Bukti pengujian pra-rilis
Run GitHub Actions `41597783972`, job `125789099828`: SUCCESS pada exact SHA aplikasi.
Lulus: clean dependency installation, build API, 53 unit test, migrasi dua kali pada PostgreSQL sementara, pengujian HTTP lifecycle, regresi integritas CP37A, warehouse/fulfillment/courier, build produksi Web, dan browser full-stack lokal.
Lifecycle mencakup upload, deduplikasi, draft, aktivasi, edit, pengurutan, version/revision conflict, nonaktif, konfirmasi hapus, restore sebagai draft, zero/single banner, error/retry dan pelestarian original. Pengujian migrasi ulang membuktikan banner nonaktif tidak dimunculkan kembali.
Browser menggunakan API dan PostgreSQL localhost nyata dengan identitas uji terisolasi. Guard fixture menolak database selain nama CP38 pada 127.0.0.1. Tidak ada kredensial administrator produksi atau route fixture yang dikirim dalam aplikasi.
Source autentikasi, shipping, warehouse, fulfillment dan file aset original diperiksa tidak berubah dibanding CP37A.

## Bukti pengujian pascarilis
Run awal `41598580627`, job `125791660359`: SUCCESS.
Run final `41598910417`, job `125792727551`: SUCCESS, termasuk pemeriksaan decode gambar sebelum screenshot desktop/mobile. Perbaikan capture ini tidak mengubah aplikasi live.
Read-only report final: 2026-11-03T07:50:24.819Z, setara 14:50:24 WIB.

| Pemeriksaan | Hasil |
| --- | --- |
| Daftar hero API dan proxy web | HTTP 200, identik, tiga banner existing |
| Homepage dan enam file desktop/mobile existing | Tersedia; struktur carousel dipertahankan |
| API admin hero dan gambar privat tanpa login | HTTP 401 di API dan domain publik |
| Token tidak valid / ID gambar publik tidak ada | HTTP 401 / 404 |
| Pengunjung anonim /admin/banners | Dialihkan ke /admin, tidak melihat manager |
| Navigasi Media & Aset > Hero Banner | Lulus dengan identitas browser fixture |
| Screenshot desktop dan mobile | Tiga thumbnail selesai decode pada masing-masing tampilan |
| Mobile 390 px | scrollWidth 390, tanpa overflow horizontal |
| Smoke dan theme existing | Lulus, termasuk homepage, admin entry, light/dark/system |
| Pembayaran / booking kurir / pencarian tarif | Seluruhnya false |

Batas bukti: mutasi end-to-end diuji pada database sementara. Pemeriksaan domain live berupa public reads, penolakan otorisasi dan UI dengan identitas/data admin yang diintersep. Tidak ada login atau upload oleh akun admin asli yang diklaim sebagai UAT. Tidak ada authorized live banner, produk, stock, order, saldo atau transaksi yang dimutasi oleh QA. Fixture UI live mencatat mutations=0.

## Artefak
Pra-rilis: artifact `13213295335`, cp38-hero-verification, SHA-256 `8e0a47659e71254b347f5da28743a1915e56c17333d76c8dddad05d4a4a079ce`.
Pascarilis final: artifact `13214066163`, cp38-live-verification, SHA-256 `e7f310f0f34b7aebd620b638a247d1d7f2fcb30fff428522718267a6b87b8313`.
Kedua ZIP diunduh dan digest diverifikasi. Screenshot diperiksa secara visual. Screenshot admin memakai fixture, bukan sesi administrator asli.
Pra-rilis: https://github.com/9dbit/Vapmart/actions/runs/41597783972
Pascarilis final: https://github.com/9dbit/Vapmart/actions/runs/41598910417

## Batas scope dan rollback
Pembayaran, booking kurir dan rate lookup tetap OFF. Tidak ada perubahan DNS, email, secret provider, publikasi produk atau merge PR #1/main.
Rollback aplikasi tersedia ke commit CP37A `ca57e59ab6450ab45e11e4821574bfedee9369e3`. Pertahankan migrasi additive 016 dan data upload; jangan menghapus database untuk membatalkan kode.
Lanjutkan pengembangan dari checkpoint ini. Live tetap pinned ke SHA aplikasi terverifikasi; perubahan source berikutnya harus melewati pengujian sebelum pin diganti.
