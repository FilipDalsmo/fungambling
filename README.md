# Fun Gambling

A play-money casino and human-vs-human poker application. Chips are fictional, have no monetary value, and cannot be purchased, transferred, sold, withdrawn or redeemed.

## Local setup

Install **Node.js 24 LTS** and npm. No external service or account credentials are required.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3000**. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`, and `Copy-Item .env.example .env.local` to copy the environment file. Register an account and save the one-time recovery code displayed in the app. The database and four public poker tables are created automatically on first server startup.

For multiplayer testing, create a second account in a separate browser profile or private window. Open Poker room and join the same table. There are no poker bots.

## Commands

| Command                     | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | Development server with reload                                |
| `npm run build`             | Production build and Next.js TypeScript validation            |
| `npm start`                 | Serve the production build                                    |
| `npm run lint`              | ESLint, with warnings treated as failures                     |
| `npm run typecheck`         | Generate route types and run strict TypeScript                |
| `npm test`                  | Domain, security and SQLite service tests                     |
| `npm run test:watch`        | Watch unit/integration tests                                  |
| `npm run test:e2e`          | Playwright workflows against a production server on port 3100 |
| `npm run format`            | Format project files with Prettier                            |
| `npm run format:check`      | Check formatting                                              |
| `npm run check`             | Lint, typecheck, tests and production build                   |
| `npm run admin -- username` | Grant an existing account admin access; locally audited       |
| `npm run backup`            | Create a consistent backup under `data/backups/`              |

Before the first browser test run: `npx playwright install chromium`. Run `npm run build` before `npm run test:e2e`. Browser tests create isolated databases under `test-results/`; they do not touch the application database. All generated test artifacts are ignored.

CLI commands load `.env.local` when present. Production processes read environment variables provided by the host. `APP_ORIGIN` must match the exact browser origin (scheme, hostname, port; no trailing slash). Default: `http://localhost:3000`. The session cookie becomes Secure when the origin is HTTPS. `DATABASE_PATH` points at a writable persistent local disk path. Enable `TRUST_PROXY` only if a trusted reverse proxy overwrites `X-Forwarded-For`; otherwise authentication has a shared process-wide IP bucket plus per-username limits.

## Implemented product

- Username/password accounts, hashed sessions, one-time recovery, built-in avatars and public profiles.
- Transactional bankrolls resetting to 10,000 at London noon; aggregate wagering statistics; four leaderboard periods.
- Blackjack with splitting/doubling/Perfect Pairs/21+3, Punto Banco Baccarat, Ultimate Texas Hold'em with Trips.
- Felt betting spots with a draggable chip tray, tap/keyboard placement, Undo/Clear, compact table cards, and a stacked Ultimate flop that turns and fans out together. Select a chip then tap a spot on mobile; Ante and Blind stay matched.
- Persistent six-seat NLHE/PLO poker, public/private tables, invitations, spectators, action timers, reconnects, side pots and no rake.
- XP/levels, permanent achievements and a claimable daily challenge.
- Friends/requests, presence, table chat/reactions, mute/block/report.
- Admin suspensions/permanent bans, audited chat removal and balance adjustments, reward configuration, announcements and operational table/report views.
- Responsive dark casino presentation, original CSS card/chip illustrations, polished synthesized effects, six lounge/jazz soundtracks, reduced-motion support and keyboard-accessible controls.

Audio defaults on at modest levels and starts as soon as your browser permits it (usually on the first click or key press). Open **Audio** for independent effects/music sliders, mute controls and credits. Preferences persist across sessions. Music crossfades between games and resumes rather than restarting on routine navigation. See [audio implementation and track details](docs/AUDIO.md).

## Key operating decisions

At noon Europe/London, unfinished casino rounds and poker hands are voided and seats released. Every bankroll becomes exactly 10,000; settled performance and permanent progression remain. Active wagers and poker stacks count toward current chip position until then. Administrative balance adjustments do not count toward competitive profit. Lifetime wager winnings/losses are positive/negative **net results per completed hand**, separate from rewards.

One active casino round or poker seat per player. Poker turns last 30 seconds. Timeouts check if possible, otherwise fold, and sit out subsequent hands. Disconnects preserve seats/cards; five minutes of inactivity releases a seat after its current hand settles. A single application instance periodically advances deadlines, with transactional catch-up on requests and after restart.

The lobby offers a resume shortcut for active rounds/seats. Blocking removes friendship and private invitations in both directions; an affected private-table seat is marked to leave safely after settlement. Public tables remain shared, with blocked messages hidden. Admins can remove individual messages with retained audit evidence, suspend for 30 days, ban until lifted, or apply a 24-hour chat mute.

## Deployment and operations

See [GitHub and Vercel readiness](docs/DEPLOYMENT.md) for environment variables, build settings and the current Vercel runtime blocker. A successful Next.js build does not make the local SQLite backend compatible with Vercel functions.

Use a **single persistent Node host**, an HTTPS reverse proxy and local persistent storage. SQLite/WAL plus immediate transactions serialize authoritative changes. The app requires a running Node process for timers and SSE; ephemeral serverless hosting is unsuitable. Configure proxy streaming without response buffering for `/api/events` and allow connections longer than five minutes. The browser reconnects automatically.

`Dockerfile` and `compose.yaml` provide a single-container deployment. Set `APP_ORIGIN` to your HTTPS public origin before starting. Terminate TLS at your reverse proxy. Keep the SQLite file and backups private. Run `npm run backup` regularly and test restore; a restore requires stopping the application, restoring the database into the configured path, and removing stale WAL/SHM companion files from the replaced database before restarting. Never copy only a live `.sqlite` file while WAL transactions are active; use the backup command.

Completed casino rounds are replaced on the next deal, and all rounds reset daily. Detailed table state is cleared at daily reset. Chat and duplicate-action records expire after 24 hours; sessions after seven days. Reports retain moderation evidence and administrative audits persist. Aggregate daily performance and progression persist. There is no permanent user-facing hand archive.

This initial implementation targets tens of concurrent users. Test load on the chosen host, monitor logs/disk/backups, and review moderation reports. No automated collusion detection or external identity verification is included; rate limits, one-seat limits, private-card isolation, reporting and audited moderation provide proportionate initial controls.

## Project documentation

- [PRODUCT.md](PRODUCT.md): authoritative product requirements.
- [AGENTS.md](AGENTS.md): engineering guidance.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): structure, dependency order and decisions.
- [docs/GAME_RULES.md](docs/GAME_RULES.md): exact variants and paytables.
- [docs/VALIDATION.md](docs/VALIDATION.md): checks and remaining operational limits.

Artwork is original CSS/Unicode; sound effects are original Web Audio synthesis. Six locally bundled music recordings by Kevin MacLeod are licensed under CC BY 4.0, with [attribution and source links](public/audio/CREDITS.md) also visible in Audio settings. System fonts and platform emoji require no downloaded art or fonts. Runtime and development dependency licenses remain in their packages.
