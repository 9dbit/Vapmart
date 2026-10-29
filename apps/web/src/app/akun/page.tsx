import Link from 'next/link';
export const metadata={title:'Akun | VapMart'};
export default function AccountPage(){
  return <main className="legacy-account-page main-container">
    <Link href="/" className="back-link">← Kembali</Link>
    <div className="legacy-account-note"><p className="eyebrow">MEMBER / ACCOUNT</p>
      <h1>Akun Vapmart</h1>
      <p>Halaman akun pelanggan belum dibuka pada staging. Login administrator menggunakan Supabase Auth di dashboard terpisah setelah konfigurasi selesai.</p>
      <Link href="/#shop" className="button button-dark">Lihat Produk Pilihan</Link>
    </div>
  </main>;
}
