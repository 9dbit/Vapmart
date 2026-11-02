'use client';
import {useState} from 'react';
export function ArchiveGallery({images,title}:{images:string[];title:string}){
 const [active,setActive]=useState(0);
 return <div className="vm-detail-gallery">
   <div className="vm-detail-hero-image"><img src={images[active]||images[0]} width={600} height={600} alt={title}/></div>
   {images.length>1&&<div className="vm-detail-thumbnails">
    {images.map((src,i)=><button type="button" key={src} onClick={()=>setActive(i)}
      className={'vm-detail-thumb'+(active===i?' is-active':'')} aria-label={'Tampilkan foto '+(i+1)} aria-pressed={active===i}>
      <img src={src} alt="" width={90} height={90}/>
    </button>)}
   </div>}
  </div>;
}
