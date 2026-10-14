# Contributing to SupplyLens

Start with the README's setup and current-release limitations. The application uses a Worker runtime, D1 storage and platform-owned authentication; do not assume a conventional Node/PostgreSQL deployment.

## Propose a change

Open an issue describing the user problem and the expected behavior. Keep changes focused. For visual changes, include the affected viewport and theme. Do not include customer data, credentials or unredacted personal information.

## Before a pull request

- Run `pnpm test` and `pnpm exec tsc --noEmit`.
- Run `pnpm build` if application code or configuration changes.
- Include a worked numerical example for forecast, reorder or simulation changes.
- Check light and dark themes for interface changes; state which browser checks you completed.
- Preserve authentication, per-owner scope, revision checks and server validation.
- Add a new migration for schema changes; do not edit an applied migration.

Explain why the change is needed, what it changes, and how it was verified. Distinguish tests you ran from checks that remain unverified.

## Source and deployment

The current application is in `app/`. The root `index.html` is the earlier standalone demo. Keep unrelated changes to the legacy demo out of application pull requests.

A GitHub commit does not publish the Sites application. Deployments are handled separately by the maintainer.

## Permissions

The project does not currently include a project-wide open-source license or contributor agreement. Discuss substantial contributions and reuse permissions with the maintainer before proceeding. Existing third-party licenses remain in effect for their respective files.
