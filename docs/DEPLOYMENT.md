# GitHub and Vercel readiness

## GitHub

Commit the source, `package-lock.json`, `.env.example` and bundled licensed assets.
The ignore rules exclude local environment files (except the example), databases
and their WAL/SHM files, `data/` including backups, private key files, dependencies,
build output, logs, test artifacts and `.vercel/` project metadata.
Never force-add these ignored files. Review the staged file list before committing.

The existing GitHub Actions workflow installs dependencies with `npm ci`, checks
formatting, runs lint/typecheck/tests/build, and runs Chromium browser workflows
against an isolated test database. No service credentials are required for CI.

## Vercel settings and current blocker

**The source can build, but the current backend cannot operate correctly on Vercel.**
Accounts, sessions, balances and authoritative game state use a local SQLite file
with synchronous transactions. Vercel functions have ephemeral filesystems and
multiple instances cannot share that file. `/tmp` is not a persistence solution.
See [Vercel's SQLite guidance](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

Poker deadlines and maintenance also use a one-second interval in a persistent
Node process. A function invocation is not a reliable always-running worker.
Vercel supports streaming responses, but the application's maintenance lifecycle
and shared state must be adapted before deploying the full application there.

The framework settings are straightforward once those backend blockers are resolved:

| Setting          | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| Framework Preset | Next.js                                                   |
| Root Directory   | Repository root (the directory containing `package.json`) |
| Node.js Version  | 24.x, matching `package.json`                             |
| Install Command  | `npm ci`                                                  |
| Build Command    | `npm run build`                                           |
| Output Directory | Leave the framework default; do not override              |

No `vercel.json`, custom start command or static export is needed. No external
accounts or services are configured by this repository preparation.

## Environment variables

No secrets or external service credentials are needed to build. Production runtime
configuration for the **currently supported persistent Node host** is:

| Variable        | Value and purpose                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `APP_ORIGIN`    | Exact public HTTPS origin, e.g. `https://casino.example.com`, without a trailing slash or path. Used for mutation origin checks and secure cookies. Must match the browser's origin. |
| `DATABASE_PATH` | Writable persistent SQLite file path, e.g. `/app/data/fun-gambling.sqlite`. There is **no working production Vercel value** for this variable with the current implementation.       |
| `TRUST_PROXY`   | Optional, defaults to `false`. Set `true` only when a trusted proxy overwrites `X-Forwarded-For`.                                                                                    |

Vercel supplies `NODE_ENV`; no manual setting is necessary. A future Vercel backend
migration will require its own database configuration and credentials. Setting an
unsupported `DATABASE_URL` today does not change the SQLite backend. Preview domains
also need matching origin configuration; the current strict origin check does not
automatically accept arbitrary preview URLs.

## Validation and supported deployment

With Node.js 24 installed:

```sh
npm ci
npm run format:check
npm run check
```

`check` runs lint, type checking, unit/service tests and the production build.
On Windows PowerShell use `npm.cmd` if execution policy blocks `npm.ps1`.

For the current backend, use the supplied Docker/Compose setup on a single
persistent Node host with an HTTPS reverse proxy and a private persistent volume.
See the README for streaming and backup requirements. Supporting Vercel instead
requires a deliberate migration to shared durable storage with equivalent atomic
game/accounting transactions, plus a reliable maintenance/realtime lifecycle.
That is backend implementation work rather than a deployment configuration change.
