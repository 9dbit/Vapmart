import Link from 'next/link';
import type {ArchiveItem} from '@/lib/archive-catalog';

export function ArchiveCard({item}:{item:ArchiveItem}){
 return <Link href={'/product/'+encodeURIComponent(item.slug)} className="vm-reference-card vm-archive-link" aria-label={'Lihat referensi '+item.name}>
  <span className="vm-archive-image"><img src={item.image} alt={item.name} width={300} height={300} loading="lazy"/><span className="vm-archive-chip">ARSIP</span></span>
  <div className="vm-reference-copy">
   <h3 title={item.name}>{item.name}</h3>
   <div className="vm-reference-price">{item.originalPrice&&<del>{item.originalPrice}</del>}<span>{item.price}</span></div>
  </div>
 </Link>;
}
