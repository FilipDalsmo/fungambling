# Validation and implementation state

Validated locally on Windows with Node 24.19.0. The implementation covers the required initial capability set in `PRODUCT.md`; exact rule, economy and operational choices are recorded in `ARCHITECTURE.md` and `GAME_RULES.md`.

## Checks performed

- ESLint: passed, with warnings treated as errors.
- Strict TypeScript and generated Next.js route types: passed.
- Vitest: **44 tests passed** across rules, transactional services and operator commands.
- Production Next.js build: passed.
- Playwright Chromium: **4 end-to-end workflows passed** against the production build, with isolated databases and real browser sessions.
- Dependency audit: **0 reported vulnerabilities** on 2026-09-24, including development dependencies. This is a point-in-time advisory check, not a security certification.
- Desktop (1440px) and mobile (390px) screenshots inspected; horizontal-overflow checks passed.
- Backup created using SQLite's backup API, restored, and checked with `PRAGMA integrity_check`.

## Behavior exercised

Calendar tests cover London noon, both DST transitions and weekly/monthly boundaries. Card tests cover all poker rank categories, wheel straights, exact Omaha card usage, Blackjack naturals/splits/doubles/side bets, all Baccarat banker drawing rows, and Ultimate staged wagers/Trips/royal payouts.

Poker tests cover heads-up order, pot-limit caps, out-of-turn rejection, incomplete and cumulative all-in raises, side pots, hidden-card projections and chip conservation across 100 deterministic mixed-action hands. Service tests cover held buy-ins, timeout settlement, safe returns, persisted reconnect state and daily reset idempotency.

Security/accounting tests cover hashed credentials/tokens, one-time recovery and session revocation, password-change races, account uniqueness, origin/body checks, insufficient balances, stale revisions, replay rejection, once-only rewards, leaderboard separation, private-table authorization, blocked chat/invitations, administrative authorization/audits, chat removal and operational retention.

Browser flows exercise registration, recovery-code presentation, all casino games, daily reward collection, avatars/profiles/leaderboards, NLHE betting and reconnect, a complete two-player PLO showdown, spectators' hidden cards, chat, friendships, private invitations, the resume shortcut, CSRF rejection, simultaneous duplicate wagers, forged client authority, logout and admin configuration/moderation.

## Operational limits

- Docker configuration is supplied but was not built locally because Docker is unavailable. Production hosting, TLS/proxy setup, Linux container execution and host-specific load testing remain deployment validation tasks.
- The application targets a single persistent Node host with SQLite. Horizontal scaling and ephemeral/serverless hosting are intentionally unsupported.
- ESLint 9.39.5 is retained because the current `eslint-config-next` React plugin fails under ESLint 10 (`context.getFilename` compatibility). npm marks ESLint 9 deprecated. Revisit this development-tool dependency when the bundled plugin supports ESLint 10; runtime dependencies have no reported advisories in the audit above.
- Browser automation currently covers Chromium. Safari/Firefox and assistive-technology testing are not yet performed. Native dialog focus behavior, labels, reduced motion and responsive styles are implemented, but this is not an exhaustive accessibility audit.
- Small-project abuse controls are implemented; automated collusion detection and external identity verification are not included. Reports and audited moderation are available.
- No real deployment or external account/service has been configured. No required credentials block local operation.

Run `npm run check`, then `npm run test:e2e` to reproduce the primary checks. Run `npm run format:check` independently. Browser screenshots and failure traces are written to ignored `test-results/`.

## Paced casino deals

Validated sequential casino deals and 3D flips, dealer-hole-card concealment, hits/splits/community-card ordering, and original synthesized card audio. All 50 Vitest tests and 5 Chromium end-to-end tests pass. The added browser test verifies one-at-a-time reveals, disabled actions during dealing, one sound per deal/flip, muting, and switching to reduced motion during a hand. Mobile screenshot inspected at 390px with no horizontal overflow. Lint, type checking, production build and formatting checks pass. Audio playback events were verified in Chromium; subjective speaker/headphone sound quality and other browser engines remain manual checks.

## Felt betting and table refinement

All 55 Vitest tests and 6 Chromium browser tests pass, alongside lint, type checking and the production build. Added coverage for chip denominations, bankroll availability, main/side limits, matched Ante/Blind costs, Baccarat selection changes, and a grouped three-card flop. Browser coverage drags chips onto the felt, checks Undo/Clear and keyboard placement, verifies the resulting authoritative wager, tests locking during play, and checks the flop as a group. Blackjack card size and dealer/player separation are measured in the browser. Desktop and 390px mobile screenshots cover both Ultimate and Blackjack; mobile flows also check for horizontal overflow. Visual style follows the supplied felt-table reference using original CSS and the existing side bets.

## Directional flop and win feedback

All 56 unit/service tests and 7 Chromium browser workflows pass. A timing test checks the 1,390ms Ultimate player-card interval. Browser animation sampling checks that the first flop card remains anchored and the other two move right from the left stack. Deterministic browser-only result fixtures check reveal-before-celebration ordering, exact net/returned/wagered amounts, push/loss exclusion, Escape and automatic dismissal, reduced motion, and no replay after reload. Fixtures do not change authoritative server outcomes. Win overlays were visually inspected on desktop and 390px mobile screenshots. Lint, type checking, production build and formatting pass.

## Sitewide audio mixer

All 65 unit/service tests pass, including default-on preference validation, distinct game routing, independent gain buses, crossfades, position retention, overlapping loops, rapid navigation/mute races, and autoplay rejection/retry. Eight complete Chromium workflows passed; the final focused run passed the existing card/audio workflow, music/settings workflow, and a new autoplay/download-failure recovery workflow (nine distinct browser workflows covered overall). Browser checks use actual locally served MP3 playback and verify saved sliders/mutes after reload, music continuity on community navigation, track changes, return positions, loop overlap, and unobstructed gameplay after audio failures. The settings dialog was visually inspected at 390px.

All six bundled tracks decoded successfully in Chromium. Short-window audio-level analysis determined silent boundaries and relative playback gains. Lint, strict type checking, the production build and formatting checks pass. Licenses, source URLs and original-file hashes are recorded with the assets. Safari/iOS and Firefox audio behavior and subjective speaker/headphone balance still need manual device checks; Chromium and mixer simulations are the automated coverage.
