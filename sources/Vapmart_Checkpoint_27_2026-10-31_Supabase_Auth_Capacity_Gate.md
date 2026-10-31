# Vapmart Checkpoint 27 | Supabase Auth Provisioning Gate
Date: 2026-10-31 (Asia/Jakarta)
Status: BLOCKED BY SUPABASE FREE-PROJECT LIMIT; NO AUTH PROJECT CREATED

## User decision
- Selected Supabase account/connector: **9D**.
- Target organization: **9dragons Org** (`jhaszwlqbtfvfgskacek`).
- Proposed dedicated project name: **Vapmart**.
- Preferred region: `ap-southeast-1` (Singapore).
- Supabase quoted project creation cost: USD 0 / month.
- User explicitly confirmed this quote in conversation.

## Provisioning attempt and result
- A cost confirmation ID was obtained through the official Supabase connector.
- `create_project` with confirmed cost failed before provisioning:
  `markstudios.id@gmail.com (2 project limit)`: user has reached maximum active free-project limit across organizations where an administrator or owner.
- No new Vapmart project ID, database, auth keys, user accounts or API credentials exist from this attempt.
- No existing Supabase project was deleted, paused, renamed or repurposed.

## Verified Supabase project inventory
| Organization | Project | State |
| --- | --- | --- |
| 9dragons Org (9D) | Pentagon | ACTIVE_HEALTHY |
| 9dragons Org (9D) | Agents Command Center | INACTIVE |
| Makstudios.id@gmail.com Org | tradevice-copy-staging | ACTIVE_HEALTHY |
| Makstudios.id@gmail.com Org | markstudios.id@gmail.com's Project | INACTIVE |

Two active free projects are Pentagon and tradevice-copy-staging. Do not interrupt either without explicit instruction. Pausing an inactive project will not free an active slot. Possible choices: user authorizes pausing one active project (temporarily impacts that project), or upgrades an appropriate Supabase plan/capacity subject to a new cost quote and explicit user approval.

## Vapmart state preserved
- Storefront/domain HTTPS and Railway `vapmart-web` / `vapmart-api` at CP26 remain as-is.
- Railway PostgreSQL migration 005 is already applied. It is separate from the planned Supabase Auth project.
- Cart -> Checkout -> authenticated draft order code deployed.
- Admin Console has Products & SKU / Brands / Media / Orders but is fail-closed until Supabase Auth is configured.
- Existing `CHECKOUT_ENABLED=false` and `DIGITAL_COMMERCE_ENABLED=false` must be preserved.
- Do not enable real payment session, credit coins, paid status, delivery or fulfillment before gateway verification.

## Upon Supabase slot availability
1. Create dedicated Vapmart project under 9dragons Org in Singapore.
2. Obtain project URL and enabled publishable key through Supabase connector, never put secrets in public GitHub.
3. Review current Next.js and NestJS Auth variable names and guard contracts; update Railway service variables safely.
4. Configure Supabase Auth redirect URLs for vapmart.id and www.vapmart.id; ensure HTTPS, confirmed emails and reset links.
5. Provision admin staff role on Railway PostgreSQL via verified Supabase user UUID; never hardcode login credentials.
6. Run signup/signin/reset, admin 401/403, brand/product/media CRUD and checkout order-isolation QA.
7. Record build/deployment/tests as Checkpoint 28. Keep payment off pending dedicated provider integration.

No changes to Supabase projects, Railway variables, DNS, email records, or payment flags were made in Checkpoint 27.
