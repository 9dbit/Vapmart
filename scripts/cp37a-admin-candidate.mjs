import assert from 'node:assert/strict';
// Browser-only identity and data fixtures. Never a Supabase credential or a live mutation.
export async function verifyAdminCandidate(browser){
 const expiry=Math.floor(Date.now()/1000)+7200;
 const user={id:'bca49deb-d128-4d41-a3ab-8f8e019f095e',aud:'authenticated',role:'authenticated',email:'cp37a-ui@example.invalid',email_confirmed_at:'2026-11-03T00:00:00Z',created_at:'2026-11-03T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{}};
 const session={access_token:'cp37a-test-only-no-real-credential',refresh_token:'cp37a-test-only-refresh',token_type:'bearer',expires_in:7200,expires_at:expiry,user};
 const bid='c48f65c1-d585-440b-b629-3446f7a20001';
 const products=Array.from({length:205},(_,i)=>({id:'c48f65c1-d585-440b-b629-'+String(i+1).padStart(12,'0'),slug:'qa-organizer-'+i,sku:'QA-'+i,name:'Office Organizer '+i,description:'Household office accessory',brand_id:bid,brand_name:'QA Brand',category:'home',price_idr:100000,stock_qty:0,is_active:false,image_url:null,gallery_urls:[],weight_grams:200,length_cm:10,width_cm:10,height_cm:10,edit_version:7}));
 const brand={id:bid,name:'QA Brand',slug:'qa-brand',description:'Fixture brand',logo_url:null,is_active:true,edit_version:3};
 const summary={total:205,existing:0,managed:205,published:0,drafts:205,existing_media_linked:0,existing_media_missing:0,existing_brands:0};
 const records=[{record_id:'managed:'+products[0].id,record_kind:'managed',product_id:products[0].id,slug:products[0].slug,name:products[0].name,brand:brand.name,category:'home',sku:products[0].sku,price_idr:100000,stock_qty:0,is_active:false,historical_price:null,historical_original_price:null,image_url:null,original_path:null,media_id:null,source_snapshot:'product.products',source_updated_at:'2026-11-03T00:00:00Z',read_only:false,missing_fields:['photo'],product:products[0]}];
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(data=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(data)),session);
 let patches=0,seenProductPages=new Set();
 try{
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='127.0.0.1'&&u.hostname!=='localhost')return route.abort();
   if(!u.pathname.startsWith('/api/admin/'))return route.continue();
   const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   const path=u.pathname;
   if(path==='/api/admin/status')return reply({admin:true});
   if(path==='/api/admin/summary')return reply({totals:{managed:205,published:0,lowStock:205,pendingOrders:205,orders:205,brands:1},scope:'database_total'});
   if(path==='/api/admin/products'){
    const page=Number(u.searchParams.get('page')||1);seenProductPages.add(page);
    return reply({items:products.slice((page-1)*100,page*100),page,pageSize:100,total:205,hasMore:page<3});
   }
   if(path==='/api/admin/brands')return reply({items:[brand]});
   if(path==='/api/admin/orders'){
    const page=Number(u.searchParams.get('page')||1);const orders=Array.from({length:205},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),status:'draft',payment_status:'not_initiated',contact_name:'QA buyer',city:'Bandung',total_idr:'100000',created_at:'2026-11-03T00:00:00Z'}));
    return reply({items:orders.slice((page-1)*100,page*100),page,pageSize:100,total:205,hasMore:page<3});
   }
   if(path==='/api/admin/product-records')return reply({items:records,summary,matched:1,facets:{brands:[brand.name],categories:['home'],snapshots:[]},page:1,pageSize:24,pages:1,hasMore:false});
   if(path==='/api/admin/audit-log')return reply({items:[],total:0,page:1,pageSize:20,hasMore:false});
   if(path==='/api/admin/warehouses')return reply({warehouses:[],stock:[]});
   if(path.startsWith('/api/admin/brand-access/')||path.startsWith('/api/admin/brand-invitations/'))return reply({items:[]});
   if(path.startsWith('/api/admin/products/')&&route.request().method()==='PATCH'){
    const body=route.request().postDataJSON();assert.equal(body.expected_version,7,'editor must send the version captured on opening');
    assert.equal(body.name,'My unsaved organizer change');patches++;
    return reply({code:'EDIT_CONFLICT',message:'Data telah diubah operator lain. Draft Anda belum ditimpa.'},409);
   }
   return reply({message:'Unexpected mocked admin endpoint '+path},500);
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:3000/admin?tab=products',{waitUntil:'networkidle'});
  await page.locator('.vpr-row').first().waitFor({timeout:15000});
  assert.deepEqual([...seenProductPages].sort(),[1,2,3],'workspace must read through all 205 product records');
  await page.locator('.vpr-row').first().getByRole('button',{name:'Edit',exact:true}).click();
  const editor=page.locator('form.vma26-editor');
  await editor.getByLabel('Nama produk',{exact:true}).fill('My unsaved organizer change');
  await editor.getByRole('button',{name:'Simpan perubahan',exact:false}).click();
  await page.waitForFunction(()=>document.querySelector('.vma26-message')?.textContent?.includes('operator lain'));
  assert.equal(patches,1);assert.equal(await editor.getByLabel('Nama produk',{exact:true}).inputValue(),'My unsaved organizer change','409 must not discard typed changes');
  await page.getByRole('navigation',{name:'Menu Control Panel'}).getByRole('button',{name:'Gudang & Stok',exact:true}).click();
  await page.getByRole('button',{name:'Stok masuk / keluar',exact:true}).click();
  const skuSelector=page.getByLabel('Produk',{exact:true}).first();
  assert.equal(await skuSelector.locator('option').count(),205,'warehouse chooser includes SKUs beyond the old 150 limit');
  await skuSelector.selectOption(products[204].id);
  assert.equal(await skuSelector.inputValue(),products[204].id);
  await page.screenshot({path:'artifacts/cp37a/admin-warehouse-205-records.png',fullPage:true});
  console.log('CP37A_ADMIN_UI_PASS',{records:205,pages:3,versionSent:7,conflictPreservesDraft:true,warehouseLastSkuSelectable:true,realWrites:false});
 }finally{await context.close();}
}
