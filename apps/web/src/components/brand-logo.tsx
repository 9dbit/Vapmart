/**
 * Vapmart official logo, visually switched before hydration using the root
 * data-vapmart-color-mode attribute. Keeps the original purple square icon.
 * The dark asset has the original transparent alpha and a #D1D1D6 wordmark.
 */
export function BrandLogo({variant='header'}:{variant?:'header'|'footer'|'powered'}){
 return <span className={'vm24-brand-logo vm24-brand-logo-'+variant}
   role="img" aria-label="Vapmart">
   <img className="vm24-logo-light" src="/branding/vapmart-logo.png"
     alt="" aria-hidden="true" width="400" height="79" decoding="async"/>
   <img className="vm24-logo-dark" src="/branding/vapmart-logo-dark.png"
     alt="" aria-hidden="true" width="400" height="79" decoding="async"/>
 </span>;
}
