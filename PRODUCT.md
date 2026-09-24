# Fun Gambling — Product Brief

## Product vision

**Fun Gambling** is an entertaining, modern casino-style platform built entirely around fictional play-money chips.

The goal is to reproduce the breadth, excitement, polish, social interaction, progression, and competitive statistics of an online casino without real-money gambling. Users should be able to play casino table games, play poker against other people, build a profile, progress through achievements and XP, compete on leaderboards, and return each day with a fresh bankroll.

The application should feel premium enough to resemble established online casino products while clearly emphasizing **fun**, game-like progression, color, personality, and entertainment rather than financial gambling.

## Core principles

1. **No real value** — chips are fictional and cannot be purchased, sold, transferred between users, withdrawn, redeemed, or converted into money, prizes, crypto, credits, or anything else with real-world value.
2. **Fair play** — users must not be able to manipulate cards, wagers, balances, multiplayer state, statistics, or outcomes through the client.
3. **Fun first** — progression, achievements, social play, presentation, sounds, VFX, and competition should make losing fictional chips enjoyable rather than consequential.
4. **Casino authenticity where it matters** — games should use recognizable casino/poker rules and presentation instead of feeling like loose approximations.
5. **Modern quality** — the experience should be responsive, reliable, intuitive, polished, and suitable for both desktop and mobile.
6. **Simple initial scale** — this begins as a personal project intended for tens of concurrent users. Build well, but do not design it as if it already serves millions.

## Accounts and identity

Users have accounts centered on a unique username and password.

Profiles should support a profile picture and should expose useful public player information, including at least:

- username;
- profile picture;
- account creation date;
- current chip profit / current bankroll context;
- leaderboard rank;
- lifetime winnings;
- lifetime losses;
- lifetime net performance.

Profile pictures may come from built-in choices or user uploads.

The exact secure account-recovery mechanism is an implementation decision for Codex.

The current product brief does not require a project-specific age gate.

## Chip economy

Every user receives a standard bankroll of **10,000 chips** for each daily cycle.

The bankroll resets to exactly **10,000 chips every day at 12:00 in `Europe/London`**, following London local time including daylight-saving changes.

The reset is intentionally a fresh-start mechanic. A user's temporary chip balance does not carry forward simply because they ended the previous cycle above 10,000.

Daily net chip profit is conceptually based on the user's total chip position relative to the 10,000-chip starting bankroll. Losses count as negative performance.

Users may earn additional temporary chips through achievements, challenges, progression, or similar game systems. Those rewarded chips count toward net chip profit for the relevant period and remain part of the same fictional bankroll economy.

The application should also preserve meaningful aggregate gambling statistics separately where useful, such as chips won through wagers, chips lost through wagers, and lifetime net performance.

Users cannot send, gift, trade, or transfer chips to other users.

Exact betting limits, poker stake presets, buy-in ranges, and similar balance details may be chosen and refined by Codex as the games are implemented.

## Leaderboards

The primary competitive leaderboard measures overall net chip profit/performance.

Support leaderboard periods for:

- daily;
- weekly;
- monthly;
- all-time.

Time-bounded leaderboard periods should align sensibly with the product's London-time reset model. The all-time leaderboard does not reset.

Users should be able to inspect another player's public profile and statistics from competitive/social surfaces.

The bankroll reset and the leaderboard/statistics system are separate concepts: the spendable bankroll refreshes, while historical performance remains meaningful.

## Progression and retention

Fun Gambling should include videogame-like progression rather than relying only on chip balance.

Core progression includes:

- permanent achievements;
- permanent XP and player levels;
- recurring/daily challenges;
- rewards and interactive progression elements;
- visible accomplishments/status where appropriate.

Achievements and challenges may award XP, temporary chips, cosmetic/status rewards, or other non-monetary progression. The exact achievement catalog, XP curve, reward values, rarities, badges, cosmetics, and progression UX are intentionally left to Codex to design coherently.

Progression should make the platform more entertaining without turning chips into something of real-world value.

## Games

### Casino table games

The initial casino game set is:

- Ultimate Texas Hold'em;
- Blackjack;
- Baccarat.

These games are primarily **single-player against the house** rather than shared live multiplayer tables.

Use authentic, recognizable casino rules. When multiple legitimate casino variants or paytables exist and the product brief does not dictate one, Codex should choose a conventional variant, document the choice when it becomes relevant, and implement it consistently.

#### Blackjack

Blackjack should provide a full casino-style experience rather than a stripped-down demo.

Required product constraints include:

- splitting;
- doubling;
- no insurance;
- casino-style side bets, including **Perfect Pairs** and **21+3**.

Other exact rule parameters and paytables may be selected sensibly when the game is implemented.

#### Baccarat

Use standard **Punto Banco** style baccarat centered on Player, Banker, and Tie betting and conventional drawing behavior.

Additional side bets are not an initial requirement.

#### Ultimate Texas Hold'em

Use standard casino Ultimate Texas Hold'em gameplay with its normal staged betting structure.

The intended side bet is **Trips**. Do not expand the initial product with unnecessary additional Ultimate Hold'em side bets.

### Poker

Poker is real-time multiplayer against other human users.

Initial poker variants:

- No-Limit Texas Hold'em;
- Pot-Limit Omaha.

The initial poker product is focused on **cash games**, not tournaments.

Core poker expectations:

- human players only; no bots;
- 6-max tables;
- multiple tables may exist at the same time;
- public tables;
- private games that users can create and invite friends to;
- spectators;
- sensible action timers;
- reliable disconnect/reconnect behavior;
- table chat;
- chip stakes drawn from the user's current fictional bankroll.

The precise stake ladder, buy-in ranges, action timers, time-bank behavior, rake decision, seating flow, and related poker-room details are intentionally left for Codex to resolve when implementing the poker system.

Spectators must never gain access to unrevealed private cards or other information that would compromise a live game.

## Social features

The social layer should support:

- friends;
- friend requests and friend management;
- private poker invitations;
- poker-table chat;
- emojis and reactions;
- reasonable mute, block, and report controls;
- presence/online state where useful.

A general direct-message system is not part of the current required scope.

Social systems should support the casino/poker experience rather than becoming a separate social network.

## Fairness, integrity, and history

Cards and outcomes must be generated authoritatively outside the untrusted client. The browser must not be capable of choosing or modifying results.

Use a fair, security-appropriate RNG/shuffling approach. The exact implementation is a technical decision for Codex.

Detailed hand/session data may be retained temporarily when useful for active gameplay, reconnects, debugging, moderation, or operational integrity, but permanent individual hand-history archives are not a product requirement.

Permanent aggregate statistics, achievements, XP, leaderboard progress, account information, and other long-term product state may persist as required.

Design with obvious abuse cases in mind, including manipulated client requests, duplicate actions, spam, alternate-account exploitation, leaderboard farming, intentional disconnects, and poker collusion. The response should be proportionate to a small play-money project rather than enterprise anti-fraud infrastructure.

## Administration

Provide an admin dashboard with the practical controls needed to operate the site.

Administration may include capabilities such as:

- user moderation, suspension, and banning;
- chat/report moderation;
- profile-image moderation;
- management of progression/rewards and relevant product configuration;
- viewing operational game/session information when appropriate;
- announcements;
- support/debugging adjustments to user balances or statistics;
- oversight of active tables and platform state.

Sensitive administrative adjustments should be traceable/auditable.

Admin tools must not offer a way to rig cards, choose winners, or secretly force game outcomes.

The exact admin information architecture and implementation are up to Codex.

## Visual and interaction direction

The visual language should sit between a polished luxury online casino and a colorful videogame.

Primary direction:

- dark theme as the foundation;
- rich color and lighting rather than a flat monochrome UI;
- premium casino cues without becoming overly serious;
- tasteful 3D-feeling depth, VFX, particles, motion, card/chip animation, and celebratory feedback;
- clear emphasis on the **fun-play** identity;
- polished lobby/game presentation;
- excellent usability on desktop and mobile.

The exact navigation, lobby organization, page structure, component system, animation technology, and rendering approach should be designed by Codex to fit the evolving product.

## Sound and atmosphere

Sound is part of the intended experience.

Casino table cards should move smoothly with a natural dealing rhythm and fitting card sounds. Ultimate Hold'em's flop lands as a single stacked packet, turns together, and fans out into three cards. Blackjack uses compact cards and generous separation between dealer and player hands. Keep unrevealed dealer cards face-down, respect the sound control and reduced-motion preferences, and show round results after the reveal finishes.

Place wagers directly on marked felt spots using a draggable chip tray, with tap/keyboard placement as an accessible alternative. Include undo and clear controls, visible wager totals, and linked equal Ante/Blind bets in Ultimate Hold'em. Preserve the specified games and side bets; the visual reference does not introduce additional side bets.

The Ultimate flop spreads from a stack at the leftmost card position toward the right. Opening deliveries should have a measured cadence, including a full pause after a face-down dealer card. After a net-positive casino round finishes revealing, show a brief, dismissible win celebration with the net chips won and a clear returned-versus-wagered breakdown. Pushes and rounds with a net loss must not be presented as wins. Respect reduced motion and existing sound controls.

Use appropriate effects such as:

- card dealing/flips;
- chips and wagers;
- wins, achievements, and progression feedback;
- subtle interface feedback;
- calming casino/lounge jazz background music, with a distinct track for the lobby/home and each game.

Music and sound assets must be original, appropriately licensed, or otherwise legally usable for the project. Provide sensible user controls for audio rather than forcing continuous sound.

Music and sound effects are enabled by default at restrained volumes. A global audio settings menu provides separate effects/music volume sliders and mute controls, with preferences saved across navigation and sessions. Tracks transition with smooth crossfades and loop without abrupt gaps; unrelated navigation and live-state updates must not restart music. Respect browser autoplay restrictions by starting as soon as permitted, including retrying on the first user interaction, without silently changing default-on preferences. Refine action sounds into natural, rounded card/chip/table effects and warm musical cues that remain responsive and unobtrusive. Credit all third-party tracks and retain their license information.

## What is intentionally left to Codex

This document defines **what Fun Gambling is**, not a rigid technical specification.

Codex should make good engineering/product-detail decisions as implementation progresses, including where appropriate:

- application architecture and repository structure;
- exact Next.js/React patterns;
- TypeScript configuration;
- database, ORM, cache, realtime, hosting, and infrastructure choices;
- authentication/session implementation and recovery flow;
- testing libraries and CI approach;
- exact poker stakes and buy-ins;
- conventional rule/paytable choices not explicitly fixed above;
- achievement catalog, XP curve, challenge design, and reward values;
- detailed hand/session retention duration;
- exact admin UX;
- detailed navigation and lobby information architecture;
- animation/VFX implementation;
- incremental build order and internal milestones.

Prefer coherent, conventional decisions over repeatedly stopping for minor choices. When Codex makes a consequential choice that future work needs to understand, record it in the appropriate project documentation rather than expanding this product brief with incidental implementation detail.
