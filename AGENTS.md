# Fun Gambling — Codex Instructions

## Purpose

Build **Fun Gambling**, a polished play-money casino and poker web application using modern React and Next.js.

The product should feel like a complete online casino experience while remaining entertainment-only: all chips are fictional, have no monetary value, and can never be bought, sold, transferred, withdrawn, redeemed, or exchanged for anything of real-world value.

Use `PRODUCT.md` as the product source of truth when a task touches gameplay, economy, progression, leaderboards, accounts, profiles, social features, administration, design, or user-facing behavior. Do not force-read unrelated documentation for trivial changes.

## Codex autonomy

Codex owns the technical implementation unless a user request or an established repository decision says otherwise.

Choose appropriate architecture, libraries, persistence, realtime infrastructure, authentication implementation, deployment strategy, testing tools, project structure, and other engineering details. Prefer current stable, well-supported approaches for modern Next.js/React applications.

Optimize for a codebase that is:

- clean, elegant, and easy to understand;
- strongly typed where practical;
- modular without unnecessary abstraction;
- secure and difficult for clients to manipulate;
- easy to test and change;
- responsive on desktop and mobile;
- appropriate for an initial personal project with tens of concurrent users;
- capable of evolving without premature large-scale infrastructure.

Do not overengineer. Do not introduce dependencies, services, patterns, or layers merely because they might be useful someday.

When a product detail is intentionally unspecified, make a sensible decision using established conventions and document consequential choices. Ask the user only when a missing decision would materially change the intended product, create an irreversible constraint, or conflict with the product brief.

## Non-negotiable product boundaries

- This is **play-money only**. Never add real-money gambling, deposits, withdrawals, payment processing, chip purchasing, chip selling, chip transfers, cash-out, prizes with real-world value, or conversion to anything valuable.
- Chips and all related balances are fictional entertainment units only.
- The client must never be trusted to decide cards, outcomes, balances, wins, losses, or authoritative multiplayer state.
- Card dealing and RNG must be fair and implemented so users cannot manipulate outcomes from the browser.
- Poker is human-vs-human only. Do not add poker bots.
- Individual hand/session history should not become a permanent user-facing archive. Persist aggregate statistics that the product requires, while keeping detailed operational history only as long as reasonably needed.
- Admin functionality must not provide a mechanism to rig cards or force game outcomes.

## Engineering expectations

Follow the conventions of the repository as they emerge. Improve nearby code when it is directly helpful to the requested task, but avoid unrelated broad refactors.

Keep game rules, bankroll accounting, progression, leaderboard logic, and multiplayer state transitions explicit and testable. Prefer domain logic that can be verified independently from presentation code.

Treat all client input as untrusted. Validate authorization, game actions, bets, balances, state transitions, and administrative actions on the authoritative side of the application.

Pay particular attention to concurrency and duplicate-action problems around multiplayer turns, wagers, reconnects, daily resets, rewards, and balance updates.

Use accessible, responsive UI patterns. Motion, sound, VFX, and visual richness should enhance the experience without making core interaction unreliable or difficult to use.

Use only assets that are created for the project, properly licensed, or suitable placeholders. Do not casually introduce copyrighted casino artwork, music, sound effects, fonts, or other restricted assets. Record attribution when a third-party asset requires it.

## Testing and completion

Use testing appropriate to the feature being built. Game rules and money-like chip accounting deserve especially strong automated coverage, including edge cases and deterministic tests where useful.

For substantial changes, verify the complete user flow rather than stopping when the first implementation compiles. Run the relevant local checks, fix failures caused by the change, and rerun affected checks without asking for approval at every ordinary development step.

When changing behavior, update relevant tests and documentation in the same task.

A feature is not complete merely because the UI exists. The required state, validation, error handling, persistence/realtime behavior, security boundaries, and relevant tests should work together end-to-end.

## Documentation

Keep this file concise and durable. Do not turn `AGENTS.md` into an encyclopedia or duplicate implementation details that the code already makes obvious.

Use `PRODUCT.md` for durable product intent.

As the application grows, Codex may create focused architecture or subsystem documentation when it becomes genuinely useful. Such documentation should describe decisions the project has actually made, not speculative architecture.

If product behavior is deliberately changed by the user, update `PRODUCT.md`. If only the implementation changes, do not rewrite product intent to match an accidental technical detail.
