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
lamp = dict(id='lamp', name='Lampu meja', slug='lampu', sku='TIC-L01', category='decor',
            image_url=photos[0], gallery_urls=photos[1:], price_idr=95000, stock_qty=5,
            is_active=True, product_type='simple', description='Lampu baca',
            brand_name='TIC', brand_logo_url='/legacy/brands/brand-01.png')
bag = dict(lamp, id='bag', name='Tas kecil', slug='tas', sku='BG-203',
           category='accessories', price_idr=65000)
variant = dict(lamp,id='lamp-blue',sku='TIC-L01-BL',product_type='variation',option_values={'Warna':'Biru'})
family = dict(lamp,slug='lampu-warna',sku=None,product_type='variable',variants=[variant],
              attributes=[{'name':'Warna','values':['Biru']}])
categories = [dict(id=str(i), slug=slug, name=name) for i, (slug,name) in enumerate(
    [('accessories','Accessories'), ('decor','Dekorasi'), ('other','Lainnya')])]

class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/v1/products':
            data = {'items':[lamp, bag]}
        elif path == '/v1/products/lampu':
            data = lamp
        elif path == '/v1/products/lampu-warna':
            data = family
        elif path == '/v1/catalog/categories':
            data = {'items':categories}
        elif path == '/v1/catalog/selection':
            data = {'items':[lamp]}
        elif path.startswith('/v1/catalog/reviews/'):
            data = {'items':[], 'total':0}
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
    search = page.locator('.vm-collection-bar button[aria-label="Cari produk"]')
    sort = page.get_by_label('Urutkan produk')
    tabs = page.locator('.vm-category-tabs')
    all_tab = tabs.get_by_role('button',name='Semua Pilihan')
    expect(page.locator('#shop-search')).to_be_hidden()
    for width in [320,390,768,1280]:
        page.set_viewport_size({'width':width,'height':844})
        for theme in ['light','dark']:
            page.evaluate('(theme)=>document.documentElement.dataset.vapmartColorMode=theme',theme)
            expect(whatsapp).to_have_css('background-color', 'rgb(37, 211, 102)')
            expect(whatsapp).to_have_css('border-top-left-radius', '999px')
            assert same_row(box(tabs),box(search)) and same_row(box(search),box(sort))
            assert box(search)['x'] < box(sort)['x'] < box(all_tab)['x']
            assert box(all_tab)['height'] <= 36
            assert box(sort)['x']+box(sort)['width'] <= width
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            plus=page.locator('.add-circle').first
            p,s=box(plus),box(plus.locator('svg'))
            assert abs(p['width']-p['height'])<1 and same_row(p,s)
            assert abs(p['x']+p['width']/2-s['x']-s['width']/2)<1
    page.set_viewport_size({'width':390,'height':844})
    tabs.get_by_role('button',name='Dekorasi').click()
    expect(page.locator('.product-card')).to_have_count(1)
    assert tabs.get_by_role('button',name='Dekorasi').evaluate("(b)=>getComputedStyle(b).backgroundColor")=='rgb(117, 27, 213)'
    all_tab.click()
    sort.select_option('priceLow')
    expect(page.locator('.product-card h3').first).to_have_text('Tas kecil')
    sort.select_option('priceHigh')
    expect(page.locator('.product-card h3').first).to_have_text('Lampu meja')
    if touch: search.tap()
    else: search.click()
    expect(page.locator('#shop-search')).to_be_focused()
    page.locator('#shop-search').fill('BG-203')
    expect(page.locator('.product-card')).to_have_count(1)
    expect(page.locator('.product-card h3')).to_have_text('Tas kecil')
    page.locator('#shop-search').press('Escape')
    expect(page.locator('#shop-search')).to_be_hidden()
    # Floating menu responds immediately and keeps an SPA document/session.
    mobile_nav = page.locator('nav[aria-label="Navigasi seluler"]')
    expect(mobile_nav).to_have_attribute('data-active-index','1')
    page.evaluate('window.vmNavSessionMarker = true')
    mobile_nav.locator('a[href="/brand-partner"]').click()
    page.wait_for_url('**/brand-partner')
    expect(page.locator('main.vm-brand-page')).to_be_visible()
    expect(mobile_nav).to_have_attribute('data-active-index','2')
    assert page.evaluate('window.vmNavSessionMarker') is True
    mobile_nav.locator('a[href="/member-2"]').click()
    page.wait_for_url('**/member-2')
    expect(page.locator('main.vm21-member-page')).to_be_visible()
    expect(mobile_nav).to_have_attribute('data-active-index','3')
    mobile_nav.locator('a[href="/catalog"]').click()
    page.wait_for_url('**/catalog')
    expect(page.locator('main.vm-catalog-page')).to_be_visible()
    expect(page.get_by_role('heading',name='Produk Pilihan')).to_be_visible()
    # On WebKit the URL can update before the client route finishes committing.
    # Wait for the optimistic state to clear before starting the next navigation.
    page.wait_for_function("""() => document.querySelector('nav[aria-label="Navigasi seluler"]')?.dataset.navPending !== 'true'""")
    expect(mobile_nav).to_have_attribute('data-active-index','1')
    page.goto(base+'/product/lampu-warna',wait_until='networkidle')
    expect(page.get_by_role('button',name='Beli sekarang')).to_be_disabled()
    page.get_by_label('Pilih Warna').select_option('Biru')
    expect(page.get_by_role('button',name='Beli sekarang')).to_be_enabled()
    expect(page.get_by_text('SKU TIC-L01-BL',exact=False)).to_be_visible()
    page.goto(base+'/product/lampu',wait_until='networkidle')
    expect(page.locator('.vm-product-brand img')).to_have_attribute('src',lamp['brand_logo_url'])
    expect(page.get_by_text('SKU TIC-L01',exact=False)).to_be_visible()
    expect(page.locator('.vm-photo-track img')).to_have_count(3)
    page.get_by_role('button',name='Foto berikutnya').click()
    expect(page.locator('.vm-photo-nav span')).to_have_text('2 / 3')
    page.get_by_role('button',name='Tampilkan foto 3').click()
    expect(page.locator('.vm-photo-nav span')).to_have_text('3 / 3')
    for width in [320,390,768,1280]:
        page.set_viewport_size({'width':width,'height':844})
        buy,cart=box(page.locator('.vcs-buy-cta')),box(page.locator('.vcs-cart-cta'))
        assert same_row(buy,cart) and buy['x']+buy['width'] < cart['x']
        assert abs(cart['width']-cart['height'])<1
        assert box(page.get_by_role('heading',name='Review pembeli'))['x']>=16
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    expect(page.get_by_role('link',name='Chat WhatsApp',exact=False)).to_have_attribute('href','https://wa.me/6282146323633')
    page.set_viewport_size({'width':390,'height':844})
    page.get_by_role('button',name='Tambahkan ke keranjang',exact=True).click()
    drawer=page.get_by_role('dialog',name='Keranjang',exact=False)
    expect(drawer).to_contain_text('Lampu meja')
    verify_quantity_controls(drawer,1,touch)
    page.goto(base+'/keranjang-2',wait_until='networkidle')
    verify_quantity_controls(page.locator('.vm21-cart-product'),1,touch)
    page.goto(base+'/product/lampu',wait_until='networkidle')
    page.get_by_role('button',name='Beli sekarang').click()
    page.wait_for_url('**/checkout')
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
    page.route(embed, lambda route: route.fulfill(content_type='application/javascript',body=provider))
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function('window.careLoads === 1')
    expect(page.locator('head #vapmart-chatvice-care')).to_have_count(1)
    print('Chat retry, stalled configuration, image failure, cart, mobile clearance and SPA persistence passed.')

if __name__=='__main__':
    fixture=ThreadingHTTPServer(('127.0.0.1',0),Fixture)
    threading.Thread(target=fixture.serve_forever,daemon=True).start()
    base='http://127.0.0.1:3211'
    env={**os.environ,'API_INTERNAL_URL':f'http://127.0.0.1:{fixture.server_port}'}
    app=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','-p','3211'],cwd='apps/web',env=env)
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
            page.close()
            verify_care(browser.new_page(viewport={'width':390,'height':844}),base)
            browser.close()
            print('Testing iPhone 13 in WebKit')
            webkit=playwright.webkit.launch()
            iphone=webkit.new_context(**playwright.devices['iPhone 13'])
            page=iphone.new_page()
            verify(page,base,touch=True)
            page.close()
            verify_care(iphone.new_page(),base)
            webkit.close()
            print('Chromium and WebKit with iPhone 13 emulation passed.')
    finally:
        app.terminate()
        app.wait(timeout=15)
        fixture.shutdown()
