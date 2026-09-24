# Architecture and implementation order

The root `PRODUCT.md` is authoritative. The stale `docs/PRODUCT.md` references in `AGENTS.md` have been corrected; there is only one product brief, at the root.

## Decisions

- Node 24 LTS, Next.js App Router, React, strict TypeScript, npm with a committed lockfile. CSS provides the visual system; no component framework is needed.
- One persistent Node application, one local SQLite database using better-sqlite3, WAL, foreign keys and immediate transactions. Deploy on a single host with persistent disk and HTTPS. This is deliberately not a serverless/ephemeral-disk architecture.
- Domain engines are ordinary TypeScript, independent of HTTP and React. Crypto random integer Fisher–Yates shuffles run only on the server.
- Route handlers authenticate sessions, check origin, validate input with Zod and execute transactional service operations. Passwords use scrypt; opaque random sessions and recovery codes are stored only as hashes. No external account service or email credentials are needed.
- All chip amounts are integer hundredths internally. Bets are whole chips. Settlement, progression and daily aggregate statistics commit together. A client action UUID and expected game revision prevent replay and stale actions.
- Poker snapshots arrive through authenticated server-sent events; HTTP handles actions. Private cards are projected per viewer on the server. Persisted deadlines survive restarts. A server maintenance interval handles timeouts, resets and retention; reads/actions also catch up before operating.
- Vitest covers domain/accounting/security behavior; Playwright covers browser workflows. ESLint, TypeScript and production builds are independent checks.
- ESLint 9 is currently pinned by compatibility: the bundled Next.js React lint plugin fails with ESLint 10. See `VALIDATION.md`; this is a development-tool limitation, not a runtime requirement.

## Dependency order

1. Runnable application, configuration, database migration and test harness.
2. Accounts, sessions, recovery, profiles, transactional bankroll and London daily cycles.
3. Cards and hand evaluation; Baccarat, Blackjack and Ultimate Texas Hold'em.
4. Aggregate leaderboards, XP, achievements and daily challenges.
5. Persisted 6-max NLHE/PLO poker: seating, betting, side pots, deadlines, reconnects and viewer isolation.
6. Friends, invitations, table chat, presence, block/mute/report and administration.
7. Responsive interaction, audio, accessibility, integration tests and operational documentation.

## Structure

`src/app` pages and HTTP endpoints; `src/components` browser presentation; `src/domain` pure rules/types; `src/server` persistence/auth/services/maintenance; `tests` domain and integration tests; `e2e` browser flows; `scripts` local operator commands; `docs` decisions/rules.

## Economy and lifecycle decisions

Daily cycles begin at London noon, weekly periods on Monday noon, monthly periods on the first at noon. Daily aggregates persist; individual completed rounds are replaced on the next deal and expire after 24 hours. Chat and action-deduplication records expire after 24 hours; reports and admin audit records persist for moderation.

At noon, unfinished casino rounds and poker hands are voided, all poker seats are released, and every bankroll becomes exactly 10,000. Unsettled wagers have no performance effect. Settled results and rewards retain their original cycle. This explicit boundary avoids old-cycle chips leaking into a new bankroll. The interface announces the boundary. Reset catch-up is transactional and idempotent even after downtime.

No rake. Poker buy-ins 20–100 big blinds, 30-second turns, check when possible and otherwise fold on timeout. Disconnected players are sat out after the hand and may rejoin; no bots or automated wagering. Private tables require membership/invitation even for spectators. Public spectators only see exposed community/showdown cards.

Built-in avatars avoid upload storage and moderation complexity. Recovery uses a one-time code shown on registration and rotated after use. Admin access is granted by a local operator command, never by registration or browser input. Administrative bankroll adjustments are audited and excluded from competitive performance.

Blocking removes private invitations in both directions and marks affected private-table seats to leave after safe settlement. Public tables remain shared with blocked messages filtered. Administrators can apply 30-day suspensions, permanent bans, 24-hour chat mutes and audited removal of individual chat messages. Removed message evidence remains in the audit log.

### Casino card presentation

Casino snapshots remain authoritative and settle immediately on the server. A client-only sequence deals and flips cards in table order, preserving existing cards across hits, splits, and streets. Actions, totals and result banners wait for the sequence; the global bankroll still reflects the server immediately. Repeated snapshots do not replay it. Existing rounds on navigation/reload are shown immediately. Reduced motion or backgrounding skips the sequence, and unmount cancels timers. Original Web Audio paper brushes/taps follow deal and flip events through the persistent sitewide effects mixer. Audio now defaults on, with independent saved effects/music controls; see [AUDIO.md](AUDIO.md).

The Ultimate flop uses a grouped deal/flip event: three cards arrive stacked at the leftmost slot, turn together, and spread to the right into reserved board slots. The first card stays anchored during the spread. Timing is centralized in `dealPause`: face-down Ultimate dealer deliveries get a full 650ms beat, putting successive player-card deliveries 1,390ms apart. Fixed felt regions and reserved card slots keep the table stable during animations; Blackjack uses smaller, overlapping cards below a separate dealer region.

Newly settled casino rounds with positive net returns show a table-local win overlay after the reveal completes. It displays exact net profit, returned chips and wagered chips, with a brief gold accent animation and the saved effects-channel win cue. It fades after 3.8 seconds and also supports Continue/Escape. It never labels pushes or net losses as wins, does not replay on snapshots or navigation/reload, and is skipped when the page finishes revealing in the background. Reduced motion shows the same information without motion; persistent round results remain visible afterward. This is presentation only and does not change settlements, balances or game rules.

### Felt betting

Chip placement is an editable local wager preview until Deal is submitted through the existing validated server command. The tray offers 1/5/25/100/1,000 chips, native desktop dragging, and select-then-tap or keyboard placement. Undo and Clear change only the preview. Main/side limits and bankroll availability are checked locally for feedback and independently on the server. Ultimate Ante and Blind are linked; the Play spot shows the authoritative staged Play wager. Baccarat retains one selected outcome: placing on another outcome moves the selection and starts that spot with the new chip. A 100-chip main wager is preselected; the current preview is retained for repeat deals while the table remains open. Betting locks during requests, reveals, active hands, and disconnections.
