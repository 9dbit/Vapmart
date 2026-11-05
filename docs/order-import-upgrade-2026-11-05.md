# Vapmart — Upgrade Pesanan, Invoice, dan Impor

Tanggal: 5 November 2026 (WIB).

Branch lokal: `feat/order-import-upgrade-20261105`.

Baseline: `b723b9f7f888a187115e8d8e040d19126ff57021`.

Status: implementasi lokal; belum diunggah ke GitHub atau dirilis ke Railway.

## Perubahan

| Area | Implementasi |
| --- | --- |
| Impor | Template lengkap deskripsi, berat gram, dimensi cm; parser bersama untuk pembacaan kolom dan preview; UTF-8/BOM, koma, titik koma, tab, kutip CSV dan tanda inci. Error menyebut lokasi dan petunjuk perbaikan. |
| Pesanan | Sembilan status operasional, filter, badge, tautan detail, ringkasan kurir/resi, status pembayaran, dan tanggal WIB. |
| Editor | Penerima/alamat, barang/SKU, jumlah, harga satuan, voucher dan biaya bernama. Preview sebelum/sesudah dihitung server sebelum konfirmasi simpan. |
| Konsistensi | Transaksi database, konflik versi, validasi ulang stok/promo, quote ongkir terikat pesanan dan isi edit, serta audit pelaku/alasan/nilai sebelum-sesudah. |
| Invoice | Nomor tetap dan unik, snapshot per versi, riwayat revisi, status pembayaran, preview, cetak A4/simpan PDF. Akses admin tetap diwajibkan. |
| Fulfillment | On hold memblokir pemrosesan baru. Pesanan yang pernah processing atau memiliki fulfillment tetap terkunci meski status diubah. |
| Tracking | Semua pengiriman aktif harus delivered sebelum otomatis Selesai. Webhook berulang tidak menggandakan audit penyelesaian atau gerakan stok. |

Status operasional: Draft, Pending payment, Processing, Selesai, On hold, Cancelled, Refunded, Failed, Pre-order.

Pembayaran dan refund tetap membutuhkan bukti server. Dropdown status tidak menciptakan pembayaran/refund. Editor versi ini mengunci seluruh perubahan pada pesanan paid/refunded, termasuk pesanan paid yang sedang on hold. Koreksi pesanan berbayar memerlukan penanganan rekonsiliasi terpisah. Pesanan yang telah masuk gudang tidak dibuka kembali untuk edit.

Pembatalan sebelum picking memeriksa reservasi. Pembatalan pesanan berbayar mempertahankan reservasi sampai refund terverifikasi; pelepasan setelah verifikasi tersedia melalui alur fulfillment. Pesanan dengan packing, booking, atau carrier aktif harus diselesaikan melalui alur kurir/retur terlebih dahulu. Pengembalian barang dan refund dana tetap terpisah.

## Migrasi

Migrasi tambahan `025_order_management.sql` menambahkan baseline order/item privat, status operasional, hold, versi, waktu pertama processing, biaya tambahan, nomor invoice, riwayat, snapshot invoice, dan binding quote pengiriman. Trigger menjaga kompatibilitas pembaca status/payment lama. Tabel baru memakai RLS. Migrasi lama tidak diubah.

Runner migrasi dijalankan dua kali untuk memeriksa checksum dan skip migrasi yang sudah diterapkan. Snapshot baseline membantu pemeriksaan, tetapi tidak menggantikan backup database sebelum rilis.

## Verifikasi lokal

| Pemeriksaan | Hasil |
| --- | --- |
| Build API TypeScript | Lulus |
| Build web Next.js dan pemeriksaan tipe | Lulus |
| Unit test API | 79/79 lulus |
| Migrasi dua kali | Lulus pada database lokal terpisah |
| Integrasi order management | Lulus: otorisasi, dua simpan bersamaan (200/409), voucher/biaya/harga, invoice lama tetap utuh, quote terikat edit, payment hold, processing lock, refund/stok, multi-paket, kill switch |
| Integrasi checkout conversion | Lulus: voucher, transfer bank pending, daftar admin, stok dan dimensi |
| Integrasi Jubelio dispatch | Lulus dengan adapter simulasi: booking, pickup, recovery, webhook, ownership, stok sekali saja |
| Integrasi courier orchestration | Lulus: manifest, tracking, handover, retur dan restock |
| Browser desktop 1440 px dan mobile 390 px | Lulus: edit/simpan, perubahan status, invoice, template unduhan dan preview CSV tanda inci; tanpa runtime error |
| PDF invoice | Lulus: satu item satu halaman tanpa halaman kosong; 25 item beberapa halaman, seluruh baris dan total terbaca |

Database lokal menggunakan PGlite dengan protokol PostgreSQL, data sintetis, dan fixture API admin/customer. Ini tidak menggantikan pengujian locking dan migrasi pada PostgreSQL 16 native. Workflow `.github/workflows/order-upgrade.yml` telah disiapkan untuk pemeriksaan tersebut tetapi **belum dijalankan** karena source belum diunggah.

Uji provider menggunakan simulasi; tidak membuat booking atau pickup operasional. Tidak ada perubahan order, stok, pembayaran, atau database produksi selama pekerjaan ini. CSV asli pengguna belum tersedia; penyebab pada file asli belum dikonfirmasi baris per baris.

## Konfigurasi

- `ORDER_MANAGEMENT_ENABLED=false` menghentikan edit, perubahan status, dan pembuatan quote admin; pembacaan dan invoice tetap tersedia. Default aktif setelah API baru dipasang. Flag ini tidak menghentikan tracking fisik kurir.
- `INVOICE_STORE_NAME` default Vapmart.
- `INVOICE_STORE_ADDRESS`, `INVOICE_STORE_EMAIL`, `INVOICE_STORE_PHONE` memakai data toko yang benar; email dapat memakai `SHIPPING_SENDER_EMAIL`. Data yang belum ada diberi keterangan pada invoice.
- Snapshot invoice mempertahankan identitas toko saat dibuat. Lengkapi identitas sebelum menerbitkan invoice operasional pertama.
- Konfigurasi checkout dan payment tidak diaktifkan oleh upgrade ini.

## Rilis setelah publikasi diizinkan

1. Unggah branch ke `9dbit/Vapmart`; jalankan workflow baru pada commit yang sama dan periksa semua job beserta bukti browser/PDF.
2. Pastikan backup database tersedia, simpan SHA aplikasi sebelumnya, dan periksa perubahan source/deployment lain yang perlu digabung.
3. Lakukan smoke test migrasi pada PostgreSQL 16; verifikasi pembaca versi pemulihan masih dapat membaca data tambahan.
4. Rilis API dengan pre-deploy `npm run migrate`; tunggu readiness dan periksa log migrasi, lalu rilis web dari commit yang sama.
5. Verifikasi admin, customer orders, import preview, editor, invoice, dan endpoint tracking. Gunakan fixture/sandbox untuk operasi kurir; periksa pesanan operasional secara read-only.
6. Catat SHA, ID deployment, hasil health/readiness, dan smoke test sebelum menyatakan live.

Environment Railway bernama `staging` yang melayani domain publik diperlakukan sebagai produksi. Jangan gunakan environment tersebut untuk data QA sintetis.

## Pemulihan

Jika editor bermasalah, set `ORDER_MANAGEMENT_ENABLED=false`, deploy API, dan verifikasi operasi tulis menolak dengan 503. Jika perlu pemulihan aplikasi penuh, kembalikan API/web ke baseline setelah memeriksa kompatibilitas reader dan job yang sedang berjalan. Simpan kolom/tabel tambahan, audit, invoice, serta data pesanan baru; jangan drop migrasi atau memutar balik stok/uang melalui SQL ad hoc. Pemulihan aplikasi tidak membatalkan pengiriman yang sudah tercipta.

## Yang masih tertahan

Pengunggahan source ke GitHub ditolak oleh pemeriksaan persetujuan otomatis karena izin mengirim source ke tujuan `9dbit/Vapmart` dinilai belum eksplisit untuk tindakan ini. Tidak dilakukan retry melalui jalur lain. Publikasi branch, CI native PostgreSQL, dan deployment Railway memerlukan persetujuan publikasi tersebut. Belum ada klaim upgrade live.
