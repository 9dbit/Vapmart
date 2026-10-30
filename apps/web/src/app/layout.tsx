import type {Metadata} from 'next';
import Link from 'next/link';
import {CartProvider} from '@/lib/cart';
import {WishlistProvider} from '@/lib/wishlist';
import {SiteHeader} from '@/components/site-header';
import './globals.css';
import './legacy.css';
import './brand.css';
import './parity.css';
import './reference.css';
import './checkpoint10.css';
import './modern.css';
import './modern-fixes.css';
import './checkpoint13.css';
import './trendora.css';
export const metadata:Metadata={
 title:{default:'VapMart | Marketplace',template:'%s | VapMart'},
 description:'Rebuild staging Vapmart. Referensi visual WordPress, katalog baru sedang disiapkan. Checkout belum tersedia.',
 robots:{index:false,follow:false},
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="id"><body data-vapmart-theme="purple-cp18"><CartProvider><WishlistProvider><SiteHeader/>{children}
    <footer className="legacy-footer vm-reference-footer">
      <div className="main-container vm-reference-footer-grid">
        <div className="vm-footer-intro"><img src="/branding/vapmart-logo.png" alt="Vapmart" width={112} height={25}/>
          <p>Platform Vapmart sedang diperbarui. Konten produk lama ditampilkan sebagai referensi visual staging, bukan penawaran aktif.</p>
          <h3>Ikuti Kami</h3>
          <div className="vm-footer-social"><span aria-label="Facebook">f</span><span aria-label="YouTube">▶</span><span aria-label="Instagram">◎</span></div>
        </div>
        <div className="vm-footer-links"><h3>Jelajahi</h3>
          <Link href="/#news">Inspirasi & News</Link><Link href="/brand-partner">Brand Partner</Link>
          <Link href="/catalog">Katalog baru</Link><Link href="/member-2">Member</Link>
          <Link href="/login">Akun pelanggan</Link>
        </div>
        <div className="vm-footer-links"><h3>Informasi</h3>
          <Link href="/asset-review">Arsip visual</Link><Link href="/keranjang-2">Keranjang DEMO</Link>
          <p>Checkout belum tersedia</p><p>Customer support sedang disiapkan</p>
        </div>
        <div className="vm-footer-support"><div className="vm-footer-support-title"><h3>Pusat Bantuan</h3><strong>Staging</strong></div>
          <div className="vm-support-box"><span className="vm-support-symbol" aria-hidden="true">☏</span>
            <div><strong>WhatsApp</strong><small>Belum aktif pada staging</small></div>
          </div>
        </div>
      </div>
      <div className="main-container vm-footer-powered">Powered by <img src="/branding/vapmart-logo.png" alt="Vapmart" width={84} height={20}/></div>
    </footer>
  </WishlistProvider></CartProvider></body></html>;
}