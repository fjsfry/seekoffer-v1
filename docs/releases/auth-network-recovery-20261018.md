# Login and Admin Network Recovery

## Observations

- The production home, notice list, resource product, download, workbench entry, and admin login pages rendered during the investigation.
- The Cloudflare health endpoint, Clerk environment endpoint, and pinned Clerk browser script returned HTTP 200.
- The previously supplied login credential was rejected as an incorrect password. The user's exact intermittent network failure was not reproduced with an authenticated session.
- No database quota reset, password change, payment, or authentication bypass was performed.

## Corrected Failure Paths

- Remove failed authentication script elements and bound script, SDK initialization, and token waits so another attempt can recover.
- Preserve structured API status codes through the administrator API client.
- Retry read requests once on transient transport/502/503/504 failures. Refresh a rejected token once for authenticated reads. Do not retry quota, rate-limit, permission failures, or ambiguous writes.
- Preserve cached session data during a service failure while blocking the admin page until verification succeeds.
- Clear cached administrator access on explicit 401/403 responses; do not sign out a successfully authenticated user merely because administrator verification is unavailable.
- Show a reconnect action and retry when browser connectivity returns. Handle startup login-check failures and prevent duplicate form submission.

## Validation

- 16 behavior tests passed across `clerk-loader-recovery`, `cloudflare-request-recovery`, and `admin-session-recovery`.
- TypeScript validation passed.
- Production static build passed, including build-surface isolation. One existing image lint warning in the resource order page remains unrelated.
- Candidate deployment: https://seekoffer-v1-al5k4l8nx-fjs1352256858-2004s-projects.vercel.app
- Full authenticated production acceptance remains pending because the user was unavailable to sign in with current credentials.

## Source

Frontend release source: `artifacts/web-pro-release-20261008`.
The same changed source and tests are retained on `codex/online-reconciliation-20261005`.
Unrelated desktop, extension, billing, and Worker changes are excluded from this release.
