'use client';
import {useWishlist} from '@/lib/wishlist';

export function FavoriteButton({id,name,className=''}:{id:string;name:string;className?:string}){
  const {has,toggle}=useWishlist();
  const selected=has(id);
  return <button type="button"
    className={`vm-favorite-button ${selected?'is-saved':''} ${className}`.trim()}
    aria-label={selected?`Hapus ${name} dari favorit`:`Simpan ${name} ke favorit`}
    aria-pressed={selected} title={selected?'Hapus dari favorit':'Simpan ke favorit'}
    onClick={()=>toggle(id)}>
    <svg width="21" height="21" viewBox="0 0 24 24" fill={selected?'currentColor':'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>
    </svg>
  </button>;
}
