export default function CatalogLoading(){
  return <main className="main-container vm-cp17-loading vm-catalog-page" aria-label="Memuat katalog">
    <div className="vm-cp17-skeleton vm-cp17-title" aria-hidden="true"/>
    <div className="vm-cp17-skeleton vm-cp17-lead" aria-hidden="true"/>
    <div className="vm-cp17-skeleton vm-cp17-filter" aria-hidden="true"/>
    <div className="vm-cp17-skeleton-grid" aria-hidden="true">
      {Array.from({length:6},(_,index)=><div key={index} className="vm-cp17-skeleton-card"><div className="vm-cp17-skeleton vm-cp17-image"/><div className="vm-cp17-skeleton vm-cp17-line"/><div className="vm-cp17-skeleton vm-cp17-price"/></div>)}
    </div>
    <p className="sr-only" role="status">Sedang memuat katalog Vapmart</p>
  </main>;
}
