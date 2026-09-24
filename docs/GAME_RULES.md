# Implemented rules

All payouts below are **profit odds**, plus the returned winning stake. Amounts use integer hundredths of fictional chips. Casino base wagers are 1–1,000 whole chips and optional side wagers 0–100. Crypto Fisher–Yates shuffles occur on the server. No outcome configuration or administration function can choose cards or winners.

## Blackjack

Six decks, freshly shuffled per round; dealer stands on all 17s, checks for blackjack before player actions. Naturals pay 3:2; ordinary wins 1:1; pushes return stakes. No insurance or surrender. Double any initial two cards, including after splitting. Split equal ranks up to four hands. Split aces get exactly one extra card each, cannot re-split, and cannot double. A split two-card 21 is not a natural and pays 1:1.

Perfect Pairs: mixed-colour pair 6:1; same-colour pair 12:1; identical rank/suit 25:1. 21+3 combines the first two player cards with the dealer upcard: flush 5:1, straight 10:1, trips 30:1, straight flush 40:1, suited trips 100:1. Ace may be low in A-2-3 or high in Q-K-A. Side bets settle with the overall hand.

## Baccarat

Eight decks, freshly shuffled per round. Standard Punto Banco natural and third-card rules. Ace = 1, tens/faces = 0, other cards face value; total modulo ten. Natural 8/9 ends drawing. Player draws on 0–5. If player stands, Banker draws on 0–5. If player draws, Banker draws on 0–2; on 3 unless player's third is 8; on 4 when third is 2–7; on 5 when third is 4–7; on 6 when third is 6–7; otherwise stands. Player pays 1:1, Banker 0.95:1, Tie 8:1. Ties push Player/Banker wagers.

## Ultimate Texas Hold'em

One deck; equal Ante/Blind. Preflop check or 3×/4× Play; flop check or 2× Play; river 1× Play or fold. Only one Play wager. Best five of seven cards. Dealer qualifies with a pair: an unqualified dealer pushes Ante, while Play and Blind still resolve against dealer. Main wagers push on ties. Play/qualified Ante pay 1:1 when player wins. Winning Blind pushes below straight, otherwise straight 1:1, flush 3:2, full house 3:1, quads 10:1, straight flush 50:1, royal flush 500:1.

Trips is independent of dealer/folding: trips 3:1, straight 4:1, flush 7:1, full house 8:1, quads 30:1, straight flush 40:1, royal flush 50:1 (UTH-03). Folding loses Ante/Blind but still settles Trips. Entry requires enough available chips for Ante, Blind, Trips and a possible 1× river Play.

## Poker

6-max human-only cash games, no rake, 10/20 or 50/100 blinds, 20–100 BB buy-ins. NLHE uses any best five of seven; PLO uses exactly two hole cards and three board cards. Heads-up button posts small blind and acts first preflop, last postflop. Full raises must meet the previous full raise size. Short all-ins are permitted, with cumulative reopening rules. PLO maximum raise-to = player's current street contribution + call + current pot + call.

Side pots use contribution levels, including folded contributions, and only eligible live hands can win. Uncalled excess is returned. Ties split equally; odd hundredths go clockwise from the dealer. Players need at least a big blind to enter a new hand. Joining during a hand waits for the next deal. No rebuy during a hand; leave and buy in again between hands.

Turns last 30 seconds, with no additional time bank. Timeout checks if free, otherwise folds, then sits out next hand. Disconnected cards/seats persist. A leave request during a hand checks/folds future turns and cashes the stack back to the fictional bankroll after settlement. The next hand starts after an eight-second result interval when two players are ready. After five minutes of inactivity, seats are released after settlement. A moderator suspension also releases the seat safely.

## Sources consulted

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) for runtime/tooling setup.
- [SQLite transactions](https://www.sqlite.org/lang_transaction.html) and [WAL](https://www.sqlite.org/wal.html) for concurrency decisions.
- [Bicycle Baccarat](https://bicyclecards.com/how-to-play/baccarat) for Punto Banco drawing conventions.
- [PokerStars Omaha](https://www.pokerstars.com/poker/games/omaha/) for exact hole-card usage and pot-limit betting.
- [Washington Gambling Commission Ultimate Texas Hold'em rules and paytables](https://wsgc.wa.gov/sites/default/files/2024-08/3160_Approval%26ROP_StadiumUltimateTexasHold%27Em.pdf) for the UTH-03 Trips schedule.
- [Poker TDA betting rules](https://www.pokertda.com/view-poker-tda-rules/) for full-raise and cumulative short-all-in reopening conventions. A checked player facing less than a minimum bet cannot raise unless an intervening full wager reopens action.

The application rules panels expose the selected variants and paytables to players. Tests lock these choices down.
