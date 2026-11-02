export default function ProductLoading(){
  return <main className="vm-detail-page vm-cp17-loading" aria-label="Memuat detail produk">
    <div className="vm-cp17-detail-grid" aria-hidden="true">
      <div className="vm-cp17-skeleton vm-cp17-detail-image"/>
      <div className="vm-cp17-skeleton-card vm-cp17-detail-copy">
        <div className="vm-cp17-skeleton vm-cp17-title"/>
        <div className="vm-cp17-skeleton vm-cp17-price"/>
        <div className="vm-cp17-skeleton vm-cp17-line"/>
        <div className="vm-cp17-skeleton vm-cp17-line"/>
        <div className="vm-cp17-skeleton vm-cp17-button"/>
      </div>
    </div>
    <p className="sr-only" role="status">Sedang memuat detail produk</p>
  </main>;
}
