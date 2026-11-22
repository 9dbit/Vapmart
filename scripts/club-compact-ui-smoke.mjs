/** Regression checks for compact home Club and connected welcome card.
 * Run from repository root: node scripts/club-compact-ui-smoke.mjs
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const home=readFileSync('apps/web/src/app/page.tsx','utf8');
const preview=readFileSync('apps/web/src/components/home-member-card.tsx','utf8');
const auth=readFileSync('apps/web/src/components/customer-auth-panel.tsx','utf8');
const css=readFileSync('apps/web/src/app/club-compact.css','utf8');
const layout=readFileSync('apps/web/src/app/layout.tsx','utf8');
const memberCard=readFileSync('apps/web/src/components/member-card.tsx','utf8');
const memberHub=readFileSync('apps/web/src/components/member-hub.tsx','utf8');

assert.match(home,/<section className="main-container vm-trendora-member" id="promo" aria-labelledby="vm-club-title">/);
assert.match(home,/<h2 id="vm-club-title">Belanja lebih seru jadi member\.<\/h2>/);
assert.match(home,/href="\/member-2" className="vm-trendora-member-link"/);
assert.match(home,/<HomeMemberCard\/>/);
assert.match(preview,/fetch\('\/api\/member'/,'preview must fetch authenticated member data');
assert.match(preview,/headers:\{Authorization:'Bearer '\+token\}/);
assert.match(preview,/balanceCoin/);
assert.match(preview,/Number\.isFinite\(member\.balanceCoin\)/);
assert.match(preview,/data-preview-status=\{status\.toLowerCase\(\)\}/);
assert.doesNotMatch(preview,/\bMemberCard\s*\(/,'home should render mini preview, not full ID-1 card');
assert.match(memberCard,/data-member-card-design="obsidian-premium"/,'full member card must remain unchanged');
assert.match(memberHub,/MemberCard/,'member hub retains the full member card');

const loggedIn=auth.split("auth.user?")[1]?.split("   </>:\n   <>")[0];
assert.ok(loggedIn,'signed-in section present');
assert.doesNotMatch(loggedIn,/vm21-auth-ident/,'welcome screen must not show a second logo');
const signedOut=auth.split("   </>:\n   <>")[1];
assert.match(signedOut,/vm21-auth-ident/,'logo still exists on the login/signup form');
assert.match(auth,/vm21-welcome-card/,'welcome-specific CSS scope present');
assert.match(css,/\.vm-trendora-home \.vm-trendora-member/);
assert.match(css,/grid-template-columns:minmax\(0,1fr\)/,'compact two-column layout');
assert.match(css,/@media\(max-width:767px\)/,'mobile layout defined');
assert.match(css,/@media\(max-width:359px\)/,'small-phone support defined');
assert.match(css,/focus-visible/,'visible focus treatment exists');
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(layout,/import '\.\/club-compact\.css';/,'last loaded CSS override');
assert.ok(layout.indexOf("import './club-compact.css';")>layout.indexOf("import './account-transactions-favorites.css';"),'Club CSS overrides other themes');
console.log('PASS: compact Club, live preview, auth welcome, responsive and Obsidian member card parity.');
