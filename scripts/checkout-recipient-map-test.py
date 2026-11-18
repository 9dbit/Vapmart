from playwright.sync_api import sync_playwright
from urllib.parse import urlparse,parse_qs
import json
product={'id':'qa','name':'Produk QA','sku':'QA','stock_qty':5,'price_idr':201000,'is_active':True}
with sync_playwright() as pw:
 b=pw.chromium.launch(channel='chrome',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844})
 page.on('pageerror',lambda e:print('page error',e))
 page.add_init_script("localStorage.setItem('vapmart-staging-cart-v1',"+json.dumps(json.dumps([{'product':product,'quantity':1}]))+")")
 quotes=[]
 def api(r):
  u=urlparse(r.request.url); path=u.path
  if path.endswith('/areas'):
   q=parse_qs(u.query); level=q['level'][0]; d={'items':[{'id':level,'parentId':q.get('parentId',[''])[0],'name':'Wilayah pengujian dengan nama yang sangat panjang','postalCode':'40375'}]}
  elif path.endswith('/estimate'):
   quotes.append(r.request.post_data_json);d={'rates':[{'courierName':'Nama kurir dengan keterangan sangat panjang','serviceName':'Layanan pengujian panjang','priceIdr':8200,'courierCode':'SIM','serviceCode':'REG'}]}
  elif '/shipping/config' in path:d={'rateLookupEnabled':True,'requiresArea':True}
  elif path.endswith('/selection'):d={'items':[product]}
  elif path.endswith('/quote'):d={'items':[],'subtotalIdr':201000,'discountIdr':0}
  else:d={'methods':['bank_transfer']}
  r.fulfill(json=d)
 page.route('**/api/**',api)
 page.route('https://photon.komoot.io/**',lambda r:r.fulfill(json={'features':[{'geometry':{'coordinates':[107.6,-7]}}]}))
 page.route('https://tile.openstreetmap.org/**',lambda r:r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'))
 page.goto('http://127.0.0.1:3208/checkout',wait_until='domcontentloaded')
 for i,k in enumerate(['provinces','cities','districts','areas']):page.locator('.vm-address-grid select').nth(i).select_option(k)
 page.locator('.vco26-courier-select select').wait_for()
 for w in [320,375,390,768,1280]:
  page.set_viewport_size({'width':w,'height':844})
  for mode in ['light','dark']:
   page.evaluate("(m)=>document.documentElement.dataset.vapmartColorMode=m",mode)
   assert page.locator('.vco26-form select').evaluate_all("""els=> els.length===5 && els.every(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return s.paddingRight==='42px' && s.appearance==='none' && s.backgroundPosition.includes('15px') && r.right<=p.right+1 && r.left>=p.left-1 && r.right<=innerWidth})"""),(w,mode)
  print('dropdown pass',w,flush=True)
 page.set_viewport_size({'width':390,'height':844})
 page.get_by_role('button',name='Tentukan titik antar di peta').click()
 page.locator('.leaflet-container').click(position={'x':120,'y':80})
 page.get_by_role('button',name='Konfirmasi titik antar').click()
 page.wait_for_timeout(1000)
 assert quotes[-1].get('destinationPin',{}).get('confirmed') is True,quotes
 first=quotes[-1]['destinationPin']
 page.get_by_role('button',name='Sesuaikan titik antar').click()
 page.locator('.leaflet-container').click(position={'x':130,'y':75})
 page.get_by_role('button',name='Konfirmasi titik antar').click()
 page.wait_for_timeout(800)
 assert quotes[-1]['destinationPin']!=first
 page.locator('.vco26-form textarea').first.fill('Alamat baru')
 page.wait_for_timeout(800)
 assert 'destinationPin' not in quotes[-1]
 print('map confirm, change, reset: passed')
