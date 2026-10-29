import Link from 'next/link';
export const metadata={title:'Member | Vapmart',robots:{index:false,follow:false}};
export default function MemberPage(){
 return <main className="vm-member-page">
  <header><span className="vm-preview-kicker">VAPMART MEMBER</span><h1>Member Vapmart</h1>
    <p>Panel member mengikuti identitas visual WordPress existing. Points, reward dan histori akun belum terhubung dengan data pelanggan produksi.</p></header>
  <div className="vm-member-tiles">
   <section><span>MEMBER</span><strong>Program Anggota</strong><p>Benefit member akan diaktifkan setelah autentikasi dan data poin terverifikasi.</p></section>
   <section><span>POINTS</span><strong>0 Points</strong><p>Nilai pratinjau, bukan saldo akun.</p></section>
   <section><span>PROMO</span><strong>Promo Vapmart</strong><p>Informasi promo akan muncul ketika katalog baru aktif.</p></section>
  </div>
  <div className="vm-member-actions"><Link href="/login">Halaman login</Link><Link href="/catalog">Jelajahi katalog DEMO</Link></div>
 </main>;
}
