# Vapmart Checkpoint 25 — Domain Cutover

Date: 2026-10-31 (Asia/Jakarta)
Publication explicitly authorized by the user on 2026-10-31.

## Result

- https://vapmart.id/ and https://www.vapmart.id/ serve the Vapmart application through Railway vapmart-web.
- Both domains were verified with valid HTTPS certificates at cutover closeout.
- Both HTTPS /api/health endpoints returned HTTP 200 with status ok, service vapmart-web, and checkout disabled.
- HTTP health requests redirected to the corresponding HTTPS endpoint successfully.
- The homepage and demo catalog loaded in the browser. The catalog displayed four ordinary demo products and stated that checkout was unavailable.

## DNS configuration

| Type | Host | Target | TTL |
| --- | --- | --- | --- |
| ALIAS | @ | lta5rlv1.up.railway.app | 300 |
| CNAME | www | 29sdkagc.up.railway.app | 300 |

Railway ownership TXT records were added for both hosts. Hostinger converts the apex CNAME into an ALIAS record. The former apex A record was replaced to prevent an A/ALIAS conflict. Existing Hostinger nameservers were retained; the DNS zone was not reset.

## Payment and email state

- Physical checkout and digital commerce remain disabled. No payment was submitted or activated during the cutover.
- CHECKOUT_ENABLED and DIGITAL_COMMERCE_ENABLED were explicitly set to false on the API service.
- The live coin-pack API returned checkoutEnabled:false.
- No email DNS records were changed or removed. The inspected zone had no email records before the change; public DNS checks also returned no MX or apex SPF TXT record and no DMARC record. Email delivery was not tested or configured.
- The web service SITE_URL was set to https://vapmart.id.

## Verification and scope

The web service, API and database were online at closeout, with no active Railway service issues. DNS propagation and certificates were verified through Railway; HTTPS access was also checked in the browser. A transient www certificate mismatch during propagation resolved before closeout, without bypassing a browser security warning.

The custom domains were connected to the existing Railway web service. Its environment remains named staging, and existing preview labels and noindex behavior remain in place. The existing Railway preview URL remains available.

This checkpoint verifies the domain cutover. It does not assert that authentication, email, payments, shipping, or a full commercial launch is ready. No draft PR merge, environment rename, hosting cancellation, or WordPress content deletion was performed.

This public checkpoint excludes credentials, ownership token values, internal resource identifiers, and deployment identifiers. Findings above describe the completed cutover verification rather than continuous monitoring.
