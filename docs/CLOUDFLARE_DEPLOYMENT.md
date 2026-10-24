# Deploying SupplyLens to your Cloudflare account

SupplyLens uses **Vinext + Vite**, which emits a Cloudflare Worker in `dist/server` and assets in `dist/client`. It is not a standard Next.js `.next` build. Wrangler's automatic OpenNext migration fails because `.next/server/middleware-manifest.json` does not exist.

## Workers Builds settings

In the `supplylens` Worker's Settings → Build, use:

| Setting | Value |
| --- | --- |
| Repository | `Achyuth777/SupplyLens` |
| Production branch | `supplylens-demo` |
| Root directory | `/` |
| Build command | `pnpm run build:cloudflare` |
| Deploy command | `pnpm run deploy:cloudflare` |
| Preview command (if shown) | `pnpm run preview:cloudflare` |

Save the settings and build the latest commit. Do not use bare `npx wrangler deploy` before building, and do not add OpenNext. No new dependency or lockfile update is needed.

## Migration status: public pages only

The independent Cloudflare build currently publishes the homepage and About page. Workspace and API routes return a clear setup-in-progress response with HTTP 503. This is intentional: Google OAuth and a database in the owner's Cloudflare account have not been configured yet.

The standalone entrypoint removes incoming Sites identity headers. A direct Worker cannot trust visitor-supplied headers as authenticated identity. The build replaces the managed host's placeholder D1 binding with the owner's `supplylens-db` database. It does not copy or delete any existing workspace data.

The original Sites build (`pnpm run build`) remains unchanged and uses the existing hosted identity and storage. This migration does not deploy to or modify that existing website.

## Remaining work before workspace launch

1. Create a D1 database in the destination Cloudflare account, bind it as `DB`, and apply the schema migrations.
2. Configure a Google OAuth client for the confirmed deployed origin and callback route. Store the client secret in Cloudflare runtime secrets, never in GitHub or chat.
3. Implement and verify server-side sessions, OAuth state/PKCE checks, sign-out, and per-user authorization. Then replace the temporary setup boundary.
4. Plan explicit, verified account linking before importing old Sites workspaces. Google IDs and Sites IDs are different; do not infer ownership from a browser-supplied ID.
5. Verify two different Google accounts cannot read or modify each other's workspaces before opening workspace access.

Build and deploy success alone does **not** mean Google sign-in is finished.

## Destination database

The standalone build binds `DB` to `supplylens-db` (`acc8d0da-c3ff-42af-86b7-e699265e84e5`). After building, run `pnpm run db:setup:cloudflare` from an authenticated Cloudflare environment to create the workspace table without deleting existing records. Alternatively run `drizzle/cloudflare-bootstrap.sql` in the database dashboard Console. The Google authentication boundary remains closed.
