import type {Metadata} from 'next';
import Link from 'next/link';
import {CartProvider} from '@/lib/cart';
import {CustomerAuthProvider} from '@/lib/customer-auth';
import {WishlistProvider} from '@/lib/wishlist';
import {VapmartCare} from '@/components/vapmart-care';
import {SiteHeader} from '@/components/site-header';
import {StorefrontChrome} from '@/components/storefront-chrome';
import {ThemeProvider} from '@/lib/theme';
import {BrandLogo} from '@/components/brand-logo';
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
import './cp21.css';
import './cp22.css';
import './cp23.css';
import './cp23-details.css';
import './cp23-member.css';
import './cp23-commerce.css';
import './cp23-shell.css';
import './cp24-logo.css';
import './storefront-collection.css';
import './member-obsidian.css';
import './home-compact.css';
import './hero-account-polish.css';
import './product-typography.css';
import './product-detail-v2.css';
import './account-transactions-favorites.css';
import './club-compact.css';
import './product-detail-v3.css';
import './chatvice-bottom-anchor.css';
import {Icon} from '@/components/store-icon';
// Runs before React hydration, preventing a bright flash on dark-theme return visits.
const initialThemeScript="(function(){var root=document.documentElement;var pref='light';try{var stored=localStorage.getItem('vapmart.color-mode.v1');if(stored==='dark'||stored==='light'||stored==='system')pref=stored}catch(e){}var system=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=pref==='system'?(system?'dark':'light'):pref;root.setAttribute('data-vapmart-color-mode',resolved);root.style.colorScheme=resolved;var meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=resolved==='dark'?'#131317':'#ffffff'})();";
export const metadata:Metadata={
 title:{default:'VapMart | Marketplace',template:'%s | VapMart'},
 description:'Vapmart marketplace untuk brand dan produk pilihan.',
 robots:{index:false,follow:false},
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="id" suppressHydrationWarning><head><meta name="theme-color" content="#ffffff"/>
    {/* The real widget loads after hydration in VapmartCare. This server-rendered
        merchant-specific marker lets Chatvice's non-JS domain validator confirm
        the installed integration without executing storefront JavaScript. */}
    <meta name="chatvice-widget-embed" data-merchant-id="m_d74410c444e2726c" content="https://chatvice.app/api/widget/chatvice.js?merchant=m_d74410c444e2726c"/><script id="vapmart-theme-init" dangerouslySetInnerHTML={{__html:initialThemeScript}}/></head><body data-vapmart-theme="member-cp22" data-vapmart-theme-options="cp23"><ThemeProvider><CustomerAuthProvider><CartProvider><WishlistProvider><StorefrontChrome><SiteHeader/></StorefrontChrome><VapmartCare/>{children}
    <StorefrontChrome><footer className="legacy-footer vm-reference-footer">
      <div className="main-container vm-reference-footer-grid">
        <div className="vm-footer-intro"><BrandLogo variant="footer"/>
          <p>Jelajahi brand dan koleksi pilihan di Vapmart.</p>
          <h3>Ikuti Kami</h3>
          <div className="vm-footer-social"><span aria-label="Facebook">f</span><span aria-label="YouTube">▶</span><span aria-label="Instagram">◎</span></div>
        </div>
        <div className="vm-footer-links"><h3>Jelajahi</h3>
          <Link href="/catalog">Katalog</Link><Link href="/brand-partner">Brand Partner</Link>
          <Link href="/member-2">Member</Link>
          <Link href="/akun">Akun Saya</Link>
          <Link href="/pesanan">Transaksi</Link><Link href="/favorit">Favorit</Link>
        </div>
        <div className="vm-footer-links"><h3>Informasi</h3>
          <Link href="/keranjang-2">Keranjang</Link>
          <p>Metode pembayaran di checkout</p>
        </div>
        <div className="vm-footer-support"><div className="vm-footer-support-title"><h3>Pusat Bantuan</h3></div>
          <a className="vm-whatsapp" href="https://wa.me/6285232324824" target="_blank" rel="noopener noreferrer">
            <span className="vm-wa-icon"><Icon name="whatsapp"/></span>
            <span><strong>Chat WhatsApp</strong><small>+62 852-3232-4824</small></span>
          </a>
        </div>
      </div>
      <div className="main-container vm-footer-powered">Powered by <BrandLogo variant="powered"/></div>
    </footer></StorefrontChrome>
  </WishlistProvider></CartProvider></CustomerAuthProvider></ThemeProvider></body></html>;
}