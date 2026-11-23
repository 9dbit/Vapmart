/** Route fallbacks follow the current product and catalog layout. Decorative
 * placeholders contain no controls and expose one loading status to readers. */
function Placeholder({className=''}:{className?:string}){
 return <div className={'vm-loading-shape '+className}/>;
}

export function ProductLoadingSkeleton(){
 return <main className="vm-detail-page vpd-page vm-loading vm-loading-product"
   data-product-detail-upgrade="v3" aria-label="Memuat detail produk" aria-busy="true">
  <div className="vpd-top" aria-hidden="true">
   <div className="vpd-gallery">
    <Placeholder className="vm-loading-product-image"/>
    <div className="vm-loading-thumbnails">
     {Array.from({length:4},(_,index)=><Placeholder className="vm-loading-thumbnail" key={index}/>)}
    </div>
   </div>
   <div className="vpd-hero-content vm-loading-product-copy">
    <Placeholder className="vm-loading-breadcrumb"/>
    <Placeholder className="vm-loading-price"/>
    <Placeholder className="vm-loading-title"/>
    <Placeholder className="vm-loading-title vm-loading-short"/>
    <Placeholder className="vm-loading-rating"/>
    <div className="vm-loading-brand"><Placeholder className="vm-loading-avatar"/><Placeholder className="vm-loading-line"/></div>
    <div className="vm-loading-variants">
     <Placeholder className="vm-loading-caption"/>
     <div className="vm-loading-chips">
      {Array.from({length:3},(_,index)=><Placeholder className="vm-loading-chip" key={index}/>)}
     </div>
    </div>
    <div className="vm-loading-delivery"><Placeholder className="vm-loading-avatar"/><div><Placeholder className="vm-loading-caption"/><Placeholder className="vm-loading-line"/></div></div>
   </div>
  </div>
  <div className="vpd-purchase-bar vm-loading-purchase" aria-hidden="true">
   <Placeholder/><Placeholder/><Placeholder/>
  </div>
  <p className="sr-only" role="status">Sedang memuat detail produk</p>
 </main>;
}

export function CatalogLoadingSkeleton(){
 return <main className="main-container legacy-product-wrapper vm-catalog-page vm-loading vm-loading-catalog"
   aria-label="Memuat katalog" aria-busy="true">
  <div className="vm-collection" aria-hidden="true">
   <Placeholder className="vm-loading-heading"/>
   <div className="vm-loading-toolbar">
    <Placeholder className="vm-loading-tool"/><Placeholder className="vm-loading-tool"/>
    <Placeholder className="vm-loading-filter"/><Placeholder className="vm-loading-filter"/><Placeholder className="vm-loading-filter"/>
   </div>
   <Placeholder className="vm-loading-count"/>
   <div className="product-grid">
    {Array.from({length:8},(_,index)=><div className="vm-loading-card" key={index}>
     <Placeholder className="vm-loading-catalog-image"/>
     <div className="vm-loading-card-copy"><div><Placeholder className="vm-loading-title"/><Placeholder className="vm-loading-card-price"/></div><Placeholder className="vm-loading-tool"/></div>
    </div>)}
   </div>
  </div>
  <p className="sr-only" role="status">Sedang memuat katalog Vapmart</p>
 </main>;
}
