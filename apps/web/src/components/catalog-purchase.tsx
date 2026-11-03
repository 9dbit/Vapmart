'use client';
import {useState} from 'react';
import type {Product} from '@/lib/types';
import {formatIDR} from '@/lib/types';
import {AddToCart} from './add-to-cart';
import '../app/catalog-store.css';
export function CatalogPurchase({product}:{product:Product}){
 const [selection,setSelection]=useState<Record<string,string>>({});
 const variable=product.product_type==='variable',defs=product.attributes||[],variants=product.variants||[];
 const chosen=variable?variants.find(v=>defs.every(d=>selection[d.name]&&v.option_values?.[d.name]===selection[d.name])):product;
 const available=(name:string,value:string)=>variants.some(v=>v.option_values?.[name]===value&&defs.every(d=>d.name===name||!selection[d.name]||v.option_values?.[d.name]===selection[d.name]));
 return <div className="vcs-purchase">
 {variable&&<fieldset className="vcs-variants"><legend>Pilih variasi</legend>{defs.map(d=><label key={d.name}>{d.name}<select aria-label={'Pilih '+d.name} value={selection[d.name]||''} onChange={e=>setSelection({...selection,[d.name]:e.target.value})}><option value="">Pilih {d.name}</option>{d.values.map(v=><option key={v} value={v} disabled={!available(d.name,v)}>{v}</option>)}</select></label>)}<button type="button" onClick={()=>setSelection({})}>Reset pilihan</button></fieldset>}
 <div aria-live="polite"><div className="vm-detail-price">{chosen?<>{chosen.promo_active&&chosen.regular_price_idr!==undefined&&<del>{formatIDR(chosen.regular_price_idr)}</del>}<strong>{formatIDR(chosen.price_idr)}</strong>{chosen.promo_active&&<span className="vcs-tag">Promo</span>}</>:<strong>{formatIDR(product.price_idr)}{product.price_max_idr&&product.price_max_idr>product.price_idr?' - '+formatIDR(product.price_max_idr):''}</strong>}</div>
 {chosen?<><p>SKU: {chosen.sku||'-'} | {chosen.stock_qty>0?'Tersedia '+chosen.stock_qty:'Stok habis'}</p>{variable&&chosen.image_url&&<img className="vcs-variant-image" src={chosen.image_url} alt={chosen.name}/>}<AddToCart product={{...chosen,parent_slug:variable?product.slug:undefined,brand_name:product.brand_name}}/></>:<p>Pilih seluruh atribut untuk melihat harga dan stok SKU yang tepat.</p>}
 </div><p className="vcs-note">Harga dan ketersediaan diperiksa kembali oleh server saat checkout. Pembayaran belum diaktifkan.</p>
 </div>;
}
