'use client';
import {useEffect,useState} from 'react';

type ReviewResult={average:number;total:number};

/** Show only the actual, approved review aggregate from the catalog API. */
export function ProductReviewSummary({slug}:{slug:string}){
  const [summary,setSummary]=useState<ReviewResult|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    setSummary(null);
    fetch('/api/catalog/reviews/'+encodeURIComponent(slug)+'?page=1&pageSize=10',{signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Ulasan tidak tersedia');
        return await response.json() as ReviewResult;
      }).then(data=>{
        if(!controller.signal.aborted&&Number.isFinite(data.average)&&Number.isInteger(data.total)
          &&data.average>=0&&data.average<=5&&data.total>0){
          setSummary({average:data.average,total:data.total});
        }
      }).catch(()=>{/* No fabricated placeholder when ratings are unavailable. */});
    return()=>controller.abort();
  },[slug]);
  if(!summary)return null;
  return <a className="vpd-review-brief" href="#ulasan" aria-label={summary.average.toFixed(1)+' dari 5 bintang berdasarkan '+summary.total+' ulasan pembeli'}>
    <span className="vpd-review-star" aria-hidden="true">★</span>
    <strong>{summary.average.toFixed(1)}</strong>
    <span>({summary.total.toLocaleString('id-ID')} ulasan)</span>
    <span aria-hidden="true" className="vpd-review-chevron">›</span>
  </a>;
}
