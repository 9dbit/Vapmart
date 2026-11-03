# Vapmart CP38: Hero Banner Manager

Date: 2026-11-03, Asia/Jakarta. Status: candidate under verification, NOT YET DEPLOYED.

## Scope
Generic homepage content management at /admin/banners, linked from Admin > Media & Aset. Add paired desktop/mobile images, preview, draft, activate/deactivate, reorder, edit, trash with confirmation and restore as draft. No new commercial offers, product publishing, payment, carrier calls or DNS/email changes.

## Storage and safety
Migration 016 adds independent content tables, versioned edits and audit records. It initializes the three existing static reference slides once, without modifying original media. Disabling/trashing all slides intentionally leaves an empty hero; migration replay must not reseed them. Uploaded originals remain private; validated, metadata-stripped WebP derivatives are exposed only while referenced by an active, non-deleted banner. PNG/JPEG/static WebP accepted up to 5 MiB each, at least 64 px per side, at most 8192 px per side and 16 megapixels. Sharp pinned at 0.35.3. AdminGuard is reused unchanged.

Up to 30 current banners; per-operator 60 new uploads per hour and total 512 MiB quota. Soft deletion preserves original bytes. No external asset URLs or outbound requests are accepted. Concurrent updates require expectedVersion; reorder requires a collection revision. Public and private content endpoints are no-store.

## Verification scope
API build and 53 unit tests passed locally. CI must validate this exact tracked source, additive migrations twice, disposable PostgreSQL HTTP lifecycle, previous integrity/warehouse/courier tests, Web production build and local full-stack browser lifecycle. Fixture authentication is test-only and refuses every database except a CP38-named loopback database. No live operator credentials are used and no fixture routes are shipped in the application.

## Release gate
Both API and Web must reach Railway terminal SUCCESS at the verified source SHA, followed by live public reads and anonymous denial checks. No authenticated live mutation test or real operator UAT is claimed. Existing UI, original media, Supabase authorization and commerce safeguards remain unchanged.

## Rollback
Application rollback target: ca57e59ab6450ab45e11e4821574bfedee9369e3. Leave additive migration 016 and uploaded files in place; do not delete data to roll back application code.
