import type {Metadata} from 'next';
import {CartProvider} from '@/lib/cart';
import {SiteHeader} from '@/components/site-header';
import './globals.css';

export const metadata: Metadata={
  title:{default:'Vapmart | Everyday Objects',template:'%s | Vapmart'},
  description:'Discover thoughtfully selected everyday objects at Vapmart.',
  robots:{index:false,follow:false},
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="id"><body><CartProvider><SiteHeader/>{children}<footer className="site-footer"><div className="footer-top"><div><div className="brand footer-brand"><span className="brand-mark">V</span><span>vapmart<span className="brand-dot">.</span></span></div><p>Thoughtfully curated. Made for everyday.</p></div><div className="footer-links"><a href="/#shop">Shop</a><a href="/#categories">Categories</a><a href="/admin">Admin</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Vapmart. All rights reserved.</span><span>Staging preview · Transactions disabled</span></div></footer></CartProvider></body></html>;
}
