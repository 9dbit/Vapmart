import Link from 'next/link';
export const metadata={title:'Login | Vapmart',robots:{index:false,follow:false}};
export default function LoginPage(){
 return <main className="vm-account-page">
   <section className="vm-account-card" aria-labelledby="login-heading">
     <div className="vm-account-logo"><img src="/legacy/vapmart-logo-white.webp" alt="Vapmart" width="140" height="32"/></div>
     <div className="vm-account-tabs"><span className="is-active">Login</span><span>Daftar</span></div>
     <h1 id="login-heading">Masuk ke Vapmart</h1>
     <p>Halaman akun pelanggan sedang disiapkan untuk engine baru. Form ini tidak menerima kredensial sampai layanan autentikasi aktif.</p>
     <div className="vm-account-form-preview">
       <label htmlFor="customer-identity">Email atau nomor telepon</label>
       <input id="customer-identity" type="text" placeholder="Email atau nomor telepon" disabled/>
       <label htmlFor="customer-password">Password</label>
       <input id="customer-password" type="password" placeholder="Password" disabled/>
       <button type="button" disabled>Login belum tersedia</button>
     </div>
     <div className="vm-account-links"><Link href="/member-2">Informasi Member</Link><Link href="/catalog">Lihat Katalog DEMO</Link></div>
   </section>
 </main>;
}
