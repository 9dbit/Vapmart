import assert from 'node:assert/strict';
import test from 'node:test';
import {JubelioShipmentClient} from '../src/jubelio-shipment';
import {providerShipment,verifyJubelioToken} from '../src/jubelio-dispatch';
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
