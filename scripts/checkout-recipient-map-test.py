from playwright.sync_api import sync_playwright,expect
from urllib.parse import urlparse,parse_qs
import json
base='http://127.0.0.1:3208'
product={'id':'qa','name':'Produk QA','sku':'QA','stock_qty':5,'price_idr':201000,'is_active':True}
with sync_playwright() as pw:
 b=pw.chromium.launch(channel='chrome',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844})
 page_errors=[]
 page.on('pageerror',lambda e:page_errors.append(str(e)))
 page.add_init_script("if(location.origin==="+json.dumps(base)+"){localStorage.setItem('vapmart-staging-cart-v1',"+json.dumps(json.dumps([{'product':product,'quantity':1}]))+")}")
 quotes=[]
 unexpected=[]
 def api(r):
  u=urlparse(r.request.url); path=u.path
  # Fixtures apply only to app data requests, never JavaScript or external APIs.
  if r.request.resource_type not in ('fetch','xhr'):
   unexpected.append((r.request.method,path,r.request.resource_type));r.abort();return
  if path=='/api/shipping/areas' and r.request.method=='GET':
   q=parse_qs(u.query); level=q['level'][0]; d={'items':[{'id':level,'parentId':q.get('parentId',[''])[0],'name':'Wilayah pengujian dengan nama yang sangat panjang','postalCode':'40375'}]}
  elif path=='/api/shipping/estimate' and r.request.method=='POST':
   assert 'authorization' not in r.request.headers,'Guest estimates must not require authentication'
   quotes.append(r.request.post_data_json);d={'rates':[{'courierName':'Nama kurir dengan keterangan sangat panjang','serviceName':'Layanan pengujian panjang','priceIdr':8200,'courierCode':'SIM','serviceCode':'REG'}]}
  elif path=='/api/shipping/config' and r.request.method=='GET':d={'rateLookupEnabled':True,'requiresArea':True}
  elif path=='/api/catalog/selection' and r.request.method=='GET':d={'items':[product]}
  elif path=='/api/checkout/quote' and r.request.method=='POST':d={'items':[],'subtotalIdr':201000,'discountIdr':0}
  elif path=='/api/checkout/config' and r.request.method=='GET':d={'paymentEnabled':False,'methods':['bank_transfer']}
  else:
   unexpected.append((r.request.method,path));r.fulfill(status=404,json={'message':'Unexpected CP57 fixture request'});return
  r.fulfill(json=d)
 page.route(base+'/api/**',api)
 # The old **/api/** route returned JSON for Chatvice's script and caused a
 # syntax error. Keep this unrelated provider isolated with valid JavaScript.
 page.route('https://chatvice.app/api/widget/chatvice.js?**',lambda r:r.fulfill(content_type='application/javascript',body='/* Chat disabled in the recipient map fixture. */'))
 page.route('https://photon.komoot.io/**',lambda r:r.fulfill(json={'features':[{'geometry':{'coordinates':[107.6,-7]}}]}))
 page.route('https://tile.openstreetmap.org/**',lambda r:r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'))
 page.goto(base+'/checkout',wait_until='domcontentloaded')
 manual=page.locator('.vco-checkout-manual-region')
 manual.get_by_text('Ubah wilayah secara manual',exact=True).click()
 for label,k in [('Provinsi','provinces'),('Kota / Kabupaten','cities'),('Kecamatan / Distrik','districts'),('Kelurahan / Desa','areas')]:
  select=manual.get_by_role('combobox',name=label,exact=True)
  expect(select).to_be_visible()
  select.select_option(k)
  expect(select).to_have_value(k)
 expect(manual.get_by_label('Kode pos',exact=True)).to_have_value('40375')
 expect(page.get_by_role('combobox',name='Pilih kurir dan layanan')).to_be_visible()
 assert quotes and quotes[-1]['destinationAreaId']=='areas' and quotes[-1]['destinationPostalCode']=='40375',quotes
 assert 'destinationPin' not in quotes[-1],quotes
 for w in [320,375,390,768,1280]:
  page.set_viewport_size({'width':w,'height':844})
  for mode in ['light','dark']:
   page.evaluate("(m)=>document.documentElement.dataset.vapmartColorMode=m",mode)
   assert page.locator('.vco26-form select').evaluate_all("""els=> els.length===5 && els.every(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return s.paddingRight==='42px' && s.appearance==='none' && s.backgroundPosition.includes('15px') && r.right<=p.right+1 && r.left>=p.left-1 && r.right<=innerWidth})"""),(w,mode)
  print('dropdown pass',w,flush=True)
 page.set_viewport_size({'width':390,'height':844})
 page.get_by_role('button',name='Tentukan titik antar di peta').click()
 # Wait for the mocked region lookup to position the real Leaflet map before
 # choosing a point; initial Indonesia zoom is not a recipient location.
 page.locator('.leaflet-tile-loaded[src*="/14/"]').first.wait_for(state='attached')
 page.locator('.leaflet-container').click(position={'x':120,'y':80})
 def is_estimate(request):
  return request.method=='POST' and request.url==base+'/api/shipping/estimate'
 with page.expect_request(is_estimate) as confirmed:
  page.get_by_role('button',name='Konfirmasi titik antar').click()
 first=confirmed.value.post_data_json.get('destinationPin',{})
 assert first.get('confirmed') is True,first
 assert -11.5<=first['latitude']<=6.5 and 94.5<=first['longitude']<=141.5,first
 page.get_by_role('button',name='Sesuaikan titik antar').click()
 page.locator('.leaflet-container').click(position={'x':130,'y':75})
 with page.expect_request(is_estimate) as changed:
  page.get_by_role('button',name='Konfirmasi titik antar').click()
 next_pin=changed.value.post_data_json.get('destinationPin',{})
 assert next_pin.get('confirmed') is True and next_pin!=first,next_pin
 with page.expect_request(is_estimate) as reset:
  page.get_by_label('Detail alamat',exact=True).fill('Alamat baru')
 assert 'destinationPin' not in reset.value.post_data_json
 assert not unexpected,unexpected
 assert not page_errors,page_errors
 print('map confirm, change, reset: passed')
 b.close()
