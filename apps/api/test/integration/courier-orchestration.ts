import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {DatabaseService} from '../../src/database';
import {ProductsService} from '../../src/products';
import {WarehouseService} from '../../src/warehouses';
import {FulfillmentService} from '../../src/fulfillment';
import {CourierManifestService} from '../../src/courier-manifests';
import {CourierEventService} from '../../src/courier-events';
import {CourierReturnService} from '../../src/courier-returns';

test('CP36: provider events, manifest, handover ledger, customer returns and restock all use disposable Postgres',async()=>{
 if(!process.env.DATABASE_URL?.includes('127.0.0.1'))
  throw new Error('CP36 integration MUST NOT connect to external or Railway DB');
 const db=new DatabaseService(),products=new ProductsService(db),warehouse=new WarehouseService(db),
  fulfill=new FulfillmentService(db),manifest=new CourierManifestService(db),
  events=new CourierEventService(db),returns=new CourierReturnService(db);
 const admin={id:randomUUID(),email:'cp36-admin@example.invalid',emailVerified:true};
 const customer={id:randomUUID(),email:'cp36-buyer@example.invalid',emailVerified:true};
 const other={id:randomUUID(),email:'cp36-other@example.invalid',emailVerified:true};
 const suffix=randomUUID().slice(0,7).toUpperCase();
 const header='x-vapmart-biteship-secret';
 const secret='disposable-ci-courier-secret-which-is-long-and-random';
 try{
  const brand=(await db.query<{id:string}>('INSERT INTO product.brands(name,slug) VALUES($1,$2) RETURNING id',
    ['Courier Test '+suffix,'cp36-brand-'+suffix.toLowerCase()])).rows[0];
  const p=await products.create({name:'Foldable Organizer '+suffix,slug:'cp36-organizer-'+suffix.toLowerCase(),
    sku:'CP36-'+suffix,category:'home',description:'Non restricted household utility',price_idr:50000,stock_qty:0,
    brand_id:brand.id,weight_grams:300,length_cm:10,width_cm:10,height_cm:10},admin);
  const w=(await warehouse.create(admin,{code:'CP36-'+suffix,name:'Courier Test Warehouse',
   address:'Jalan Warehouse Demo 123',city:'Bandung',province:'Jawa Barat',postalCode:'40115'})).warehouse;
  await db.query('UPDATE product.warehouses SET contact_name=$2,contact_phone=$3 WHERE id=$1',[w.id,'Warehouse Operator','081234567890']);
  await warehouse.adjust(admin,{warehouseId:w.id,productId:p.id,delta:5,reason:'receipt',
   notes:'Physical test warehouse receiving #36',idempotencyKey:randomUUID()});
  await warehouse.update(admin,w.id,{dispatchEnabled:true});
  const orderId=randomUUID();
  await db.query(
   "INSERT INTO product.orders(id,customer_user_id,status,payment_status,payment_provider,payment_reference,contact_name,contact_phone,address_line,city,province,postal_code) VALUES($1,$2,'paid','paid','ci-fixture-only',$3,$4,$5,$6,$7,$8,$9)",
   [orderId,customer.id,'verified-ci-'+suffix,'Courier Buyer','08122222222','Jalan Buyer 456','Bandung','Jawa Barat','40115']);
  await db.query(
   'INSERT INTO product.order_items(order_id,product_id,brand_id,quantity,unit_price_idr,product_name,sku) VALUES($1,$2,$3,2,50000,$4,$5)',
   [orderId,p.id,brand.id,p.name,p.sku]);
  const batch=(await fulfill.prepare(admin,orderId,{idempotencyKey:randomUUID()})).batches[0];
  assert.ok(batch.id);
  await assert.rejects(()=>manifest.prepare(admin,batch.id,{idempotencyKey:randomUUID(),notes:'Packed for courier pickup'}),/packed and ready/);
  for(const [state,notes] of [['picking','Operator picked parcel'],['packed','Operator packed parcel'],['ready_for_carrier','Packed and ready for courier']] as const)
   await fulfill.transition(admin,batch.id,{state,notes});
  const preview=await manifest.preview(batch.id);
  assert.ok(preview.bookingBlockers.includes('WAREHOUSE_SPECIFIC_COURIER_QUOTE_REQUIRED'));
  assert.ok(preview.bookingBlockers.includes('EXTERNAL_BOOKING_DISABLED'));
  const command={idempotencyKey:randomUUID(),notes:'Verified packing list and pickup request',pickupMethod:'pickup' as const,
   pickupDate:null,pickupTime:null};
  const created=await manifest.prepare(admin,batch.id,command);
  const repeated=await manifest.prepare(admin,batch.id,command);
  assert.equal(created.replayed,false);assert.equal(repeated.replayed,true);
  assert.equal(created.manifestId,repeated.manifestId);
  assert.equal((await manifest.packingSlip(batch.id)).type,'INTERNAL_PACKING_SLIP_NOT_COURIER_LABEL');
  await assert.rejects(()=>manifest.blockBooking(),/External carrier requests/);
  const noShip=await db.query<{n:number}>('SELECT count(*)::integer AS n FROM product.shipments WHERE order_id=$1',[orderId]);
  assert.equal(noShip.rows[0].n,0,'manifest may NOT create provider shipment');
  await assert.rejects(()=>returns.request(customer,{batchId:batch.id,idempotencyKey:randomUUID(),
   reason:'Received wrong parcel'}),/provider-confirmed delivered/);
  // Strictly CI fixture. No Biteship API request, label, payment or customer communication is sent.
  const providerId='biteship-ci-'+suffix;
  await db.query("INSERT INTO product.shipments(order_id,brand_id,provider,fulfillment_batch_id,provider_shipment_id,state) VALUES($1,$2,'biteship_test',$3,$4,'booked')",
   [orderId,brand.id,batch.id,providerId]);
  const before=await db.query<{on_hand:number;reserved:number}>(
   'SELECT on_hand,reserved FROM product.warehouse_stock WHERE warehouse_id=$1 AND product_id=$2',[w.id,p.id]);
  assert.equal(before.rows[0].on_hand,5);assert.equal(before.rows[0].reserved,2);
  const oldFlag=process.env.BITESHIP_WEBHOOK_ENABLED,oldHeader=process.env.BITESHIP_WEBHOOK_HEADER_NAME,
   oldSecret=process.env.BITESHIP_WEBHOOK_HEADER_SECRET;
  process.env.BITESHIP_WEBHOOK_ENABLED='true';
  process.env.BITESHIP_WEBHOOK_HEADER_NAME=header;
  process.env.BITESHIP_WEBHOOK_HEADER_SECRET=secret;
  const post=(event:Record<string,unknown>)=>events.ingest({[header]:secret},Buffer.from(JSON.stringify({order_id:providerId,...event})));
  try{
   await assert.rejects(()=>events.ingest({},Buffer.from(JSON.stringify({order_id:providerId,event:'order.status',status:'picked'}))),/Untrusted courier webhook/);
   const first=await post({event:'order.status',status:'picked',courier_waybill_id:'AWB-CI-36'});
   assert.equal(first.replayed,false);assert.equal(first.applied,true);
   const repeat=await post({event:'order.status',status:'picked',courier_waybill_id:'AWB-CI-36'});
   assert.equal(repeat.replayed,true);
   const after=await db.query<{on_hand:number;reserved:number}>(
    'SELECT on_hand,reserved FROM product.warehouse_stock WHERE warehouse_id=$1 AND product_id=$2',[w.id,p.id]);
   assert.equal(after.rows[0].on_hand,3);assert.equal(after.rows[0].reserved,0);
   const hand=await db.query<{n:number}>(
    "SELECT count(*)::integer AS n FROM product.warehouse_stock_events WHERE batch_id=$1 AND reason='fulfilled'",[batch.id]);
   assert.equal(hand.rows[0].n,1,'carrier handover must decrement warehouse exactly once');
   const price=await post({event:'order.price',price:9000,status:'picked'});
   assert.equal(price.reconcilePrice,true);assert.equal(price.chargedCustomer,false);
   await post({event:'order.status',status:'in_transit'});
   await post({event:'order.waybill_id',courier_waybill_id:'AWB-CI-36'});
   await post({event:'order.status',status:'delivered'});
   const stale=await post({event:'order.status',status:'allocated'});
   assert.equal(stale.applied,false);
   const ship=await db.query<{state:string;tracking_number:string;status_rank:number}>(
    'SELECT state,tracking_number,status_rank FROM product.shipments WHERE provider_shipment_id=$1',[providerId]);
   assert.equal(ship.rows[0].state,'delivered');assert.equal(ship.rows[0].tracking_number,'AWB-CI-36');
   assert.equal(ship.rows[0].status_rank,6);
   const userTracking=await events.customerEvents(customer.id,orderId);
   assert.equal(userTracking.externalTrackingConnected,true);
   await assert.rejects(()=>events.customerEvents(other.id,orderId),/Order not found/);
   const request={batchId:batch.id,idempotencyKey:randomUUID(),reason:'Courier delivered damaged accessory'};
   await assert.rejects(()=>returns.request(other,request),/does not belong/);
   const rma=await returns.request(customer,request);
   assert.equal(rma.replayed,false);
   assert.equal((await returns.request(customer,request)).replayed,true);
   await returns.review(admin,rma.returnId,{decision:'approved',notes:'Approved after inspecting photos'});
   await returns.receive(admin,rma.returnId,{warehouseId:w.id,notes:'Physical return counted in damaged packaging'});
   const stockBefore=await db.query<{on_hand:number}>(
    'SELECT on_hand FROM product.warehouse_stock WHERE warehouse_id=$1 AND product_id=$2',[w.id,p.id]);
   assert.equal(stockBefore.rows[0].on_hand,3,'received does not auto restock');
   const restock={idempotencyKey:randomUUID(),notes:'Inspected and approved resale quality'};
   const done=await returns.restock(admin,rma.returnId,restock);
   assert.equal(done.restockedUnits,2);assert.equal(done.refundIssued,false);
   assert.equal((await returns.restock(admin,rma.returnId,restock)).replayed,true);
   await assert.rejects(()=>returns.restock(admin,rma.returnId,{...restock,idempotencyKey:randomUUID()}),/already restocked/);
   const final=await db.query<{on_hand:number;reserved:number}>(
    'SELECT on_hand,reserved FROM product.warehouse_stock WHERE warehouse_id=$1 AND product_id=$2',[w.id,p.id]);
   assert.equal(final.rows[0].on_hand,5);assert.equal(final.rows[0].reserved,0);
   const refund=await db.query<{payment_status:string}>('SELECT payment_status FROM product.orders WHERE id=$1',[orderId]);
   assert.equal(refund.rows[0].payment_status,'paid','RMA does NOT issue payment refunds');
  }finally{
   if(oldFlag===undefined)delete process.env.BITESHIP_WEBHOOK_ENABLED;else process.env.BITESHIP_WEBHOOK_ENABLED=oldFlag;
   if(oldHeader===undefined)delete process.env.BITESHIP_WEBHOOK_HEADER_NAME;else process.env.BITESHIP_WEBHOOK_HEADER_NAME=oldHeader;
   if(oldSecret===undefined)delete process.env.BITESHIP_WEBHOOK_HEADER_SECRET;else process.env.BITESHIP_WEBHOOK_HEADER_SECRET=oldSecret;
  }
 }finally{await db.onModuleDestroy();}
});
