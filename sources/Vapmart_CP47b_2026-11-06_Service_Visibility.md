# Vapmart CP47b | Pilihan Layanan Kurir Individual
Tanggal: 6 November 2026 (Asia/Jakarta)
Repo: 9dbit/Vapmart
Base: release/vapmart-stable
Feature branch: feat/courier-service-visibility-20261106

## Koreksi setelah memeriksa screenshot dokumen
Dokumen sumber: Review WEB vapmart.id
https://docs.google.com/document/d/1of1iaAo2zTVaDsT300f6AN_RbH2WsaPQa4Q8SKQBXFc/edit

Screenshot pada dokumen menunjukkan checkbox *per layanan*, bukan hanya per perusahaan ekspedisi. Contohnya JNE REG, YES dan TRUCKING adalah opsi terpisah. Pilihan pada screenshot merupakan referensi visual, bukan konfigurasi aktual yang otomatis diterapkan, karena daftar gambar tidak lengkap dan pilihan harus ditentukan oleh admin.

## Implementasi CP47b
- Gunakan `courier_code:provider_service_id` untuk menyimpan pilihan layanan Jubelio. Biteship menggunakan `courier_code:service_code` berdasarkan snapshot quote.
- Tambah migrasi `030_courier_service_visibility.sql` untuk kolom `service_keys`, tanpa mengubah migrasi 029 yang sudah pernah dijalankan.
- Endpoint admin `GET/PATCH /v1/admin/shipping/couriers` menyajikan `availableServices` dan `selectedServices`, serta tetap membaca `selectedCodes` lama.
- Admin UI menampilkan kelompok perusahaan kurir, checkbox setiap service, cari, pilih per kurir, pilih semua, kosongkan, serta simpan.
- Tarif checkout hanya mengandung service yang telah dicentang dan masih dapat memperoleh quote.
- Saat customer membuat order, validasi ulang provider service key sehingga quote lama yang layanannya dinonaktifkan tidak dapat digunakan.
- Snapshot quote dan pesanan yang sudah terkonfirmasi tidak diubah, dan penerbitan AWB pada Courier Ops tetap merupakan tindakan admin setelah pembayaran, packing, manifest dan biaya diverifikasi.
- Instant/Same Day dari Jubelio yang membutuhkan koordinat tidak dapat diaktifkan di checkout kode pos saja; aplikasi belum memiliki peta/lat-long yang tervalidasi.

## Test dan deployment
- Unit test: dua layanan dari kurir yang sama dapat memiliki checkbox berbeda.
- Integration PostgreSQL: admin menyimpan hanya `24:2453` dari dua layanan `24`, hanya quote terpilih yang dikembalikan; perubahan ke `31:3101` memblokir penggunaan quote lama `24:2453`.
- Harus lulus GitHub CI (API build, unit tests, PostgreSQL integration, web build), merge ke release, lalu Railway API/web deployment SUCCESS sebelum disebut selesai.
- Tidak memicu booking AWB sungguhan selama proses QA/deploy, tidak mengubah pembayaran, DNS atau email.
