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

## Verified release result
- Application commit: 57e07a33d78facfc1bf3ed02ddb89ff3512153bc.
- Railway vapmart-web deployment 402a766f-cda4-40c4-8043-adc8eb5bbd45: terminal SUCCESS observed, completed 2026-11-02T03:26:03Z.
- GitHub Actions Admin Control Panel responsive QA run 41382978847, job 125077587076: SUCCESS. Both existing workspace checks and the new official-logo step passed.
- Live-domain logo test emitted VAPMART_OFFICIAL_ADMIN_LOGO_PASS at 2026-11-02T03:26:05Z, confirming the same two storefront asset URLs on login, sidebar and Media Library.
- Eight login/sidebar combinations passed: desktop 1440px and mobile 390px, each in light and dark themes. Displayed dimensions were 244x48.1875px desktop login, 220x43.4375px mobile login, and 168x33.171875px sidebar; original proportions retained.
- Eight screenshots uploaded as artifact 13113812940, admin-official-logo-qa. Desktop light login and mobile dark sidebar screenshots were also visually inspected.
- No authentication or database changes, no live admin sign-in, and no payment or courier activation occurred. Authenticated UI verification used isolated browser fixtures.
- This final update changes documentation only and does not require another application deployment.
