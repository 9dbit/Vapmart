# Vapmart CP36-R2 follow-up | Official admin logo

Date: 2026-11-02 (Asia/Jakarta)
Parent source: edba1e4eed548e235cc91a76d6c17f180322efe7
Repository: 9dbit/Vapmart
Branch: feat/ecommerce-foundation-20261029
Scope: Replace the text/letter-v imitation at admin login and workspace sidebar with the existing ecommerce logo.

## Implementation
- Both admin surfaces use a small AdminBrandLogo wrapper around the unchanged storefront BrandLogo component.
- Identical public assets: /branding/vapmart-logo.png and /branding/vapmart-logo-dark.png.
- Original 400:79 proportions, transparent background and theme switching remain owned by the existing cp24-logo.css. No image recoloring, redrawing, cropping or public storefront changes.
- Only admin slot dimensions are adjusted: 244px login desktop, 220px login mobile, 168px sidebar; all constrained by available width.
- Sidebar retains CONTROL PANEL as a separate caption, not part of the logo artwork. Media Library inherits the same workspace logo.
- /admin remains the entry point and /admin/login remains a redirect. Authentication, roles, data, checkout and courier switches are not modified.

## Verification
- Admin responsive QA adds a dedicated Playwright logo test against https://vapmart.id.
- Checks identical storefront asset paths, successful image decoding, light/dark selection, original aspect ratio, no horizontal overflow, no letter-v placeholder, and Media Library reuse.
- Tests login and sidebar at 1440px and 390px. Sidebar checks use browser-intercepted fixtures only; no production administrator password or mutation is involved.
- Screenshots are stored in the admin-official-logo-qa workflow artifact for seven days.
- Release is complete only after the new Railway Web deployment reaches SUCCESS and logo QA passes. This manifest records intended scope, not a pre-emptive deployment success claim.
