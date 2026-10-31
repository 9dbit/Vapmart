# Vapmart Checkpoint 22 - International Member Card & Solid Purple UI

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`  
**Draft PR:** https://github.com/9dbit/Vapmart/pull/1  
**Frontend staging:** https://vapmart-web-staging.up.railway.app/member-2  
**Railway project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`  
**Staging environment:** `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`  

## User intent

Update the **real Membership engine and page UI** to match the accepted screenshot, specifically:

1. Member card proportional to an international bank/credit card, not an oversized tall hero panel.
2. Preserve the existing authentic purple Vapmart logo with a fixed/consistent header position between routes.
3. Move Back button **under** the sticky header, no back button before the logo inside the header.
4. Make the card graphics opaque **solid vivid Vapmart purple and charcoal grey** (no transparent decorative card shapes).
5. Member benefit, Coin balance and promo panels should be informative, touch-friendly, interactive and aligned with the current authentic membership state.
6. Preserve Coin-pack amounts, verified wallet accounting, login setup, disabled checkout safety gates, original WordPress production and existing bottom glass navigation.

## Code

### `apps/web/src/components/member-card.tsx`
- Real ISO/IEC 7810 ID-1 aspect ratio using CSS `aspect-ratio:85.6/53.98`, reflecting 85.60mm by 53.98mm.
- Solid purple base, clipped charcoal diagonal and opaque graphite brand watermark shapes.
- Original source `/branding/vapmart-logo.png` displayed unaltered in a **solid white identity plate** because the original logo has a dark wordmark.
- Genuine auth/account values from `MemberHub`: name, validated four-digit masked card ending, status, backend Coin balance. For guest or unavailable backend, show an em dash and `Preview Card`, never fabricated data.
- Functional card Coin arrow opens the authenticated balance history via callback. Gold Coin decorative glyph shown beside numeric total, with brand purple/gold contrast.
- Status copy handles ACTIVE, REGISTERED, SUSPENDED, GUEST and unavailable.

### `apps/web/src/components/site-header.tsx`
- Removed subpage Back element from the header row so the logo's horizontal position never shifts.
- Added distinct `vm22-backbar` below the sticky header, with a 44px Back control and appropriate known destinations: Member -> home, Login -> Member, Product -> Catalog, Cart -> Catalog, others -> home.
- Retains existing header search, cart drawer, Supabase account link and five-item floating liquid nav.

### `apps/web/src/components/member-hub.tsx`
- Member Card now first visually on the mobile page instead of a large static greeting.
- 3 clickable tiles with solid fields: **Benefit Member**, **Saldo Coin Saya**, and **Promo Member**. Buttons switch to existing functional dashboard sections and scroll to them.
- Dynamic copy: reported balance when available; currently no promo unless server reports an eligible active event.
- Existing 4 working tabs remain **Ringkasan / Top Up / Benefit / Riwayat**. Six Gold Coin pack illustrations and physical checkout 503 restriction remain unchanged.

### `apps/web/src/app/cp22.css`
- New last-in-cascade stylesheet to override CP21 only where needed, avoiding destabilizing historic WordPress CSS.
- ISO geometry, no tall min-height, 100% width responsive, compact card text and bottom Coin/Member panels even at 360px.
- Strong solid purple `#8010e6`, dark graphite `#202026`, lavender `#ede0ff`, grey `#ebecf0`.
- Original logo white contrast chip, not a vector redraw, in Member Card.
- Mobile header logo forced to the same 147px alignment as homepage; Back row immediately under header.
- `prefers-reduced-motion` support for shortcut hover and controls.
- Glass floating navigation from CP19 remains untouched.

### Release marker & test
- `apps/web/src/app/layout.tsx`: imports `cp22.css` after `cp21.css`, page marker `member-cp22`.
- `apps/web/src/app/page.tsx`: `data-vapmart-ui=cp22`.
- `scripts/ui-smoke.mjs`: verify true card aspect ratio (tolerance <=0.025), purple and charcoal backgrounds fully opaque, original card logo loaded, guest zero-funding privacy, 3 clickable shortcut controls, fixed header logo x, separate Back row, no horizontal overflow at 360px/390px.
- `scripts/smoke-staging.mjs`: waits for CP22 release and validates server-rendered member card and shortcut content.

## Engine and safety

Membership backend does not require a new migration for the requested style change. It continues to read `GET /v1/member/overview` with a verified Supabase JWT. Payment initiation remains disabled pending dedicated Vapmart Supabase configuration and licensed payment gateway; neither user funds nor fictional account balances are created.

Staging-only implementation. No WordPress production change, GitHub `main` merge, checkout enablement, or schema modifications in this checkpoint.

## QA status

**Verified release:** Railway `vapmart-web` application commit `7d0487a2290a050485d75ddeb24a4dcff2c1b064`, deployment `90b96cba-23c4-4390-9e19-d69300486a9e`, reached terminal **SUCCESS**. It contains Member Card JSX, member page shortcuts, separate Back bar, `cp22.css`, CSS import, and release marker. Subsequent test-only and Markdown-only commits were **SKIPPED** by Railway change detection. Existing `vapmart-api` and PostgreSQL services remained **SUCCESS**.

**Final code/test commit:** `91c245a937c28b898fce08f461058f4f1a6e67ea`. All **6 of 6 GitHub workflows SUCCESS**:
- Foundation checks: **SUCCESS** (two runs)
- Browser UI smoke: **SUCCESS** (includes 390px + 360px ISO ratio, full opacity of purple/charcoal, responsive logo, Back bar, three action tiles, real dashboard tab switching, prior catalog/cart flows)
- Staging HTTP smoke: **SUCCESS** (CP22 theme/home release markers, API 401 guest gates, checkout 503)
- Coin wallet ledger integration: **SUCCESS** (disposable Postgres, idempotent activation and topups)
- Dependency security audit: **SUCCESS**.

The first Staging Smoke run temporarily failed because the app layout/home deploy rolled out in separate commits: the former release marker appeared before the latter. The smoke matcher was corrected to wait for **both** CP22 markers, then the final run succeeded; this was not an API regression or member-card failure.

Actual Safari iPhone visual QA remains pending because authorized SPARK.local was offline. Chromium browser QA is passing.

## Known gaps / next checkpoint

- A real Safari on iPhone visual check is still desirable; SPARK.local was offline at checkpoint implementation.
- Dedicated Vapmart Supabase Auth project and provider payment configuration are not connected. This is not a blocker for responsive card redesign, but account signup and real paid Coin credit must remain unavailable until security and compliance validation.
- Once visual approval is given, consolidate CP19/CP21/CP22 CSS into a single structured token file and keep legacy source CSS for archive audits.
