/** Vapmart delivery sheet V4 UX and checkout action regression.
 * Run at repository root: node scripts/shipping-detail-v4-smoke.mjs
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const detail=readFileSync('apps/web/src/components/product-detail-experience.tsx','utf8');
const shipping=readFileSync('apps/web/src/components/shipping-quote.tsx','utf8');
const styles=readFileSync('apps/web/src/app/product-shipping-v4.css','utf8');
const layout=readFileSync('apps/web/src/app/layout.tsx','utf8');
const addressPicker=readFileSync('apps/web/src/components/indonesia-address-picker.tsx','utf8');
const chatCSS=readFileSync('apps/web/src/app/chatvice-bottom-anchor.css','utf8');

assert.match(detail,/import \{ShippingQuote\} from '@\/components\/shipping-quote'/,'separate shipping quote component');
assert.match(detail,/<ShippingQuote product=\{chosen\} quantity=\{quantity\}\/\>/);
assert.match(detail,/vpd-shipping-sheet/,'dedicated delivery sheet class');
assert.match(detail,/vpd-shipping-header/,'shipping-only header');
assert.match(detail,/vpd-shipping-close/,'close button on leading edge');
assert.match(detail,/setSheet\('shipping'\)/,'shipping row must open sheet');
assert.match(detail,/router\.push\('\/checkout\?buyNow='/,'Buy Now route is not rewritten');
assert.match(detail,/cart\.add\(active,quantity\)/,'add-to-cart is preserved');
assert.match(detail,/function openChat\(/,'WhatsApp action must remain wired');
assert.match(shipping,/vpd-ship-route/);
assert.match(shipping,/Dikirim ke/);
assert.match(shipping,/Ubah alamat/);
assert.match(shipping,/setEditing\(value=>!value\)/,'address editor toggles on request');
assert.match(shipping,/IndonesiaAddressPicker initialValue=\{region\|\|undefined\}/);
assert.match(shipping,/setEditing\(false\)/,'completed address auto-collapses form');
assert.match(shipping,/localStorage\.setItem\(key,JSON\.stringify\(next\)\)/,'region persisted per user');
assert.match(shipping,/fetch\('\/api\/shipping\/rates'/,'live provider quotes');
assert.match(shipping,/\.sort\(\(a,b\)=>a\.priceIdr-b\.priceIdr\)/,'sort real rates by cost');
assert.match(shipping,/rate\.duration\?/,'only show actual provider ETA');
assert.match(shipping,/formatIDR\(rate\.priceIdr\)/,'show provider price');
assert.match(shipping,/Ongkir final dihitung saat checkout/);
assert.match(shipping,/name="vpd-shipping-rate"/);
assert.match(shipping,/selected===id/);
assert.doesNotMatch(shipping,/BEBAS ONGKIR|Gratis Ongkir|Rp11\.500|Rp28\.000|25 Nov|Tiba besok/,'avoid copied or synthetic benchmark offers');
assert.match(styles,/\.vpd-shipping-sheet\s*\{/);
assert.match(styles,/height:min\(88dvh,860px\)/,'sheet uses tall usable viewport');
assert.match(styles,/\.vpd-shipping-sheet \.vm-address-grid\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/,'address fields stack vertically');
assert.match(styles,/\.vm-address-grid>label\s*\{[\s\S]*?flex-direction:column!important/,'labels not inline with select');
assert.match(styles,/\.vm-address-grid>label>select/);
assert.match(styles,/max-width:100%!important/,'form must not overflow');
assert.match(styles,/\.vpd-shipping-rate-list>label/);
assert.match(styles,/\.vpd-shipping-rate-list>label\.is-selected/);
assert.match(styles,/\.vpd-shipping-close/);
assert.match(styles,/\.vpd-purchase-bar :is\(\.vpd-chat,\.vpd-buy,\.vpd-add\)/);
assert.match(styles,/background:#8310e8!important;color:white!important/);
assert.match(styles,/min-height:42px!important;height:42px!important/);
assert.match(styles,/body:has\(\.vpd-shipping-sheet\) :is\(/,'hide support widget when shipping modal opened');
assert.match(styles,/#chatvice-eye-toggle/);
assert.match(styles,/@media\(max-width:359px\)/);
assert.match(styles,/safe-area-inset-bottom/);
assert.match(addressPicker,/aria-label="Wilayah alamat Indonesia"/,'preserve picker semantics');
assert.match(chatCSS,/#chatvice-widget-button/,'original Chatvice launcher stays enabled outside sheet');
assert.ok(layout.indexOf("import './product-shipping-v4.css';")>layout.indexOf("import './chatvice-bottom-anchor.css';"),'load shipping override last');
console.log('PASS: Tokopedia-style delivery layout, responsive address form, live carrier rates, purple CTA, checkout safety.');
