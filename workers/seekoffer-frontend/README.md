# SeekOffer frontend deployment

The frontend is now the production website, not a disposable preview. The user authorized the www cutover on 2026-09-11. Preserve the distinct API Worker and the existing DNS records.

- Production: `https://www.seekoffer.com.cn`, Worker `seekoffer-next15-compatibility`.
- Active configuration: `../../artifacts/website-publication-20260911/wrangler.live.json`.
- Keep `PUBLIC_WEBSITE_MODE=live` and exact `PUBLIC_WEBSITE_ORIGIN=https://www.seekoffer.com.cn`.
- Keep both the protected `preview.seekoffer.com.cn` Custom Domain and the `https://www.seekoffer.com.cn/*` Worker Route, zone `82eca6dd8e89e5a1c0c87e514536383a`.
- Keep the existing secret binding and D1/asset bindings. Never copy the secret value into config or assets.
- `artifacts/.../wrangler.json` and older preview scripts are historical. Do not deploy them over production; their mode or route list would regress the release. Existing version assertions deliberately refuse this.
- The public frontend has SELECT-only D1 access. Authenticated writes continue through the existing Clerk-protected business API. Do not turn the frontend's private-route failure responses into a Supabase fallback.
- A future artifact needs its own bounded local, preview, budget, source-hash and main-domain verification before deployment. Do not silently reuse today's approval for unrelated changes.

Release, CPU caveat, quota and guarded rollback: `../../docs/ops/d1-website-release-20260911.md`.
