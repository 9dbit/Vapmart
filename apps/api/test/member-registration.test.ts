import test from 'node:test';
import assert from 'node:assert/strict';
import {BadRequestException,ForbiddenException} from '@nestjs/common';
import {MemberCommerceService,validateFreeRegistration} from '../src/member-commerce';
import type {DatabaseService} from '../src/database';

const user={id:'00000000-0000-4000-8000-000000000123',email:'member@example.invalid',emailVerified:true};
const valid={name:'Test Member',whatsapp:'0852-3232-4824',address:'Jalan Merdeka 25, Bandung, Jawa Barat'};
test('free signup collects profile fields without price, order or Coin amount',()=>{
 assert.deepEqual(validateFreeRegistration(valid),valid);
 assert.throws(()=>validateFreeRegistration({name:'A',whatsapp:'08',address:'Jalan'}),BadRequestException);
 assert.throws(()=>validateFreeRegistration({...valid,priceIdr:100000}),BadRequestException);
 assert.throws(()=>validateFreeRegistration({...valid,whatsapp:'javascript:alert(1)'}),BadRequestException);
 assert.throws(()=>validateFreeRegistration({...valid,address:'a'.repeat(301)}),BadRequestException);
});
test('registered customer becomes ACTIVE for free, idempotently, without wallet ledger or payments',async()=>{
 let status:string|undefined;
 const queries:string[]=[];
 const client={query:async(sql:string)=>{
  queries.push(sql);
  if(sql.startsWith('SELECT status FROM membership.accounts'))return {rows:status?[{status}]:[]};
  if(sql.includes('INSERT INTO membership.accounts')||sql.includes("UPDATE membership.accounts SET status='ACTIVE'"))status='ACTIVE';
  return {rows:[],rowCount:1};
 }};
 const db={configured:true,transaction:async<T>(fn:(c:typeof client)=>Promise<T>)=>fn(client)} as unknown as DatabaseService;
 const member=new MemberCommerceService(db);
 const first=await member.completeFreeRegistration(user,valid);
 const second=await member.completeFreeRegistration(user,valid);
 assert.equal(first.status,'ACTIVE');assert.equal(second.status,'ACTIVE');
 assert.equal(first.creditedCoins,0);
 assert.equal(second.creditedCoins,0);
 assert.equal(queries.filter(q=>q.includes('INSERT INTO membership.accounts')).length,1);
 assert.equal(queries.filter(q=>q.includes('INSERT INTO membership.cards')).length,2);
 assert.ok(queries.every(q=>!q.includes('wallet.ledger_entries')&&!q.includes('commerce.digital_orders')&&!q.includes('commerce.payment_events')));
});
test('email verification required and suspended membership cannot be reactivated',async()=>{
 const client={query:async(sql:string)=>sql.startsWith('SELECT status FROM membership.accounts')?{rows:[{status:'SUSPENDED'}]}:{rows:[],rowCount:1}};
 const db={configured:true,transaction:async<T>(fn:(c:typeof client)=>Promise<T>)=>fn(client)} as unknown as DatabaseService;
 const member=new MemberCommerceService(db);
 await assert.rejects(()=>member.completeFreeRegistration({...user,emailVerified:false},valid),ForbiddenException);
 await assert.rejects(()=>member.completeFreeRegistration(user,valid),ForbiddenException);
});
