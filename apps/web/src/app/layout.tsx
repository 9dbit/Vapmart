import type {Metadata} from 'next';
import {CartProvider} from '@/lib/cart';
import {SiteHeader} from '@/components/site-header';
import './globals.css';
import './legacy.css';

export const metadata:Metadata={
 title:{default:'VapMart | Marketplace',template:'%s | VapMart'},
 description:'Preview marketplace Vapmart untuk katalog non-nikotin. Pembayaran belum tersedia.',
 robots:{index:false,follow:false},
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="id"><body><CartProvider><SiteHeader/>{children}
    <footer className="legacy-footer">
      <div className="main-container legacy-footer-cols">
        <div className="legacy-footer-about">
          <div className="legacy-logo legacy-footer-logo"><span className="legacy-logo-icon">V</span><span>Vap<span>Mart</span></span></div>
          <p>Marketplace Vapmart sedang diperbarui dengan katalog produk non-nikotin. Preview staging ini belum menerima transaksi.</p>
        </div>
        <div className="legacy-footer-group"><h3>Ikuti Kami</h3><LinkList/></div>
        <div className="legacy-footer-group"><h3>Informasi</h3>
          <a href="/#shop">Produk Pilihan</a><a href="/#categories">Kategori Produk</a><a href="/#promo">Promo</a><a href="/#member">Member</a>
        </div>
        <div className="legacy-footer-group"><h3>Layanan Pembelian</h3><p>Senin - Sabtu<br/>10.00 - 17.00 WIB</p><p>Member Support<br/>24/7 (informasi website existing)</p></div>
      </div>
      <div className="main-container legacy-footer-bottom"><span>© {new Date().getFullYear()} Vapmart</span><span>STAGING · Checkout disabled · Produk DEMO</span></div>
    </footer>
  </CartProvider></body></html>;
}
function LinkList(){
  return <><a href="/#brand">Partnership</a><a href="/#promo">Promo</a><a href="/akun">Akun</a><a href="/#news">News</a></>;
}
