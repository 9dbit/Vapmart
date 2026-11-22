'use client';
import {useEffect,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';

type Overview={
  status:'REGISTERED'|'ACTIVE'|'SUSPENDED';
  name:string|null;
  balanceCoin:number;
  cardLast4:string|null;
};

/** Compact homepage preview, using live member data.
 * The full, ISO ID-1 Obsidian card remains on the dedicated Member page.
 */
export function HomeMemberCard(){
  const auth=useCustomerAuth();
  const [overview,setOverview]=useState<Overview|null>(null);
  const [loadedFor,setLoadedFor]=useState<string|null>(null);
  useEffect(()=>{
    setOverview(null);
    setLoadedFor(null);
    if(!auth.accessToken)return;
    const controller=new AbortController();
    const token=auth.accessToken;
    fetch('/api/member',{
      headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal
    }).then(async response=>response.ok?await response.json() as Overview:null)
      .then(data=>{if(!controller.signal.aborted){setOverview(data);setLoadedFor(token);}})
      .catch(()=>{if(!controller.signal.aborted){setOverview(null);setLoadedFor(token);}});
    return()=>controller.abort();
  },[auth.accessToken]);
  const account=auth.user;
  const matched=Boolean(auth.accessToken&&loadedFor===auth.accessToken);
  const member=matched?overview:null;
  const status=account?(member?.status??'UNAVAILABLE'):'GUEST';
  const name=account?(account.user_metadata?.display_name||member?.name||account.email?.split('@')[0]||'VAPMART MEMBER'):'VAPMART GUEST';
  const statusLabel=status==='ACTIVE'?'Aktif':status==='REGISTERED'?'Belum Aktif':
    status==='SUSPENDED'?'Ditangguhkan':status==='UNAVAILABLE'?'Mengecek…':'Gabung gratis';
  const coin=member&&Number.isFinite(member.balanceCoin)?Math.max(0,member.balanceCoin).toLocaleString('id-ID'):'—';
  return <aside className="vm-home-member-preview" data-preview-status={status.toLowerCase()} aria-label="Preview status Vapmart Club">
    <div className="vm-club-mini-card">
      <div className="vm-club-mini-top">
        <img src="/branding/vapmart-logo.png" alt="Vapmart" width={100} height={30} loading="lazy"/>
        <span>CLUB</span>
      </div>
      <div className="vm-club-mini-identity">
        <small>MEMBER</small>
        <strong title={String(name)}>{String(name)}</strong>
      </div>
      <div className="vm-club-mini-bottom">
        <span className="vm-club-mini-status">{statusLabel}</span>
        <span className="vm-club-mini-balance" aria-label={'Saldo Coin '+coin}>
          <span className="vm-club-mini-coin" aria-hidden="true">V</span>{coin}
        </span>
      </div>
    </div>
  </aside>;
}
