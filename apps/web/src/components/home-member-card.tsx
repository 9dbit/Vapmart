'use client';
import {useEffect,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import {MemberCard} from '@/components/member-card';

type Overview={
  status:'REGISTERED'|'ACTIVE'|'SUSPENDED';
  name:string|null;
  balanceCoin:number;
  cardLast4:string|null;
};

/** Homepage card uses the same approved design and authenticated wallet data as the member page. */
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
  return <div className="vm-home-member-preview" data-preview-status={status.toLowerCase()}>
    <MemberCard name={String(name)} balance={member?.balanceCoin??null} status={status} cardLast4={member?.cardLast4??null}/>
  </div>;
}
