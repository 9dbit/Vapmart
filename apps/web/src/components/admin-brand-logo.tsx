import {BrandLogo} from '@/components/brand-logo';
import '../app/admin-brand-logo.css';

/** Reuse the storefront artwork and theme switching; never redraw the logo in text. */
export function AdminBrandLogo({placement}:{placement:'access'|'sidebar'}){
 return <span className={'vma27-official-brand vma27-official-brand-'+placement}
   data-vapmart-logo="official-storefront">
  <BrandLogo variant="header"/>
  {placement==='sidebar'&&<small className="vma27-official-brand-caption">CONTROL PANEL</small>}
 </span>;
}
