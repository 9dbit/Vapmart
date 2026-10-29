import type {Metadata} from 'next';
import Link from 'next/link';
import {CartProvider} from '@/lib/cart';
import {SiteHeader} from '@/components/site-header';
import './globals.css';
import './legacy.css';
import './brand.css';
import './parity.css';
import './reference.css';
import './checkpoint10.css';
import './modern.css';
import './modern-fixes.css';
export const metadata:Metadata={
 title:{default:'VapMart | Marketplace',template:'%s | VapMart'},
 description:'Rebuild staging Vapmart. Referensi visual WordPress, katalog baru sedang disiapkan. Checkout belum tersedia.',
 robots:{index:false,follow:false},
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="id"><body><CartProvider><SiteHeader/>{children}
    <footer className="legacy-footer vm-reference-footer">
      <div className="main-container vm-reference-footer-grid">
        <div className="vm-footer-intro"><img src="/legacy/vapmart-logo-white.webp" alt="Vapmart" width={112} height={25}/>
          <p>Platform Vapmart sedang diperbarui. Konten produk lama ditampilkan sebagai referensi visual staging, bukan penawaran aktif.</p>
          <h3>Ikuti Kami</h3>
          <div className="vm-footer-social"><span aria-label="Facebook">f</span><span aria-label="YouTube">▶</span><span aria-label="Instagram">◎</span></div>
        </div>
        <div className="vm-footer-links"><h3>Ikuti Kami</h3>
          <Link href="/#news">Tentang</Link><Link href="/#brand">Partnership</Link><Link href="/#promo">Promo</Link>
          <Link href="/akun">Konfirmasi Pembayaran</Link><Link href="/akun">Lacak Orderan</Link><Link href="/catalog">Cara belanja</Link>
        </div>
        <div className="vm-footer-links"><h3>Ikuti Kami</h3>
          <Link href="/catalog">Layanan Pembelian</Link><p>Senin - Sabtu</p><p>10.00 - 17.00 WIB</p>
          <p>WhatsApp</p><p>Kontak ditinjau sebelum produksi</p>
        </div>
        <div className="vm-footer-support"><div className="vm-footer-support-title"><h3>Member Support</h3><strong>24/7</strong></div>
          <div className="vm-support-box"><span className="vm-support-symbol" aria-hidden="true">☏</span>
            <div><strong>WhatsApp</strong><small>Belum aktif pada staging</small></div>
          </div>
        </div>
      </div>
      <div className="main-container vm-footer-powered">Powered by <img src="/legacy/vapmart-logo-white.webp" alt="Vapmart" width={84} height={20}/></div>
    </footer>
  </CartProvider></body></html>;
}
