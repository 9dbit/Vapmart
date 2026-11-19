/**
 * Regression guard for the selected Vapmart Card concept.
 * The approved alternative 01 is OBSIDIAN PREMIUM, not the prior violet diagonal.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const component=readFileSync('apps/web/src/components/member-card.tsx','utf8');
const hub=readFileSync('apps/web/src/components/member-hub.tsx','utf8');
const layout=readFileSync('apps/web/src/app/layout.tsx','utf8');
const css=readFileSync('apps/web/src/app/member-obsidian.css','utf8');
const baseCss=readFileSync('apps/web/src/app/cp22.css','utf8');

assert.match(component,/data-member-card-design="obsidian-premium"/);
assert.match(component,/className="vm-new-member-card vm22-member-card vmoc-card"/);
assert.doesNotMatch(component,/className="vm22-card-purple-panel"/);
assert.doesNotMatch(component,/className="vm22-card-charcoal-panel"/);
assert.doesNotMatch(component,/className="vm22-card-engraving"/);
assert.match(component,/className="vmoc-brand-watermark"/);
assert.match(component,/<strong aria-live="polite">\{balance===null\?'—':formatCoin\(balance\)\}<\/strong>/);
assert.match(component,/onClick=\{onOpenWallet\}/);
assert.match(component,/safeLast4/);
assert.match(component,/status==='GUEST'\?'Guest Member'/);

assert.match(layout,/import '\.\/member-obsidian\.css';/);
assert.match(css,/vm22-member-card\.vmoc-card/);
assert.match(css,/background:\s*radial-gradient\(/);
assert.match(css,/\.vmoc-card \.vm22-card-purple-panel,/);
assert.match(css,/display:\s*none !important/);
assert.match(css,/@media \(max-width: 767px\)/);
assert.match(css,/@media \(max-width: 359px\)/);
assert.match(css,/focus-visible/);
assert.match(baseCss,/aspect-ratio:85\.6 \/ 53\.98/);
assert.match(hub,/fetch\('\/api\/member'/);
assert.match(hub,/balance=\{balance\}/);
assert.match(hub,/onOpenWallet=\{\(\)=>openSection\('history'\)\}/);
console.log('PASS: Obsidian Premium selected, data remains live, design overrides and responsive rules present.');
