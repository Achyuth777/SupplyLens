# SupplyLens on Cloudflare Workers

The independent deployment uses Vinext's Worker output, not OpenNext or `.next` manifests.

| Setting | Value |
| --- | --- |
| Production branch | `supplylens-demo` |
| Project name | `supplylens` |
| Build | `pnpm run build:cloudflare` |
| Deploy | `pnpm run deploy:cloudflare` |
| Preview command (if shown) | `pnpm run preview:cloudflare` |
| Production origin | `https://supplylens.achyuthpvvirat.workers.dev` |

## Credentials

Create a Google OAuth Web application with the exact redirect URI:

```text
https://supplylens.achyuthpvvirat.workers.dev/auth/google/callback
```

The public Google client ID is included in the generated Worker configuration. Set `GOOGLE_CLIENT_SECRET` as a Cloudflare runtime **Secret**, never in a tracked file or build log. If the Google app has testing restrictions, add the intended users in Google Auth Platform's Audience settings.

The standalone build binds `DB` to `supplylens-db` (`acc8d0da-c3ff-42af-86b7-e699265e84e5`). The existing `workspaces` table must exist. `pnpm run db:setup:cloudflare` can initialize it from an authenticated Cloudflare environment. Google login initializes its additive `auth_flows` and `auth_sessions` tables and expiry indexes automatically; no further SQL copy/paste is required.

## Identity and sessions

Opening `/workspace` starts Google login. The existing `/signin-with-chatgpt` and `/signout-with-chatgpt` links are compatibility aliases on this deployment. Sign-out presents a confirmation and revokes the server session only on a same-origin POST.

The Worker strips visitor-supplied Sites identity headers. Only a valid, unexpired D1 session can populate the request-scoped identity consumed by the existing workspace routes. OAuth uses state, a separate browser cookie, PKCE S256, and nonce; callback state is consumed once with an atomic D1 delete. Google ID-token signatures, issuer, audience, expiry, nonce, and verified email are checked. Raw session tokens live in host-only Secure HttpOnly cookies; D1 stores SHA-256 token hashes. Sessions expire after seven days; pending logins expire after ten minutes. Expired rows are removed at login.

Google workspace owners are namespaced `google:<sub>`. Google accounts start fresh demo workspaces. Existing Sites workspaces are not copied, linked by email, or deleted. Never infer account ownership from browser-supplied IDs. Authenticated page and API responses use private/no-store cache headers.

`pnpm run build` retains the original Sites build path, identity, and storage. Only `build:cloudflare` adds this standalone boundary. Changing the production domain requires updating the canonical origin in `scripts/cloudflare-auth.mjs` and the Google redirect URI together.

## Verification

- `pnpm test`: existing domain, search, activity-history, and revision behavior.
- `pnpm run test:auth`: signed-token checks, OAuth state and PKCE, replay rejection, expiry, sign-out, origin checks, and separate account identity using SQLite with stubbed Google responses.
- `pnpm run build:cloudflare`: production package.
- `pnpm exec wrangler deploy --config dist/server/wrangler.json --dry-run`: deploy packaging check.

Real Google consent and browser/database behavior must still be verified on the deployed origin with the owner's runtime secret. Never describe stubbed OAuth tests as a completed live login.
