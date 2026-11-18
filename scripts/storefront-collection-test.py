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
    page.goto(base+'/catalog',wait_until='networkidle')
    expect(page.get_by_role('heading',name='Produk Pilihan')).to_be_visible()
    search = page.locator('.vm-collection-bar button[aria-label="Cari produk"]')
    sort = page.get_by_label('Urutkan produk')
    tabs = page.locator('.vm-category-tabs')
    expect(page.locator('#shop-search')).to_be_hidden()
    for width in [320,390,768,1280]:
        page.set_viewport_size({'width':width,'height':844})
        for theme in ['light','dark']:
            page.evaluate('(theme)=>document.documentElement.dataset.vapmartColorMode=theme',theme)
            assert same_row(box(tabs),box(search)) and same_row(box(search),box(sort))
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
    tabs.get_by_role('button',name='Semua produk').click()
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
    print('Catalog filters, drawer, sort, geometry, gallery, cart, checkout and WhatsApp passed.')

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
            browser=playwright.chromium.launch(channel='chrome',args=['--no-sandbox','--disable-dev-shm-usage'])
            verify(browser.new_page(viewport={'width':390,'height':844}),base)
            browser.close()
            webkit=playwright.webkit.launch()
            iphone=webkit.new_context(**playwright.devices['iPhone 13'])
            verify(iphone.new_page(),base,touch=True)
            webkit.close()
            print('Chromium and WebKit with iPhone 13 emulation passed.')
    finally:
        app.terminate()
        app.wait(timeout=15)
        fixture.shutdown()
