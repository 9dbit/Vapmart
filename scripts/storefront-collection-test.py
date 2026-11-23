"""Responsive catalog regression using an isolated API and the built Next.js app."""
import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from urllib.request import urlopen
from time import sleep
from playwright.sync_api import sync_playwright, expect

photos = [f'/legacy/products/archived-0{i}.png' for i in range(3)]
lamp = dict(id='00000000-0000-4000-8000-000000000001', name='Lampu meja', slug='lampu', sku='TIC-L01', category='decor',
            image_url=photos[0], gallery_urls=photos[1:], price_idr=95000, regular_price_idr=125000,
            promo_active=True, cod_available=True, stock_qty=5,
            is_active=True, product_type='simple', description='Lampu baca',
            brand_id='00000000-0000-4000-8000-000000000011',brand_name='TIC', brand_logo_url='/legacy/brands/brand-01.png')
bag = dict(lamp, id='00000000-0000-4000-8000-000000000002', name='Tas kecil', slug='tas', sku='BG-203',
           category='accessories', price_idr=65000, regular_price_idr=65000, brand_id=None, brand_name=None, brand_logo_url=None,
           promo_active=False, cod_available=False, stock_qty=0)
variant = dict(lamp,id='00000000-0000-4000-8000-000000000003',sku='TIC-L01-BL',product_type='variation',option_values={'Warna':'Biru'})
family = dict(lamp,slug='lampu-warna',sku=None,product_type='variable',variants=[variant],
              attributes=[{'name':'Warna','values':['Biru']}])
categories = [dict(id=str(i), slug=slug, name=name) for i, (slug,name) in enumerate(
    [('accessories','Accessories'), ('decor','Dekorasi'), ('other','Lainnya')])]

class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/v1/hero-banners':
            data = {'items':[dict(key=f'hero-{i}', desktop=f'/legacy/banners/desktop-0{i}.png',
                                  mobile=f'/legacy/banners/mobile-0{i}.png',label=f'Promo {i}')
                             for i in [1,2,3]]}
        elif path == '/v1/products':
            data = {'items':[lamp, bag]}
        elif path == '/v1/brands':
            data = {'items':[dict(id='00000000-0000-4000-8000-000000000011',slug='tic',
                                   name='TIC',logo_url='/legacy/brands/brand-01.png',
                                   description='Lampu dan aksesori rumah',is_active=True)]}
        elif path == '/v1/products/lampu':
            data = lamp
        elif path == '/v1/products/lampu-warna':
            data = family
        elif path == '/v1/catalog/categories':
            data = {'items':categories}
        elif path == '/v1/catalog/selection':
            data = {'items':[lamp]}
        elif path.startswith('/v1/catalog/reviews/'):
            data = {'items':[], 'total':0,'average':0,'hasMore':False}
        elif path == '/v1/shipping/config':
            data = {'provider':'jubelio','rateLookupEnabled':False,'requiresArea':True,'originLabel':'Gudang Vapmart'}
        elif path == '/v1/checkout/config':
            data = {'paymentEnabled':False,'providerConnected':False,'methods':['bank_transfer']}
        else:
            data = {'items':[]}
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, *args):
        pass

def box(locator):
    return locator.bounding_box()

def same_row(a,b):
    return abs((a['y']+a['height']/2)-(b['y']+b['height']/2)) < 2

def verify_quantity_controls(container, start, touch):
    controls=container.locator('.vm21-drawer-qty')
    count=controls.locator('span')
    increase=controls.get_by_role('button',name='Tambah Lampu meja',exact=True)
    decrease=controls.get_by_role('button',name='Kurangi Lampu meja',exact=True)
    expect(count).to_have_text(str(start))
    for button in [increase,decrease]:
        frame,icon=box(button),box(button.locator('svg'))
        assert abs(frame['width']-frame['height'])<1 and same_row(frame,icon)
        assert abs(frame['x']+frame['width']/2-icon['x']-icon['width']/2)<1
    if touch: increase.tap()
    else: increase.click()
    expect(count).to_have_text(str(start+1))
    if touch: decrease.tap()
    else: decrease.click()
    expect(count).to_have_text(str(start))

def verify(page,base,touch=False):
    page.on('pageerror',lambda e: print('CHECKOUT_PAGEERROR',str(e),flush=True))
    page.on('console',lambda e: print('CHECKOUT_CONSOLE',e.type,e.text[:600],flush=True) if e.type=='error' else None)
    embed = 'https://chatvice.app/api/widget/chatvice.js?merchant=m_d74410c444e2726c'
    # Exercise the real header load without sending fixture visitors to the merchant.
    page.route(embed, lambda route: route.fulfill(content_type='application/javascript',
               body='window.careLoads = (window.careLoads || 0) + 1;'))
    page.goto(base+'/catalog',wait_until='networkidle')
    expect(page.get_by_role('heading',name='Produk Pilihan')).to_be_visible()
    script = page.locator('head script#vapmart-chatvice-care')
    expect(script).to_have_count(1)
    expect(script).to_have_attribute('src', embed)
    assert page.evaluate('window.careLoads') == 1
    whatsapp = page.get_by_role('link',name='Chat WhatsApp',exact=False)
    expect(whatsapp).to_have_attribute('href','https://wa.me/6285232324824')
    expect(whatsapp).to_contain_text('+62 852-3232-4824')
    header_search = page.locator('header .vm-search-disclosure summary')
    header_cart = page.locator('header .vm-reference-cart')
    header_theme = page.locator('header .vm23-theme-trigger')
    header_account = page.locator('header .vm-reference-login')
    favorite = page.get_by_role('button',name='Tampilkan hanya produk favorit')
    sort = page.get_by_label('Urutkan produk')
    tabs = page.locator('.vm-category-tabs')
    all_tab = tabs.get_by_role('button',name='Semua Pilihan')
    expect(page.locator('#shop-search')).to_be_hidden()
    expect(page.locator('.vm-collection-bar button[aria-label="Cari produk"]')).to_have_count(0)
    expect(page.get_by_role('button',name='Tampilkan hanya produk siap dibeli')).to_have_count(0)
    lamp_card = page.locator('.vm-product-card').filter(has=page.locator('h3',has_text='Lampu meja'))
    bag_card = page.locator('.vm-product-card').filter(has=page.locator('h3',has_text='Tas kecil'))
    expect(lamp_card.locator('h3')).to_have_text('Lampu meja')
    expect(lamp_card.locator('.vm-product-regular-price')).to_have_count(1)
    assert '125.000' in lamp_card.locator('.vm-product-regular-price').inner_text()
    assert '95.000' in lamp_card.locator('.vm-product-tile-price strong').inner_text()
    expect(lamp_card.locator('.vm-product-current-price .vm-price-currency')).to_have_text('Rp')
    expect(lamp_card.locator('.vm-product-current-price .vm-price-amount')).to_have_text('95.000')
    assert lamp_card.locator('.vm-product-tile-price').evaluate(
        "(e)=>e.firstElementChild.classList.contains('vm-product-current-price')")
    expect(lamp_card.locator('.vm-product-regular-price')).to_have_css('text-decoration-line','line-through')
    expect(lamp_card.get_by_text('COD',exact=True)).to_be_visible()
    expect(bag_card.locator('.vm-product-cod-label')).to_have_count(0)
    expect(bag_card.locator('.vm-product-regular-price')).to_have_count(0)
    expect(bag_card.locator('.vm-stock-out-label')).to_have_text('Stok Habis')
    expect(bag_card.locator('.vm-stock-out-label')).to_have_css('color','rgb(255, 255, 255)')
    expect(bag_card.locator('.vm-stock-out-label')).to_have_css('background-color','rgb(227, 38, 76)')
    expect(bag_card.get_by_role('button',name='Tambahkan Tas kecil ke keranjang')).to_be_disabled()
    for card in [lamp_card,bag_card]:
        expect(card.locator('.product-copy .eyebrow')).to_have_count(0)
        for unwanted in ['hemat s.d.','terjual','Cianjur']:
            assert unwanted.lower() not in card.inner_text().lower(), unwanted
    for width in [320,390,768,1280]:
        page.set_viewport_size({'width':width,'height':844})
        for theme in ['light','dark']:
            page.evaluate('(theme)=>document.documentElement.dataset.vapmartColorMode=theme',theme)
            expect(whatsapp).to_have_css('background-color', 'rgb(37, 211, 102)')
            expect(whatsapp).to_have_css('border-top-left-radius', '999px')
            assert same_row(box(tabs),box(favorite)) and same_row(box(favorite),box(sort))
            assert box(favorite)['x'] < box(sort)['x'] < box(all_tab)['x']
            assert abs(box(favorite)['height']-36) < 1
            # Header actions follow the catalog favorite's 36px circular size.
            for action in [header_cart,header_theme]:
                frame=box(action)
                assert abs(frame['height']-36)<1 and abs(frame['width']-36)<1,(width,frame)
            if width<=1100:
                expect(header_search).to_be_visible()
                frame=box(header_search)
                assert abs(frame['height']-36)<1 and abs(frame['width']-36)<1,(width,frame)
            if width<=767:
                frame=box(header_account)
                assert abs(frame['height']-36)<1 and abs(frame['width']-36)<1,(width,frame)
            else:
                assert abs(box(header_account)['height']-36)<1
            assert abs(box(favorite)['width']-box(favorite)['height']) < 1
            assert abs(box(sort)['height']-36) < 1
            for category_pill in tabs.locator('button').all():
                assert abs(box(category_pill)['height']-36) < 1
            assert box(sort)['x']+box(sort)['width'] <= width
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            for card in [lamp_card,bag_card]:
                image_stage=box(card.locator('.product-art'))
                assert abs(image_stage['width']-image_stage['height'])<1,(width,theme,image_stage)
                assert card.locator('.product-art img').evaluate("(e)=>getComputedStyle(e).objectFit")=='contain'
                assert image_stage['x']>=-1 and image_stage['x']+image_stage['width']<=width+1
            # Screenshot benchmark: readable medium-weight two-line name, dominant
            # purple price, small muted crossed original price on the same price row.
            title=lamp_card.locator('.product-copy h3')
            current=lamp_card.locator('.vm-product-current-price')
            currency=lamp_card.locator('.vm-price-currency')
            previous=lamp_card.locator('.vm-product-regular-price')
            expected_title_size=12.5 if width<360 else 13 if width<=767 else 14 if width<1024 else 14.5
            expected_price_size=15 if width<360 else 16 if width<=767 else 18 if width<1024 else 19
            title_style=title.evaluate("(e)=>({size:parseFloat(getComputedStyle(e).fontSize),weight:parseInt(getComputedStyle(e).fontWeight),lineHeight:parseFloat(getComputedStyle(e).lineHeight),color:getComputedStyle(e).color})")
            price_style=current.evaluate("(e)=>({size:parseFloat(getComputedStyle(e).fontSize),weight:parseInt(getComputedStyle(e).fontWeight),color:getComputedStyle(e).color})")
            assert abs(title_style['size']-expected_title_size)<.1,(width,title_style)
            assert 450<=title_style['weight']<=550,(width,title_style)
            assert 1.3<=title_style['lineHeight']/title_style['size']<=1.5,(width,title_style)
            assert abs(price_style['size']-expected_price_size)<.1,(width,price_style)
            assert price_style['weight']>=700,(width,price_style)
            assert price_style['size']>title_style['size'],(width,title_style,price_style)
            assert price_style['color']==('rgb(197, 139, 255)' if theme=='dark' else 'rgb(123, 25, 214)'),(width,theme,price_style)
            assert title_style['color']==('rgb(241, 236, 247)' if theme=='dark' else 'rgb(48, 43, 54)'),(width,theme,title_style)
            assert float(currency.evaluate("(e)=>parseFloat(getComputedStyle(e).fontSize)")) < price_style['size']
            assert float(previous.evaluate("(e)=>parseFloat(getComputedStyle(e).fontSize)")) < title_style['size']
            assert previous.evaluate("(e)=>getComputedStyle(e).color")==('rgb(175, 162, 187)' if theme=='dark' else 'rgb(144, 138, 151)')
            # Tiny screens may wrap the original price; at regular and desktop
            # widths it must follow the selling price, never precede it.
            assert box(previous)['y']>=box(current)['y']-1
            assert box(previous)['x']>=box(current)['x'] or box(previous)['y']>box(current)['y']+2
            first_archive=page.locator('.vm-restored-reference-card .vm-archive-image').first
            if first_archive.count():
                b=box(first_archive)
                assert abs(b['width']-b['height'])<1,(width,theme,b)
            plus=page.locator('.add-circle').first
            p,s=box(plus),box(plus.locator('svg'))
            assert abs(p['width']-p['height'])<1 and same_row(p,s)
            assert abs(p['x']+p['width']/2-s['x']-s['width']/2)<1
    page.set_viewport_size({'width':390,'height':844})
    tabs.get_by_role('button',name='Dekorasi').click()
    expect(page.locator('.product-card')).to_have_count(1)
    assert tabs.get_by_role('button',name='Dekorasi').evaluate("(b)=>getComputedStyle(b).backgroundColor")=='rgb(117, 27, 213)'
    # Favorite filter is a circular heart directly to the left of Sort/Filter.
    page.get_by_role('button',name='Simpan Lampu meja ke favorit').click()
    favorite.click()
    expect(favorite).to_have_attribute('aria-pressed','true')
    expect(page.locator('.product-card')).to_have_count(1)
    tabs.get_by_role('button',name='Accessories').click()
    expect(page.locator('.product-card')).to_have_count(0)
    all_tab.click()
    expect(page.locator('.product-card')).to_have_count(1)
    favorite.click()
    expect(favorite).to_have_attribute('aria-pressed','false')
    expect(page.locator('.product-card')).to_have_count(2)
    sort.select_option('priceLow')
    expect(page.locator('.product-card h3').first).to_have_text('Tas kecil')
    sort.select_option('priceHigh')
    expect(page.locator('.product-card h3').first).to_have_text('Lampu meja')
    # Search remains in the header; no second icon below Produk Pilihan.
    if touch: header_search.tap()
    else: header_search.click()
    page.locator('#vm-popover-search').fill('BG-203')
    page.locator('#vm-popover-search').press('Enter')
    page.wait_for_url('**/catalog?q=BG-203')
    expect(page.locator('#shop-search')).to_be_visible()
    expect(page.locator('#shop-search')).to_have_value('BG-203')
    expect(page.locator('.product-card')).to_have_count(1)
    expect(page.locator('.product-card h3')).to_have_text('Tas kecil')
    page.locator('#shop-search').press('Escape')
    expect(page.locator('#shop-search')).to_be_hidden()
    expect(page.locator('.product-card')).to_have_count(2)
    # Floating menu has five destinations, responds immediately and retains
    # the same Next.js document/session across account, favorites and orders.
    mobile_nav = page.locator('nav[aria-label="Navigasi seluler"]')
    expect(mobile_nav.locator('a')).to_have_count(5)
    expect(mobile_nav).to_have_attribute('data-active-index','1')
    page.evaluate('window.vmNavSessionMarker = true')
    mobile_nav.locator('a[href="/favorit"]').click()
    page.wait_for_url('**/favorit')
    expect(page.locator('main[data-page="favorites"]')).to_be_visible()
    expect(mobile_nav).to_have_attribute('data-active-index','2')
    assert page.evaluate('window.vmNavSessionMarker') is True
    mobile_nav.locator('a[href="/pesanan"]').click()
    page.wait_for_url('**/pesanan')
    expect(page.locator('main[data-page="transactions"]')).to_be_visible()
    expect(mobile_nav).to_have_attribute('data-active-index','3')
    expect(page.get_by_role('heading',name='Masuk untuk melihat transaksi')).to_be_visible()
    mobile_nav.locator('a[href="/akun"]').click()
    page.wait_for_url('**/akun')
    expect(page.locator('main[data-page="account"]')).to_be_visible()
    expect(mobile_nav).to_have_attribute('data-active-index','4')
    mobile_nav.locator('a[href="/catalog"]').click()
    page.wait_for_url('**/catalog')
    expect(page.locator('main.vm-catalog-page')).to_be_visible()
    expect(page.get_by_role('heading',name='Produk Pilihan')).to_be_visible()
    # WebKit can update URL before client navigation commits.
    page.wait_for_function("""() => document.querySelector('nav[aria-label="Navigasi seluler"]')?.dataset.navPending !== 'true'""")
    expect(mobile_nav).to_have_attribute('data-active-index','1')
    # Product-detail V3: inline variants and sheet, square swipe gallery,
    # visible thumbnail navigation, sticky tabs and safe-area actions.
    page.goto(base+'/product/lampu-warna',wait_until='networkidle')
    expect(page.locator('main[data-product-detail-upgrade="v3"]')).to_be_visible()
    expect(page.get_by_role('region',name='Pilihan varian produk')).to_be_visible()
    expect(page.locator('.vpd-purchase-bar .vpd-buy')).to_be_enabled()
    page.locator('.vpd-purchase-bar .vpd-buy').click()
    variant_sheet=page.get_by_role('dialog',name='Pilih varian')
    expect(variant_sheet).to_be_visible()
    expect(variant_sheet.get_by_role('button',name='Beli Sekarang')).to_be_disabled()
    variant_sheet.get_by_role('button',name='Biru',exact=True).click()
    expect(variant_sheet.get_by_role('button',name='Beli Sekarang')).to_be_enabled()
    expect(page.get_by_text('SKU TIC-L01-BL',exact=False)).to_be_visible()
    variant_sheet.get_by_role('button',name='Tutup panel').click()
    expect(variant_sheet).to_have_count(0)
    page.goto(base+'/product/lampu',wait_until='networkidle')
    expect(page.locator('.vpd-brand img')).to_have_attribute('src',lamp['brand_logo_url'])
    expect(page.get_by_text('SKU TIC-L01',exact=False)).to_be_visible()
    expect(page.locator('.vpd-selling-price')).to_contain_text('95.000')
    expect(page.locator('.vpd-price-row del')).to_contain_text('125.000')
    expect(page.locator('.vpd-media-track img')).to_have_count(3)
    page.locator('.vpd-media-track').evaluate("(e)=>e.scrollTo({left:e.clientWidth,behavior:'instant'})")
    expect(page.locator('.vpd-media-count')).to_have_text('2/3')
    expect(page.get_by_role('button',name='Lihat foto 2 dari 3')).to_have_attribute('aria-pressed','true')
    page.locator('.vpd-media-track').evaluate("(e)=>e.scrollTo({left:e.clientWidth*2,behavior:'instant'})")
    expect(page.locator('.vpd-media-count')).to_have_text('3/3')
    expect(page.get_by_role('button',name='Foto berikutnya',exact=True)).to_be_disabled()
    page.get_by_role('button',name='Lihat foto 1 dari 3').click()
    expect(page.locator('.vpd-media-count')).to_have_text('1/3')
    expect(page.get_by_role('button',name='Lihat foto 1 dari 3')).to_have_attribute('aria-pressed','true')
    expect(page.locator('.vpd-tabs button')).to_have_count(3)
    expect(page.get_by_role('heading',name='Ulasan pembeli')).to_be_visible()
    expect(page.get_by_text('Belum ada ulasan pembeli terverifikasi')).to_be_visible()
    expect(page.get_by_role('heading',name='Mungkin kamu suka ini')).to_be_visible()
    assert page.locator('.vpd-reco-item').count()==0,'Never fabricate recommendations'
    shipping=page.locator('.vpd-info-row').filter(has_text='Pengiriman')
    shipping.click()
    shipping_sheet=page.get_by_role('dialog',name='Detail pengiriman')
    expect(shipping_sheet).to_be_visible()
    expect(shipping_sheet.get_by_role('link',name='Masuk Akun')).to_be_visible()
    assert shipping_sheet.get_by_text('Rp0').count()==0,'No fake free shipping'
    shipping_sheet.get_by_role('button',name='Tutup panel').click()
    for width in [320,390,768,1280]:
        page.set_viewport_size({'width':width,'height':844})
        for theme in ['light','dark']:
            page.evaluate('(t)=>document.documentElement.dataset.vapmartColorMode=t',theme)
            buy,cart=box(page.locator('.vpd-purchase-bar .vpd-buy')),box(page.locator('.vpd-purchase-bar .vpd-add'))
            assert same_row(buy,cart) and buy['x']+buy['width'] <= cart['x']
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,theme)
            track=box(page.locator('.vpd-media-track'))
            assert abs(track['width']-track['height'])<1,(width,track)
            expect(page.locator('.vpd-media-stage')).to_have_css('border-radius','0px')
            expect(page.locator('.vpd-media-track img').first).to_have_css('object-fit','contain')
            price_size=page.locator('.vpd-selling-price').evaluate("(e)=>parseFloat(getComputedStyle(e).fontSize)")
            # V3 uses 24px on narrow phones and at least 25px on other phones.
            assert price_size >= (24 if width<360 else 25 if width<=767 else 26),(width,price_size)
            tabs_top=box(page.locator('.vpd-tabs'))
            assert tabs_top['x']>=-1 and tabs_top['x']+tabs_top['width']<=width+1
            purchase=box(page.locator('.vpd-purchase-bar'))
            assert purchase['y']+purchase['height']>=843
            assert purchase['x']>=-1 and purchase['x']+purchase['width']<=width+1
            if width<=767:
                expect(page.locator('.vm-photo-nav')).to_have_count(0)
                expect(page.locator('.vpd-media-thumbs')).to_be_visible()
                expect(page.locator('.vpd-media-thumb')).to_have_count(3)
                expect(page.locator('nav[aria-label="Navigasi seluler"]')).to_be_hidden()
    page.set_viewport_size({'width':390,'height':844})
    # Quantity controls for non-variable products are immediately accessible.
    counter=page.locator('.vpd-simple-quantity')
    counter.get_by_role('button',name='Tambah jumlah').click()
    expect(counter.locator('output')).to_have_text('2')
    page.locator('.vpd-purchase-bar .vpd-add').click()
    drawer=page.get_by_role('dialog',name='Keranjang',exact=False)
    expect(drawer).to_contain_text('Lampu meja')
    verify_quantity_controls(drawer,2,touch)
    page.goto(base+'/keranjang-2',wait_until='networkidle')
    verify_quantity_controls(page.locator('.vm21-cart-product'),2,touch)
    page.goto(base+'/product/lampu',wait_until='networkidle')
    page.locator('.vpd-purchase-bar .vpd-buy').click()
    page.wait_for_url('**/checkout?buyNow=*')
    expect(page.locator('main.vco26-root')).to_be_visible()
    try:
        expect(page.locator('.vco26-summary')).to_be_visible(timeout=10000)
        expect(page.locator('.vco26-summary')).to_contain_text('Lampu meja',timeout=12000)
        expect(page.locator('.vco26-summary')).to_contain_text('Beli Sekarang')
        expect(page.locator('.vco26-summary')).to_contain_text('1 item')
    except Exception:
        # Capture the real failure state rather than assuming checkout is ready
        # solely because the browser URL changed.
        print('CHECKOUT_DIAG', json.dumps({
            'url':page.url,
            'mainText':page.locator('main').first.inner_text()[:1800] if page.locator('main').count() else 'NO_MAIN',
            'bodyText':page.locator('body').inner_text()[:2200],
            'cartStorage':page.evaluate("localStorage.getItem('vapmart-staging-cart-v1')"),
            'summaryCount':page.locator('.vco26-summary').count(),
            'readyState':page.evaluate('document.readyState')
        }),flush=True)
        raise
    assert page.evaluate('window.careLoads') == 1
    page.goto(base+'/brand/login', wait_until='load')
    expect(script).to_have_count(0)
    assert page.evaluate('window.careLoads || 0') == 0
    page.evaluate('window.staffDocument = true')
    page.get_by_role('link', name='Kembali ke Vapmart').click()
    page.wait_for_function('window.careLoads === 1')
    expect(script).to_have_count(1)
    assert page.evaluate('window.staffDocument') is True
    print('Catalog filters, drawer, sort, geometry, gallery, cart, checkout and WhatsApp passed.')


def verify_home(page, base):
    page.goto(base+'/',wait_until='domcontentloaded')
    categories=page.locator('.vm-trendora-category')
    expect(categories.first).to_be_visible()
    hero=page.locator('.vm-trendora-hero .vm-carousel-shell')
    expect(hero).to_be_visible()
    expect(hero.locator('.vm-carousel-slide')).to_have_count(3)
    expect(hero.locator('.vm-carousel-dots button')).to_have_count(3)
    expect(hero.locator('.vm-carousel-arrow')).to_have_count(0)
    expect(hero.locator('.vm-carousel-pause')).to_have_count(0)
    expect(hero.locator('.vm-favorite-button')).to_have_count(0)
    # Carousel still navigates with tiny dots after removing arrows and play UI.
    hero.get_by_role('button',name='Tampilkan banner 2').click()
    expect(hero.get_by_role('button',name='Tampilkan banner 2')).to_have_attribute('aria-pressed','true')
    expect(page.locator('.vm-home-member-preview .vmoc-card')).to_be_visible()
    expect(page.locator('.vm-home-member-preview [data-member-card-design="obsidian-premium"]')).to_have_count(1)
    expect(page.locator('.vm-home-member-preview .vmoc-brand-watermark')).to_have_count(1)
    expect(page.locator('.vm-home-member-preview .vm22-card-coin-value strong')).to_have_text('—')
    for label in ['Materi banner terdahulu','EXPLORE MORE','Temukan favorit baru',
                  'Lihat semua','Tampilan Vapmart dipulihkan']:
        assert label.lower() not in page.locator('main').inner_text().lower(),label
    assert page.locator('.vm-trendora-categories h2:not(.sr-only)').count()==0
    for width in [320,390,768,1280]:
        page.set_viewport_size({'width':width,'height':844})
        for theme in ['light','dark']:
            page.evaluate('(value)=>document.documentElement.dataset.vapmartColorMode=value',theme)
            # A home card lacks the catalog's legacy-product-wrapper. Its
            # absolute favorite must stay inside that card, never over the hero.
            expect(page.locator('.vm-product-card')).to_have_count(2)
            for product_card in page.locator('.vm-product-card').all():
                card_bounds=box(product_card)
                heart_bounds=box(product_card.locator('.vm-cp17-card-favorite'))
                assert heart_bounds['x']>=card_bounds['x']-1 and heart_bounds['y']>=card_bounds['y']-1,(width,theme,card_bounds,heart_bounds)
                assert heart_bounds['x']+heart_bounds['width']<=card_bounds['x']+card_bounds['width']+1,(width,theme,card_bounds,heart_bounds)
                assert heart_bounds['y']+heart_bounds['height']<=card_bounds['y']+card_bounds['height']+1,(width,theme,card_bounds,heart_bounds)
            dots=box(hero.locator('.vm-carousel-dots'))
            assert dots['height'] <= 30 and dots['width'] < 90,(width,theme,dots)
            account=page.locator('header .vm-reference-login')
            expect(account).to_be_visible()
            expect(account).to_have_attribute('aria-label','Akun Saya')
            if width<=767:
                assert abs(box(account)['width']-box(account)['height']) < 2,(width,box(account))
            category_image=categories.first.locator('.vm-trendora-category-image')
            frame=box(category_image)
            assert abs(frame['width']-frame['height']) < 1,frame
            assert category_image.evaluate('(e)=>getComputedStyle(e).borderRadius') == '50%'
            card=box(page.locator('.vm-home-member-preview .vmoc-card'))
            assert abs(card['width']/card['height'] - 85.6/53.98) < .025,card
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
    # Favorite tabs & brand list: no invented ratings or cities, only published fixture brands.
    page.goto(base+'/favorit?tab=brand',wait_until='networkidle')
    expect(page.locator('main[data-page="favorites"]')).to_be_visible()
    expect(page.get_by_role('tab',name='Brand Favorit')).to_have_attribute('aria-selected','true')
    expect(page.get_by_role('heading',name='Belum ada brand favorit')).to_be_visible()
    expect(page.locator('.vm26-brand-discover .vm26-brand-row')).to_have_count(1)
    page.locator('.vm26-brand-discover').get_by_role('button',name='Simpan TIC ke favorit').click()
    expect(page.locator('.vm26-brand-list .vm26-brand-row').first).to_contain_text('TIC')
    expect(page.get_by_role('button',name='Hapus TIC dari favorit')).to_be_visible()
    page.locator('.vm26-brand-row a[href^="/catalog?brand="]').first.click()
    page.wait_for_url('**/catalog?brand=*')
    expect(page.locator('.product-card')).to_have_count(1)
    expect(page.locator('.product-card h3')).to_have_text('Lampu meja')
    # Test product favorites route using existing heart control.
    if page.get_by_role('button',name='Simpan Lampu meja ke favorit').count():
        page.get_by_role('button',name='Simpan Lampu meja ke favorit').click()
    page.goto(base+'/favorit',wait_until='networkidle')
    expect(page.locator('.vm26-fav-product')).to_have_count(1)
    expect(page.get_by_role('button',name='Hapus Lampu meja dari favorit')).to_be_visible()
    page.goto(base+'/pesanan',wait_until='networkidle')
    expect(page.get_by_role('heading',name='Masuk untuk melihat transaksi')).to_be_visible()
    assert page.get_by_text('Rp1.605.914').count()==0,'Never invent transactions'
    for width in [320,390,768,1280]:
        page.set_viewport_size({'width':width,'height':844})
        for theme in ['light','dark']:
            page.evaluate('(t)=>document.documentElement.dataset.vapmartColorMode=t',theme)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),('transactions',width,theme)
            page.goto(base+'/favorit',wait_until='domcontentloaded')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),('favorites',width,theme)
            if width<=767:
                expect(page.locator('nav[aria-label="Navigasi seluler"] a')).to_have_count(5)
                assert box(page.locator('nav[aria-label="Navigasi seluler"]'))['width']<=width
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base+'/akun',wait_until='domcontentloaded')
    expect(page.get_by_role('heading',name='Akun Saya',exact=True)).to_be_visible()
    expect(page.get_by_role('link',name='Daftar Gratis')).to_be_visible()
    assert page.locator('.vm-account-panel .vm-new-member-card').count()==0
    page.get_by_role('link',name='Daftar Gratis').click()
    expect(page.get_by_role('heading',name='Buat akun baru')).to_be_visible()
    expect(page.get_by_role('textbox',name='Nomor WhatsApp')).to_be_visible()
    expect(page.get_by_role('textbox',name='Alamat lengkap')).to_be_visible()
    assert page.get_by_role('button',name='Aktivasi Member · Rp100.000').count()==0
    print('Homepage minimal controls, accessible carousel, header account access and free signup passed.')

def verify_care(page, base):
    embed = 'https://chatvice.app/api/widget/chatvice.js?merchant=m_d74410c444e2726c'
    page.unroute(embed)
    attempts = []
    provider = """
        window.careLoads = (window.careLoads || 0) + 1;
        const launcher = document.createElement('button');
        launcher.id = 'chatvice-widget-button';
        launcher.textContent = 'Chatvice';
        launcher.style.cssText = 'position:fixed;right:20px;bottom:20px;width:60px;height:60px;display:none;opacity:0;z-index:99996';
        const frame = document.createElement('iframe');
        frame.id = 'chatvice-widget-frame';
        frame.style.display = 'none';
        document.body.append(launcher, frame);
        window.chatvice = {open: () => {frame.style.display='block'; launcher.style.display='none';}};
        launcher.onclick = window.chatvice.open;
    """
    def provider_route(route):
        attempts.append(1)
        if len(attempts) == 1:
            route.abort()
        else:
            route.fulfill(content_type='application/javascript', body=provider)
    page.route(embed, provider_route)
    page.goto(base+'/catalog', wait_until='domcontentloaded')
    fallback = page.get_by_role('link', name='Buka chat Vapmart Care')
    expect(fallback).to_be_visible()
    assert box(fallback)['width']<=46,'Chatvice fallback must stay compact'
    page.wait_for_function('window.careLoads === 1')
    assert len(attempts) == 2
    expect(page.locator('head #vapmart-chatvice-care')).to_have_count(1)
    # A stalled configuration leaves the vendor launcher hidden. The fallback still opens chat.
    fallback.click()
    frame = page.locator('#chatvice-widget-frame')
    expect(frame).to_be_visible()
    expect(fallback).to_be_hidden()
    # Config recovery replaces the fallback with the vendor launcher.
    page.evaluate("""() => {
        document.getElementById('chatvice-widget-frame').style.display='none';
        const launcher=document.getElementById('chatvice-widget-button');
        launcher.style.display='block';launcher.style.opacity='1';
    }""")
    launcher = page.locator('#chatvice-widget-button')
    expect(launcher).to_be_visible()
    expect(fallback).to_be_hidden()
    page.set_viewport_size({'width':390,'height':844})
    nav=page.locator('.legacy-mobile-nav')
    assert box(launcher)['y']+box(launcher)['height'] < box(nav)['y']
    page.locator('.add-circle').first.click()
    expect(launcher).to_have_css('visibility','visible')
    assert box(launcher)['y']+box(launcher)['height'] < box(page.locator('.vm21-drawer-footer'))['y']
    page.locator('.vm21-drawer-close').click()
    # SPA navigation must retain the same widget session and load the script only once.
    page.get_by_role('link',name='Lihat Lampu meja',exact=True).click()
    page.wait_for_url('**/product/lampu')
    assert page.evaluate('window.careLoads') == 1
    expect(launcher).to_be_visible()
    # A broken custom icon cannot make the only chat entry invisible.
    page.evaluate("""() => {
        const launcher=document.getElementById('chatvice-widget-button');
        launcher.textContent='';
        const img=document.createElement('img');
        img.src='/missing-care-icon.png';launcher.append(img);
    }""")
    expect(fallback).to_be_visible()
    # Complete script outage keeps a usable link to this merchant's chat.
    page.unroute(embed)
    outages = []
    def unavailable(route):
        outages.append(1)
        route.fulfill(status=503, content_type='text/plain', body='Unavailable')
    page.route(embed, unavailable)
    page.reload(wait_until='domcontentloaded')
    expect(fallback).to_be_visible()
    expect(fallback).to_have_attribute('href','https://chatvice.app/widget/m_d74410c444e2726c')
    for _ in range(150):
        if len(outages) == 3: break
        page.wait_for_timeout(50)
    assert len(outages) == 3
    expect(page.locator('head #vapmart-chatvice-care')).to_have_count(0)
    # A subsequent page load recovers normally.
    page.unroute(embed)
    # WebKit in the Linux CI container can crash when immediately reloading the
    # renderer after three simulated script failures. Verify recovery on a new
    # page in the same browser context, as a customer would on a fresh visit.
    recovery_page = page.context.new_page() if page.context.browser.browser_type.name == 'webkit' else page
    recovery_page.route(embed, lambda route: route.fulfill(content_type='application/javascript',body=provider))
    if recovery_page is page:
        recovery_page.reload(wait_until='domcontentloaded')
    else:
        recovery_page.goto(base+'/catalog',wait_until='domcontentloaded')
    recovery_page.wait_for_function('window.careLoads === 1')
    expect(recovery_page.locator('head #vapmart-chatvice-care')).to_have_count(1)
    if recovery_page is not page:
        recovery_page.close()
    print('Chat retry, stalled configuration, image failure, cart, mobile clearance and SPA persistence passed.')

if __name__=='__main__':
    fixture=ThreadingHTTPServer(('127.0.0.1',0),Fixture)
    threading.Thread(target=fixture.serve_forever,daemon=True).start()
    base='http://127.0.0.1:3211'
    env={**os.environ,'API_INTERNAL_URL':f'http://127.0.0.1:{fixture.server_port}'}
    app=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3211'],cwd='apps/web',env=env)
    try:
        for _ in range(60):
            try:
                with urlopen(base+'/api/health',timeout=1): break
            except OSError: sleep(0.5)
        with sync_playwright() as playwright:
            print('Testing Chromium')
            browser=playwright.chromium.launch(args=['--no-sandbox','--disable-dev-shm-usage'])
            page=browser.new_page(viewport={'width':390,'height':844})
            verify(page,base)
            verify_home(page,base)
            page.close()
            verify_care(browser.new_page(viewport={'width':390,'height':844}),base)
            browser.close()
            print('Testing iPhone 13 in WebKit')
            webkit=playwright.webkit.launch()
            iphone=webkit.new_context(**playwright.devices['iPhone 13'])
            page=iphone.new_page()
            verify(page,base,touch=True)
            verify_home(page,base)
            page.close()
            iphone.close()
            webkit.close()
            # Keep WebKit widget retry/reload QA in an isolated browser process:
            # storefront navigation and test images otherwise accumulate memory.
            webkit=playwright.webkit.launch()
            iphone=webkit.new_context(**playwright.devices['iPhone 13'])
            widget_page=iphone.new_page()
            verify_care(widget_page,base)
            widget_page.close()
            iphone.close()
            webkit.close()
            print('Chromium and WebKit with iPhone 13 emulation passed.')
    finally:
        app.terminate()
        app.wait(timeout=15)
        fixture.shutdown()
