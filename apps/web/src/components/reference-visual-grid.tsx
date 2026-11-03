import type {ArchiveItem} from '@/lib/archive-catalog';
import {formatIDR} from '@/lib/types';
import './reference-placeholder-price.css';

/** Read-only legacy artwork. Zero is an unset-price placeholder, never a free offer. */
export function ReferenceVisualGrid({items}:{items:ReadonlyArray<ArchiveItem>}){
 return <div className="vm-reference-grid vm-restored-reference-grid" role="list" aria-label="Dokumentasi foto katalog Vapmart">
   {items.map(item=><article role="listitem" className="vm-reference-card vm-archive-link vm-restored-reference-card" key={item.slug}>
     <div className="vm-archive-image">
       <img src={item.image} alt={'Foto arsip '+item.name} width={300} height={300} loading="lazy" decoding="async"/>
       <span className="vm-archive-chip">REFERENSI</span>
     </div>
     <div className="vm-reference-copy"><h3 title={item.name}>{item.name}</h3>
       <div className="vm-reference-placeholder-price" data-price-status="unset" data-price-idr="0" aria-label="Harga sementara Rp0. Harga belum ditetapkan, bukan produk gratis.">
         <strong>{formatIDR(0)}</strong>
         <span>Harga belum ditetapkan</span>
       </div>
       <small>Arsip visual · Tidak tersedia untuk transaksi</small>
     </div>
   </article>)}
 </div>;
}
