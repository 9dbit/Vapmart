# Vapmart CP39: Product Engine

Tanggal: 3 November 2026, Asia/Jakarta.
Status: DEPLOYED. Pengujian pra-rilis exact source dan pengujian pascarilis LULUS.

## Rilis terverifikasi

Repository: 9dbit/Vapmart. Branch rilis: release/vapmart-stable.
Kedua aplikasi live dikunci ke commit `a52c1c4e70080c8ef25e58e4d6792d239618ee54`.
Branch rilis juga menyimpan tindak lanjut QA dan dokumentasi. Perubahan tersebut tidak mengganti commit aplikasi yang berjalan.

| Layanan | Status teramati | Deployment ID | Waktu SUCCESS |
| --- | --- | --- | --- |
| vapmart-api | SUCCESS / online | c1c93e8f-f266-47f9-a00f-a0f526257ac6 | 3 November 2026, 18:37:31 WIB |
| vapmart-web | SUCCESS / online | 95c800ee-03b8-4774-8eb7-2a1847899492 | 3 November 2026, 18:40:40 WIB |
| Postgres | SUCCESS / online | 19ee1b92-92d7-42c9-a7fc-6cb676bcfa21 | Deployment database tetap |

Project Railway: 7c01e4d8-6152-4f04-9750-6e7031aa0830.
Environment yang melayani domain publik masih bernama staging: 04586a07-99b0-4cfd-95fa-bb6d8f1719e3.
Read-back source API dan Web mengonfirmasi SHA yang sama. Pemeriksaan health menunjukkan tiga layanan online, tanpa crashed replica, warning atau critical pada saat diperiksa. Tidak ada patch Railway lama yang diterapkan.

## Cakupan yang sudah diterapkan

### Empat halaman Produk & SKU

- Semua Produk: pencarian nama/SKU, status, kategori, pagination, gambar utama dan seluruh galeri pendukung, edit lengkap, Edit Cepat dan publikasi.
- Tambah Produk: informasi produk, kategori, brand opsional, pengelola barang, gambar, harga/promo, berat/dimensi dan stok per gudang.
- Kategori Produk: nama, slug, gambar, deskripsi, induk, status dan jumlah produk utama. Validasi mencegah hubungan melingkar. Penonaktifan tidak menghapus produk.
- Review Pembeli: moderasi status, rating, isi ulasan, produk terkait dan balasan admin. Tidak tersedia pembuatan ulasan palsu oleh admin.

Impor Produk menjadi tindakan tambahan pada workspace, bukan halaman utama kelima. Navigasi lama /admin?tab=products dan /admin?tab=orders mengarah ke halaman native baru.

### Produk, variasi, harga dan gambar

Produk simple mempunyai satu SKU. Produk variable mempunyai satu induk dan SKU variasi dengan 1-3 dimensi atribut; maksimal 200 kombinasi per produk. SKU varian memiliki harga, opsi, gambar khusus, berat/dimensi dan stoknya sendiri. Induk tidak menerima stok dan tidak dapat dimasukkan ke keranjang. Varian existing dinonaktifkan, bukan dihilangkan dari riwayat secara diam-diam.

Harga normal/promo dan jadwal WIB digunakan secara konsisten oleh server katalog, pilihan SKU, keranjang, quote checkout dan snapshot draft pesanan. Harga promo harus lebih rendah daripada harga normal; jadwal diperiksa di server. Harga yang dikirim browser bukan sumber kebenaran checkout.

Upload gambar produk menerima PNG/JPEG/WebP statis maksimal 1,5 MiB per file. Satu gambar utama dan maksimal 20 pendukung; preview, Jadikan utama, urutan dan pelepasan gambar tersedia. Decode dan optimasi gambar menghasilkan WebP tampilan, dengan original tersimpan privat. Kuota produk: 60 file baru per administrator per jam dan 512 MiB total. Batas Hero Banner tidak diubah.

### Stok dari form produk dan Edit Cepat

Stok fisik dapat diisi langsung dari produk atau SKU varian pada setiap gudang fisik aktif. Seluruh perubahan tetap memakai ledger warehouse existing, transaksi dan audit yang sama. Tidak ada stok paralel di form Produk.

Kolom kosong berarti tidak mengubah saldo; angka 0 berarti merekonsiliasi stok fisik ke nol. Reservasi tidak diubah oleh editor; stok fisik di bawah reservasi ditolak. Simpan memeriksa snapshot saldo dan versi produk untuk menghindari overwrite bersamaan. Catatan diperlukan untuk perubahan stok. Stok pada HOLD tetap direkonsiliasi melalui transfer gudang yang sah. Draft pesanan tidak mereservasi stok.

Edit Cepat mengubah SKU, harga normal/promo dan stok gudang. Untuk produk variable, operator memilih SKU varian terlebih dahulu. Edit varian juga memperbarui versi induk agar editor keluarga produk yang sudah lama tidak menimpa perubahan.

### Brand opsional dan kepemilikan

Brand merupakan informasi merek yang opsional. Pengelola barang disimpan terpisah: Vapmart/internal atau partner yang sah. Informasi merek saja tidak memberikan akses partner. Produk tanpa brand dapat mengikuti jalur fulfillment internal.

Ownership dan harga/nama/SKU pada order item adalah snapshot. Kepemilikan historis yang belum diketahui tidak ditebak dari master produk terkini. Akses partner tetap disaring di server. Tidak ada brand palsu, undangan partner otomatis atau pembayaran terverifikasi palsu yang dibuat.

### Impor CSV

Upload > Cocokkan kolom > Validasi/preview > Konfirmasi impor > Laporan hasil.
Maksimal 2 MiB, 2.000 record dan 128 kolom. Mendukung ID sumber/SKU, simple/variable/variation, Parent, kategori bertingkat, harga promo, gambar, tiga kelompok atribut dan kolom multi-gudang.

Preview tidak menulis produk/stock; konfirmasi apply bersifat satu transaksi. ID sumber, SKU, request dan hash membantu mencegah duplikasi saat retry/impor identik. Blank stock bukan nol. Nilai Stock memerlukan gudang tujuan. Produk baru tetap draft; status produk existing dipertahankan. Konflik/perubahan setelah preview ditolak. Preview berlaku 30 menit.

Brand sumber yang tidak cocok tidak membuat hak partner baru. URL gambar eksternal tidak diunduh oleh server dan hak pakainya tidak diverifikasi otomatis. Tidak seluruh metadata plugin WooCommerce diklaim kompatibel. CSV contoh dari Drive dipelajari sebagai referensi struktur dan TIDAK diimpor ke live.

### Review, storefront dan pesanan

Review pelanggan memerlukan item pesanan sendiri dengan pembayaran terverifikasi dan bukti pengiriman provider-delivered sesuai aturan backend. Satu order item memiliki satu review; review baru menunggu moderasi. Hanya review approved yang tampil publik dan memengaruhi rating. Email/ID akun tidak ditampilkan dalam respons review publik.

Katalog/detail produk mendukung pilihan atribut, SKU varian, harga promo dan stok yang sesuai. Keranjang memperbarui harga/ketersediaan dari server. Checkout menyimpan draft; pelanggan melihat riwayat pesanan miliknya. Admin melihat daftar/filter/detail pesanan dan akses ke fulfillment. Tidak ada tombol manual untuk memalsukan lunas, pengiriman provider atau refund.

## Migrasi dan data yang dipertahankan

Migration `017_product_engine.sql` terkonfirmasi pada log API 2026-11-03T11:37:19.954268799Z. Migrasi menambahkan kategori, relasi kategori, atribut/varian, promo, ownership snapshot, request/import/audit dan review. Fixed category check diganti foreign key kategori; batch fulfillment internal dapat mempunyai partner null. Existing explicit brand ownership diinisialisasi tanpa menebak kepemilikan historis yang kosong.

Harga, kuantitas stok, publication flags dan original media existing tidak ditulis ulang. Log migrasi: 59 original media terverifikasi, 0 original baru, 0 demo product seed. Log startup membaca 19 record existing, 1 managed draft, 0 published, 19 primary photo linked dan 0 missing. Ini hasil baca startup, bukan login operator atau bukti full WooCommerce migration.

Pemeriksaan public live terakhir 2026-11-03T11:44:09.114Z (18:44:09 WIB): 0 produk aktif, 6 kategori, 3 hero banner. Engine baru tidak otomatis menerbitkan arsip atau membuat stok/harga bisnis. Arsip 19 record tetap read-only, terpisah dari katalog operasional.

Supabase AdminGuard, customer authentication, original media dan source Hero Banner yang dilindungi dicek tidak berubah dibanding baseline CP38. Proteksi katalog operasional dan commerce safeguards dipertahankan. Tidak ada perubahan DNS/email/provider secrets/main/PR #1.

## Pengujian pra-rilis

Run `41628045181`, job `125890902261`, exact application SHA: SUCCESS.

- Build API dan 59 unit test lulus.
- Migrasi dua kali pada PostgreSQL sementara lulus.
- HTTP acceptance: create/update, retry idempotent, promo boundaries, transaksi stok dan rollback, reservasi, single-winner edit conflict, tiga atribut varian, optional brand/internal fulfillment, isolasi partner dan pelanggan, kategori, import preview/apply/replay, blank stock dan verified buyer review lulus.
- Regresi CP37A integrity, warehouse/fulfillment/courier dan CP38 hero pada database sementara terpisah lulus.
- Build produksi Web lulus.
- Browser full-stack lokal: kategori, upload dua gambar dan ganti utama, simple product, Edit Cepat, produk tiga atribut, stok tiap gudang, pilihan SKU di storefront, promo keranjang, checkout draft, riwayat pelanggan, admin detail pesanan, CSV preview/apply, review empty state, konflik mempertahankan input, error/retry dan mobile lulus.
- Mobile 390 px: scrollWidth=390. Hero existing tetap ada.

Browser lokal memakai API dan PostgreSQL nyata pada loopback serta identitas fixture. Fixture server menolak database di luar nama CP39/127.0.0.1 dan tidak dimasukkan ke runtime aplikasi deploy. Tidak ada pembayaran, provider courier atau akun produksi yang dipakai untuk mutasi pengujian.

## Pengujian pascarilis

Run final `41629836313`: seluruh langkah SUCCESS, termasuk live read/denial, UI read-only fixture serta theme/membership existing.

- Health Web HTTP 200, API/database ready.
- Public categories/selection dan products pagination berfungsi; invalid ID ditolak HTTP 400.
- Tujuh endpoint admin/customer yang diperiksa melalui API dan proxy Web masing-masing menolak anonim HTTP 401; token tidak valid juga 401.
- Enam halaman admin baru mengalihkan pengguna anonim ke /admin dan tidak menampilkan workspace.
- Empat tab produk, dialog Edit Cepat, editor, kategori, review, impor, pesanan serta drawer mobile tampil dengan fixture read-only.
- Mobile editor: width=390, scrollWidth=390, scrollY=0, topbarTop=0.
- Fixture UI mencatat mutations=0 dan tanpa JavaScript page errors.
- paymentEnabled=false, providerConnected=false, bookingEnabled=false, rateLookupEnabled=false.

Run awal `41629501484` gagal pada pemeriksaan decode hero yang masih lazy/offscreen. Tes diperbaiki untuk membuka tiap slide melalui navigasi carousel sebelum decode. Application source tidak berubah; final run di atas lulus. Penyesuaian screenshot juga menunggu scroll ke posisi atas benar-benar selesai.

Batas bukti: positive admin UI pada domain live memakai identitas/data sintetis yang diintersep; semua request mutasi admin diblokir oleh runner. Tidak ada login/upload/import memakai akun admin asli atau authorized live business write yang diklaim sebagai UAT. Operasi engine diuji secara penuh pada database sementara, bukan pada stok pelanggan nyata.

## Artefak dan sumber bukti

Pra-rilis artifact `13226657524`, cp39-verification, SHA-256 `a336fd2a65627b566d0c19aba8a44874727db35ac0486de5eb0449a2729beef1`.
Pascarilis artifact `13227118081`, cp39-live-verification, SHA-256 `661da3c80c03bae92af1acfeb42cf5d6a6d226d05e09c1e025d8a215dcfab8bd`.
Kedua ZIP diunduh dan digest diverifikasi. Screenshot desktop/mobile dan header form diperiksa secara visual. Gambar admin final adalah fixture, bukan data operator asli.

Pra-rilis: https://github.com/9dbit/Vapmart/actions/runs/41628045181
Pascarilis: https://github.com/9dbit/Vapmart/actions/runs/41629836313

## Akses dan langkah penggunaan

- https://vapmart.id/admin/products : Semua Produk dan Edit Cepat.
- https://vapmart.id/admin/products/new : Tambah simple/variasi dan stok gudang.
- https://vapmart.id/admin/products/categories : kategori.
- https://vapmart.id/admin/products/reviews : moderasi review pembeli.
- https://vapmart.id/admin/products/import : template/mapping/preview/impor.
- https://vapmart.id/admin/orders : daftar dan detail pesanan.
- https://vapmart.id/pesanan : riwayat pelanggan.
- https://vapmart.id/admin/banners : Hero Banner CP38 tetap tersedia.

Mulai dengan data produk yang sah, pilih kategori/pengelola, isi SKU/harga/foto/dimensi serta stok gudang berdasarkan bukti, simpan draft, lalu publikasi setelah validasi. Perubahan konten setelah rilis tidak memerlukan deploy kode. Gunakan preview CSV dan periksa laporan sebelum konfirmasi.

## Batas operasional dan pemulihan

Rilis teknis CP39 dan QA selesai. Data katalog asli tetap perlu dilengkapi dan diperiksa oleh operator resmi. Pembayaran nyata, booking kurir, quote provider berbayar, full WooCommerce migration, MFA/operator-RBAC tambahan, backup/restore drill dan penerimaan operator memakai akun asli tidak diklaim selesai dalam checkpoint ini.

Jangan rollback membabi-buta ke CP38 setelah data varian CP39 dibuat: kode CP38 tidak memahami semantik publikasi induk/anak dan dapat memperlakukan SKU anak sebagai produk terpisah. Setelah business writes CP39, gunakan recovery build yang kompatibel dengan model CP39. Pertahankan migration 017 dan semua data; jangan drop/restore database untuk membatalkan frontend. Sebelum business writes, pemulihan baseline pun harus ditinjau terhadap kondisi database aktual.

Lanjutkan pengembangan dari release checkpoint ini. Aplikasi live tetap pinned ke SHA yang telah lolos pengujian. Setiap perubahan aplikasi berikutnya memerlukan CI, release bertahap API/Web, dan verifikasi domain dengan scope yang dijelaskan.
