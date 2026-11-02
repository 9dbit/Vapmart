import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import test from 'node:test';
import {BadRequestException,ConflictException,ForbiddenException} from '@nestjs/common';
import {DatabaseService} from '../../src/database';
import {MemberCommerceService} from '../../src/member-commerce';
import {SandboxPaymentsService} from '../../src/sandbox-payments';

test('signed sandbox payment credits wallet once, activates card and rejects duplicates',async()=>{
 const secret='vapmart-integration-test-secret-with-entropy-001';
 const previous={
  DATABASE_URL:process.env.DATABASE_URL,
  RAILWAY_ENVIRONMENT_NAME:process.env.RAILWAY_ENVIRONMENT_NAME,
  PAYMENT_MODE:process.env.PAYMENT_MODE,
  DIGITAL_COMMERCE_ENABLED:process.env.DIGITAL_COMMERCE_ENABLED,
  SANDBOX_WEBHOOK_SECRET:process.env.SANDBOX_WEBHOOK_SECRET
 };
 if(!process.env.DATABASE_URL||!process.env.DATABASE_URL.includes('127.0.0.1'))
   throw new Error('Integration test must use local ephemeral PostgreSQL, never Railway or production');
 process.env.RAILWAY_ENVIRONMENT_NAME='staging';
 process.env.PAYMENT_MODE='sandbox';
 process.env.DIGITAL_COMMERCE_ENABLED='true';
 process.env.SANDBOX_WEBHOOK_SECRET=secret;
 const db=new DatabaseService();
 const member=new MemberCommerceService(db);
 const payments=new SandboxPaymentsService(db);
 const customer={id:randomUUID(),email:'coin-ledger-test@example.invalid',emailVerified:true};
 const event=(orderId:string,status:'paid'|'expired'|'failed',amountIdr:number)=>{
   const body={eventId:'event-'+randomUUID(),orderId,status,amountIdr};
   const raw=Buffer.from(JSON.stringify(body));
   const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
   return {body,raw,signature};
 };
 try{
   const activationKey=randomUUID();
   const activation=await member.createOrder(customer,{sku:'MEMBER-ACTIVATION',idempotencyKey:activationKey});
   assert.equal(activation.status,'pending');
   const replayOrder=await member.createOrder(customer,{sku:'MEMBER-ACTIVATION',idempotencyKey:activationKey});
   assert.equal(replayOrder.id,activation.id,'same idempotency key must not create a second order');
   await assert.rejects(()=>member.createOrder(customer,{sku:'COIN-050',idempotencyKey:activationKey}),ConflictException);

   const good=event(activation.id,'paid',100000);
   assert.equal((await payments.receive(good.body,good.raw,good.signature)).creditedCoins,100000);
   const after=await member.overview(customer);
   assert.equal(after.status,'ACTIVE');
   assert.equal(after.balanceCoin,100000);
   assert.ok(after.cardLast4,'one card must be created after successful activation');
   assert.equal(after.transactions.filter(x=>x.coins===100000).length,1);

   const firstReplay=await payments.receive(good.body,good.raw,good.signature);
   assert.equal(firstReplay.status,'already_paid');
   assert.equal(firstReplay.creditedCoins,0);
   const anotherPaid=event(activation.id,'paid',100000);
   assert.equal((await payments.receive(anotherPaid.body,anotherPaid.raw,anotherPaid.signature)).creditedCoins,0);
   assert.equal((await member.overview(customer)).balanceCoin,100000,'paid callback replay must not mint coins');

   const pack=await member.createOrder(customer,{sku:'COIN-300',idempotencyKey:randomUUID()});
   const packPaid=event(pack.id,'paid',300000);
   assert.equal((await payments.receive(packPaid.body,packPaid.raw,packPaid.signature)).creditedCoins,300000);
   assert.equal((await member.overview(customer)).balanceCoin,400000);

   const failed=await member.createOrder(customer,{sku:'COIN-100',idempotencyKey:randomUUID()});
   const badEvent=event(failed.id,'failed',100000);
   assert.equal((await payments.receive(badEvent.body,badEvent.raw,badEvent.signature)).creditedCoins,0);
   assert.equal((await member.overview(customer)).balanceCoin,400000);

   const expired=await member.createOrder(customer,{sku:'COIN-050',idempotencyKey:randomUUID()});
   const expiry=event(expired.id,'expired',50000);
   await payments.receive(expiry.body,expiry.raw,expiry.signature);
   assert.equal((await member.overview(customer)).balanceCoin,400000);

   const pending=await member.createOrder(customer,{sku:'COIN-500',idempotencyKey:randomUUID()});
   const mismatched=event(pending.id,'paid',100000);
   await assert.rejects(()=>payments.receive(mismatched.body,mismatched.raw,mismatched.signature),BadRequestException);
   const matching=event(pending.id,'paid',500000);
   await assert.rejects(()=>payments.receive(matching.body,matching.raw,'sha256='+'0'.repeat(64)),ForbiddenException);
   assert.equal((await member.getOrder(customer,pending.id)).status,'pending');
   assert.equal((await member.overview(customer)).balanceCoin,400000);

   await assert.rejects(
      ()=>member.createOrder(customer,{sku:'MEMBER-ACTIVATION',idempotencyKey:randomUUID()}),
      ConflictException
   );
   const rows=await db.query<{n:string}>(
     "SELECT count(*)::text AS n FROM wallet.ledger_entries WHERE user_id=$1 AND entry_type='credit'",
     [customer.id]);
   assert.equal(Number(rows.rows[0].n),2,'activation and one topup create exactly two immutable credit ledger rows');
 }finally{
   await db.onModuleDestroy();
   for(const [name,value] of Object.entries(previous)){
     if(value===undefined)delete process.env[name];
     else process.env[name]=value;
   }
 }
});
