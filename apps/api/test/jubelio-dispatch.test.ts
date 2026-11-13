import assert from 'node:assert/strict';
import test from 'node:test';
import {JubelioShipmentClient} from '../src/jubelio-shipment';
import {providerShipment,verifyJubelioToken,vapmartShipmentReference} from '../src/jubelio-dispatch';
test('shipment contract maps official statuses and refuses unknown authoritative statuses',()=>{
 assert.equal(providerShipment({shipment_id:123,awb:'AWB-123',latest_status:'PICKED_UP'},true).status,'picked');
 assert.throws(()=>providerShipment({shipment_id:'../../evil',latest_status:'DELIVERED'},true));
 assert.throws(()=>providerShipment({shipment_id:123,latest_status:'NEW_UNKNOWN_STATUS'},true));
 assert.throws(()=>providerShipment({shipment_id:123,awb:'<script>'}));
 assert.throws(()=>verifyJubelioToken('invalid'));
});
test('chargeable create is a single POST even on 401, timeout or malformed provider response',async t=>{
 const prior={...process.env};Object.assign(process.env,{JUBELIO_SHIPMENT_CLIENT_ID:'fixture',JUBELIO_SHIPMENT_CLIENT_SECRET:'fixture'});
 let creates=0;const client=new JubelioShipmentClient();
 t.mock.method(globalThis,'fetch',async(url:string)=>{
  if(url.endsWith('/auth/webstore'))return Response.json({token:'fixture',expires_in:3600});
  creates++;return Response.json({message:'provider-secret-error'},{status:401});
 });
 try{await assert.rejects(client.createShipment({ref_no:'fixture'}),e=>!String(e).includes('provider-secret-error'));assert.equal(creates,1);}
 finally{for(const k of Object.keys(process.env))if(!(k in prior))delete process.env[k];Object.assign(process.env,prior);}
});

test('new shipment reference is compact, deterministic and begins with the visible order prefix',()=>{
 const order='25f397b8-564f-46f4-971e-bc1d333ac1d0';
 const batch='a96a6c1d-b6c1-49cd-9a5d-40d813efac23';
 const ref=vapmartShipmentReference(order,batch);
 assert.equal(ref,'VM-25F397B8-A96A6C1DB6C1');
 assert.equal(ref.length,24);
 assert.equal(vapmartShipmentReference(order,batch),ref);
 assert.throws(()=>vapmartShipmentReference('invalid',batch),/Invalid shipment reference IDs/);
});
test('Jubelio shipment readback accepts short references and immutable legacy references',async t=>{
 const previous={...process.env};
 Object.assign(process.env,{JUBELIO_SHIPMENT_CLIENT_ID:'fixture',JUBELIO_SHIPMENT_CLIENT_SECRET:'fixture'});
 const seen:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:string)=>{
  const text=String(url);
  if(text.endsWith('/auth/webstore'))return Response.json({token:'test-only',expires_in:3600});
  seen.push(text);
  const ref=new URL(text).searchParams.get('q');
  return Response.json({data:[{ref_no:ref,shipment_id:1234},{ref_no:'unrelated',shipment_id:12}]});
 });
 try{
  const client=new JubelioShipmentClient();
  const refs=['VM-25F397B8-A96A6C1DB6C1','vapmart-25f397b8-564f-46f4-971e-bc1d333ac1d0'];
  for(const ref of refs){
   const shipments=await client.findShipment(ref);
   assert.equal(shipments.length,1);
   assert.equal(shipments[0].ref_no,ref);
  }
  assert.equal(seen.length,2);
  await assert.rejects(()=>client.findShipment('VM-malformed'),/Invalid shipment reference/);
 }finally{
  for(const name of Object.keys(process.env))if(!(name in previous))delete process.env[name];
  Object.assign(process.env,previous);
 }
});
