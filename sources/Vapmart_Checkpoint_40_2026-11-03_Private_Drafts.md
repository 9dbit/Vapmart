# Vapmart CP40: Private Draft Editing

Tanggal: 3 November 2026, Asia/Jakarta.
Status: SOURCE SUDAH DI GITHUB; BELUM DEPLOY. CI keseluruhan belum lulus karena satu pengujian browser baru berhenti pada selector deskripsi.

## Identitas sumber dan live

Repository: 9dbit/Vapmart.
Branch kerja: work/cp40-private-drafts-20261103.
Commit kandidat aplikasi terakhir: a261353436dab35a8c70154de14b676e077c8ca5.
Baseline release/vapmart-stable: 10bc9335cf65559cfdf13b847b1877edd9e1a1e3.
Runtime API dan Web tetap di CP39: a52c1c4e70080c8ef25e58e4d6792d239618ee54.

Tidak ada perubahan source/pin Railway atau migrasi database live dalam pekerjaan ini. Pemeriksaan terakhir menunjukkan vapmart-web, vapmart-api dan Postgres online tanpa crashed replica.

- API live: c1c93e8f-f266-47f9-a00f-a0f526257ac6, SUCCESS.
- Web live: 95c800ee-03b8-4774-8eb7-2a1847899492, SUCCESS.
- Postgres: 19ee1b92-92d7-42c9-a7fc-6cb676bcfa21, SUCCESS.
- Project: 7c01e4d8-6152-4f04-9750-6e7031aa0830.
- Environment: 04586a07-99b0-4cfd-95fa-bb6d8f1719e3, bernama staging dan melayani domain publik.

## Cakupan kandidat

Editor manual baru dapat menyimpan nama, deskripsi, SKU dan pilihan variasi yang belum selesai ditinjau sebagai draft internal. Harga 0 diterima untuk draft. Draft tetap tidak terlihat di katalog publik, tidak muncul pada pemilihan produk publik, dan tidak dapat dibeli. Publikasi serta edit produk aktif tetap memeriksa seluruh data tersimpan, termasuk jalur aktivasi legacy dan hubungan induk/varian.

Ini bukan penghapusan seluruh pembatasan publikasi. Validasi kategori dan importer tidak dilonggarkan. Arsip historis tidak dikonversi atau diterbitkan. Kandidat public Rp0 placeholder CP39-R1 tidak digabungkan. Tidak ada perubahan harga/stok existing, original media, autentikasi, DNS/email, pembayaran atau booking kurir.

File runtime yang berubah: catalog-workspace.ts, products.ts, database.ts, migrate.ts, serta satu migrasi baru 018_private_draft_publication.sql. Frontend tetap identik dengan baseline.

## Perbaikan hasil pengujian

Pengujian database nyata menemukan bahwa dua CHECK lama masih menolak teks pada draft, walaupun API mengizinkan penyimpanan internal. Migration 018 menyelaraskan penyimpanan draft dengan pemeriksaan konten saat publikasi. File migrasi lama tidak diubah. Tidak ada penulisan ulang harga, kuantitas, status publikasi atau konten existing.

Constraint publikasi root dan trigger publikasi keluarga produk tetap berjalan di database. Trigger menggunakan SECURITY INVOKER dan penguncian induk untuk menangani edit anak versus aktivasi induk. Pengujian mencakup dua urutan konkurensi pada READ COMMITTED; isolasi lain tidak diklaim telah diuji. Migrasi memeriksa konten aktif existing sebelum diterapkan dan gagal bila memerlukan peninjauan, bukan memodifikasi produk secara otomatis.

Penolakan constraint publikasi dalam transaksi dipetakan menjadi HTTP 400 dengan pesan validasi, bukan HTTP 500 atau rincian SQL. Transaksi tetap di-rollback. Kesalahan database yang tidak termasuk empat constraint publikasi tersebut tidak diubah pemetaannya.

## Bukti CI terakhir

Run: 41656680216. Job: 125988740264. Exact source: a261353436dab35a8c70154de14b676e077c8ca5.
Kesimpulan workflow: FAILURE karena browser CP40. Jangan menyebut seluruh QA lulus.

| Tahap | Hasil |
| --- | --- |
| Checksum sumber dan pelestarian sistem existing | Lulus |
| Clean install dan build API | Lulus |
| Unit test | 67 lulus, 0 gagal |
| Migrasi dua kali pada PostgreSQL sementara | Lulus |
| HTTP lifecycle draft, harga 0, replay, privasi, koreksi dan publikasi aksesori biasa | Lulus |
| Pemeriksaan SQL langsung dan dua skenario konkurensi induk/anak | Lulus |
| Regresi katalog, integritas, warehouse, courier, Hero Banner | Lulus |
| Build produksi frontend | Lulus |
| Browser CP39 existing end-to-end | Lulus |
| Browser CP40 baru | Belum lulus: selector deskripsi setelah reload |

Tujuh suite integrasi masing-masing lulus; jumlah skenario internalnya tidak dijumlahkan sebagai unit test tambahan. Browser CP39 mencakup kategori, upload utama/galeri, produk simple, Edit Cepat, tiga dimensi varian, gudang, promo/keranjang/draft checkout, riwayat pelanggan, detail pesanan admin, impor, empty state review, konflik, error/retry dan mobile 390 px tanpa overflow.

## Kegagalan browser yang tersisa

scripts/cp40-browser.mjs berhenti pada baris 36: getByLabel('Deskripsi', {exact:true}).inputValue() timeout setelah produk disimpan dan halaman dimuat ulang. Screenshot failure.png memperlihatkan draft sudah terbuka kembali dengan deskripsi yang disimpan, gambar, harga 0 dan stok 2. Artinya ada bukti penyimpanan/reload; tahap UI sesudah selector tersebut belum selesai dan tidak diklaim lulus.

Pembaruan skrip untuk memilih textarea editor secara tepat diblokir pemeriksaan keamanan konektor GitHub. Pembaruan itu tidak ditulis dan tidak diakali melalui jalur lain. Kandidat aplikasi tetap pada commit di atas. Tidak ada deployment baru yang dijalankan setelah gate ini gagal.

## Riwayat uji

1. Run 41654891463: materialisasi kandidat berhasil; setup PostgreSQL runner gagal akibat kutip healthcheck. Diperbaiki pada workflow.
2. Run 41655122404: build/67 unit lulus; HTTP gagal karena CHECK draft database lama. Migration 018 ditambahkan.
3. Run 41655971242: migrasi dan penyimpanan draft berjalan; active quick edit menghasilkan 500, bukan 400. Pemeta error constraint ditambahkan.
4. Run 41656680216: backend/integrasi/regresi/build dan browser existing lulus; browser baru berhenti pada selector deskripsi.

## Artefak

Artifact 13240755815, cp40-private-drafts-verification, ukuran 1551957 byte.
SHA-256 ZIP: e8232a92629d34973149ced5a80cb76f19e4ef24a23ca4e5f9eabd237d31ae16.
Digest ZIP telah diverifikasi lokal. Berisi log 67 unit test, tujuh suite integrasi, report browser CP39, screenshot dan log kegagalan browser CP40, serta verified-source.txt. Screenshot memakai identitas fixture dan data pengujian, bukan akun operator asli.

Semua pengujian mutasi menggunakan PostgreSQL loopback sementara dan identitas sintetis. Tidak ada login operator asli atau authorized live business write yang diklaim. Pembayaran dan booking kurir tidak diaktifkan.

## Sisa gate sebelum release

Perbaikan selector browser yang dapat diterapkan melalui jalur sah, CI exact source sampai sukses, pemeriksaan artefak, fast-forward branch rilis, deployment API dengan migration 018 lalu Web, konfirmasi terminal SUCCESS, dan QA domain read-only. Workflow pascarilis sudah tersedia tetapi belum dipicu. Jangan membuat manifest status SUCCESS sebelum status itu benar-benar teramati.

Migration 018 baru teruji di database sementara; belum terpasang live. Pertahankan semua data dan migrasi lama. Pemulihan harus memakai build yang sesuai dengan model CP39/CP40, bukan menghapus database atau menurunkan kode ke versi yang tidak memahami varian.
