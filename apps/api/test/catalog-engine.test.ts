import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,csvInteger,csvMeasurement,csvStock,plainDescription,generatedImportSlug} from '../src/catalog-csv';
import {effectivePrice} from '../src/catalog-pricing';
import {attributes,options,priceFields,stockInputs,imageUrl,safeCatalogTerms,slug,sku} from '../src/catalog-validation';
import {cleanProduct} from '../src/products';
import {publicationMissing} from '../src/data-integrity';
import {CatalogAdminController,CatalogCustomerController} from '../src/catalog-controller';
import {AdminGuard,CustomerGuard} from '../src/auth';
import {GUARDS_METADATA} from '@nestjs/common/constants';
test('CP39 CSV parses quotes, BOM, newlines and rejects malformed structure',()=>{
 const p=parseCSV('\uFEFFID,Name,Description\r\n1,"Desk, light","First line\nSecond ""quoted"" line"\r\n');assert.equal(p.rows.length,1);assert.equal(p.rows[0].Name,'Desk, light');assert.match(p.rows[0].Description,/"quoted"/);
 for(const text of ['A,A\n1,2','A,B\n1','A\n"unclosed','A,B\n"hello"x,2'])assert.throws(()=>parseCSV(text));
 assert.equal(csvInteger('','Stock',true),null);assert.equal(csvInteger('0','Stock',true),0);assert.throws(()=>csvInteger('1,000','Stock'));assert.throws(()=>csvInteger('-2','Stock'));
});
test('CSV generated slugs remain valid when a long name is cut at a word boundary',()=>{
 const longName='A'.repeat(99)+' Desk Lamp';
 for(const name of [longName,'収納箱']){
  const value=generatedImportSlug(name,'csv-regression','42');
  assert.equal(slug(value),value);
  assert.ok(value.length<=120);
  assert.equal(value,generatedImportSlug(name,'csv-regression','42'));
  assert.notEqual(value,generatedImportSlug(name,'csv-regression','43'));
 }
 assert.equal(generatedImportSlug('Desk Lamp','csv-regression','42').startsWith('desk-lamp-'),true);
});
test('legacy SKU and decimal dimensions keep their values across catalog validators',()=>{
 for(const code of ['M 60 BT','G-21/G-22','AK-301 / AK301','ITEM-BATIK A'])assert.equal(sku(code),code);
 assert.notEqual(sku('PART A/B'),sku('PART-A-B'),'legacy codes must not be normalized into collisions');
 for(const code of ['<script>','A\tBC','A'.repeat(65)])assert.throws(()=>sku(code));
 const name='Travel organizer '.repeat(10).trim();
 assert.equal(cleanProduct({name,sku:'ITEM / BLUE',length_cm:34.6,width_cm:36.2,height_cm:70.5},true).name,name);
 assert.equal(csvMeasurement('48.8','height_cm'),48.8);assert.equal(csvMeasurement('0','height_cm'),null);
 for(const value of ['1,000','-1','Infinity','NaN','1000.1','0.5'])assert.throws(()=>csvMeasurement(value,'length_cm'));
 assert.throws(()=>csvMeasurement('500.5','weight_grams'));assert.equal(csvMeasurement('500.0','weight_grams'),500);
 assert.equal(csvStock('-27'),-27);assert.equal(csvStock('0'),0);assert.throws(()=>csvStock('-1.5'));assert.throws(()=>csvStock('100000001'));
 assert.deepEqual(publicationMissing({sku:'ITEM / BLUE',description:'Organizer',image_url:'https://example.invalid/a.png',price_idr:100,weight_grams:500,length_cm:34.6,width_cm:36.2,height_cm:70.5}),[]);
});
test('CP39 authoritative promo has explicit start/end boundaries',()=>{
 const p={price_idr:'100000',sale_price_idr:'80000',sale_starts_at:'2026-11-03T00:00:00Z',sale_ends_at:'2026-11-04T00:00:00Z'};
 assert.equal(effectivePrice(p,Date.parse(p.sale_starts_at)-1),100000);assert.equal(effectivePrice(p,Date.parse(p.sale_starts_at)),80000);assert.equal(effectivePrice(p,Date.parse(p.sale_ends_at)),100000);
 assert.equal(effectivePrice({...p,sale_price_idr:null}),100000);assert.throws(()=>priceFields({price_idr:10,sale_price_idr:10}));assert.throws(()=>priceFields({price_idr:10,sale_starts_at:'2026-11-03T00:00:00Z'}));
 assert.ok(priceFields({price_idr:100,sale_price_idr:90,sale_starts_at:new Date('2026-11-03T00:00:00Z')}).sale_starts_at?.endsWith('Z'));
});
test('CP39 attributes limit dimensions and canonicalize combinations',()=>{
 const d=attributes([{name:'Size',values:['S','L']},{name:'Color',values:['Black','White']}]);assert.deepEqual(Object.keys(options({Size:'S',Color:'White'},d)),['Color','Size']);
 assert.throws(()=>options({Size:'S'},d));assert.throws(()=>options({Size:'XL',Color:'White'},d));assert.throws(()=>attributes(Array(4).fill({name:'A',values:['B']})));assert.throws(()=>attributes([{name:'a',values:['x','X']}]));
});
test('CP39 stock input keeps physical counts, optimistic snapshots and notes',()=>{
 const s={warehouseId:'39000000-0000-4000-8000-000000000001',onHand:0,expectedOnHand:5,expectedReserved:0,notes:'Physical count reference'};assert.equal(stockInputs([s])[0].onHand,0);assert.throws(()=>stockInputs([s,s]));assert.throws(()=>stockInputs([{...s,onHand:-1}]));assert.throws(()=>stockInputs([{...s,onHand:1.5}]));
});
test('CP39 data remains text and restricted catalog safeguards remain',()=>{
 assert.equal(imageUrl('/api/media/39000000-0000-4000-8000-000000000001'),'/api/media/39000000-0000-4000-8000-000000000001');assert.throws(()=>imageUrl('javascript:alert(1)'));assert.throws(()=>imageUrl('https://user:pass@example.com/a.png'));
 assert.throws(()=>safeCatalogTerms('nicotine'));assert.throws(()=>safeCatalogTerms({type:'vape'}));assert.equal(plainDescription('<script>bad()</script><p>Plain text</p>').trim(),'Plain text');
});
test('CP39 write controllers keep server guards',()=>{
 assert.ok(Reflect.getMetadata(GUARDS_METADATA,CatalogAdminController).includes(AdminGuard));assert.ok(Reflect.getMetadata(GUARDS_METADATA,CatalogCustomerController).includes(CustomerGuard));
});
