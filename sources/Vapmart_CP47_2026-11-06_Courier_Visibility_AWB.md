# Vapmart CP47: Kurir Storefront & Dapatkan Airwaybill
Tanggal: 6 November 2026
Branch: `feat/courier-visibility-awb-20261106`
Target: `release/vapmart-stable`

## Sumber request
Google Doc: Review WEB vapmart.id
- Di control panel, kurir yang dicentang admin saja tampil di storefront.
- Admin perlu tombol untuk memperoleh airwaybill langsung dari aggregator.

## Perubahan
1. Tambah tabel `product.shipping_courier_visibility` sebagai daftar kurir yang diizinkan berdasarkan ID provider, terpisah untuk Jubelio dan Biteship.
2. Halaman admin Shipping Operations menampilkan katalog kurir live/teramati, checkboxes, pencarian, pilih semua, kosongkan dan Simpan kurir storefront.
3. Tarif customer dan admin order edit sekarang difilter dari backend sesuai pilihan admin; kurir tidak dicentang tidak memiliki quote baru.
4. Checkout memverifikasi ulang pilihan kurir saat submit sehingga quote yang semula berlaku tapi kemudian disembunyikan tidak bisa lagi digunakan.
5. Di admin daftar/detail pesanan ada tombol Dapatkan Airwaybill; menuju Courier Ops dan memilih batch pesanan terkait.
6. Pada Courier Ops ada tombol utama Dapatkan Airwaybill, juga aksi langsung per baris, yang menjalankan preflight booking, menampilkan blocker, kurir, harga, lalu meminta konfirmasi admin sebelum membuat shipment melalui Jubelio.
7. Shipment yang sudah dibooking membuka label kurir; hasil yang belum pasti direkonsiliasi, tidak membuat booking kedua.
8. Alur tetap mensyaratkan pembayaran terverifikasi, status processing, paket ready_for_carrier, manifest prepared dengan pickup segera, quote origin yang cocok, dan fitur booking Jubelio diaktifkan.

## Guardrails
- Tidak membuat AWB atau meminta pickup otomatis pada deploy, test, atau page load.
- Tanpa memalsukan status pembayaran / refund.
- Tidak mengubah data pesanan yang sudah dibayar atau resi eksisting.
- Katalog sebelum admin menyimpan pengaturan tetap kompatibel dengan perilaku lama. Simpan setidaknya satu pilihan untuk mengaktifkan filter.
- Webhook, payment gateway, kunci API, DNS dan email tidak diubah.
- Sampel pengujian memakai penyedia mock dan PostgreSQL sementara, tidak melakukan booking berbayar.
- Setelah CI hijau: merge, deploy Railway API + web, cek health/domain, lalu verifikasi perilaku melalui akun admin/customer untuk tarif dan booking yang nyata.
