import type {ArchiveItem} from '@/lib/archive-catalog';

/** Read-only presentation of legacy artwork. No pricing, product URL, cart or purchase. */
export function ReferenceVisualGrid({items}:{items:ReadonlyArray<ArchiveItem>}){
 return <div className="vm-reference-grid vm-restored-reference-grid" role="list" aria-label="Dokumentasi foto katalog Vapmart">
   {items.map(item=><article role="listitem" className="vm-reference-card vm-archive-link vm-restored-reference-card" key={item.slug}>
     <div className="vm-archive-image">
       <img src={item.image} alt={'Foto arsip '+item.name} width={300} height={300} loading="lazy" decoding="async"/>
       <span className="vm-archive-chip">REFERENSI</span>
     </div>
     <div className="vm-reference-copy"><h3 title={item.name}>{item.name}</h3>
       <small>Arsip visual · Tidak tersedia untuk transaksi</small>
     </div>
   </article>)}
 </div>;
}
