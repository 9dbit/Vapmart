/** Ensure Chatvice launcher stays fixed above the relevant bottom controls.
 * Run: node scripts/chatvice-bottom-anchor-smoke.mjs
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const rules=readFileSync('apps/web/src/app/chatvice-bottom-anchor.css','utf8');
const layout=readFileSync('apps/web/src/app/layout.tsx','utf8');
const product=readFileSync('apps/web/src/app/product-detail-v2.css','utf8');
const shell=readFileSync('apps/web/src/app/storefront-collection.css','utf8');
const care=readFileSync('apps/web/src/components/vapmart-care.tsx','utf8');

assert.match(layout,/import '\.\/chatvice-bottom-anchor\.css';/);
assert.ok(layout.indexOf("import './chatvice-bottom-anchor.css';")>layout.indexOf("import './product-detail-v3.css';"));
assert.match(rules,/html body:has\(\.vpd-page\) #chatvice-widget-button/);
assert.match(rules,/position:fixed!important;/,'launcher stays attached to viewport');
assert.match(rules,/top:auto!important;/,'provider launcher cannot float at the top');
assert.match(rules,/bottom:20px!important;/,'base bottom anchor is set');
assert.match(rules,/body:not\(:has\(\.vpd-page\)\)/);
assert.match(rules,/@media\(max-width:767px\)/);
assert.match(rules,/margin-bottom:calc\(78px \+ env\(safe-area-inset-bottom\)\)!important;/,'Home launcher clears floating navigation');
assert.match(rules,/margin-bottom:calc\(48px \+ env\(safe-area-inset-bottom\)\)!important;/,'Product launcher is 30px lower than Home');
assert.match(rules,/#chatvice-widget-button/);
assert.match(rules,/#chatvice-eye-toggle/);
assert.match(rules,/#chatvice-hidden-label/);
assert.match(rules,/#chatvice-welcome-bubble/);
assert.match(rules,/\.vm-care-fallback/,'fallback is positioned consistently');
assert.match(rules,/\.vm21-cart-shell/,'cart-specific clearance is not overwritten');
assert.match(product,/body:has\(\.vpd-page\).*?legacy-mobile-nav.*?display:none!important/);
assert.match(product,/\.vpd-purchase-bar\{\s*position:fixed;/);
assert.match(shell,/margin-bottom:calc\(75px \+ max\(10px,env\(safe-area-inset-bottom\)\)\)/);
assert.match(care,/chatvice\.app\/api\/widget\/chatvice\.js\?merchant=m_d74410c444e2726c/,'provider merchant ID unchanged');
assert.match(care,/fallback/,'Chatvice fallback remains installed');
console.log('PASS: Chatvice bottom anchor per-route, floating nav clearance, product purchase bar, and safe-area regression.');
