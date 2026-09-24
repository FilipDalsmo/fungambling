import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
async function join(page: Page, prefix: string) {
  const username = `${prefix}_${randomUUID().slice(0, 8)}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Join the fun" }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password-123");
  await page.getByRole("button", { name: "Let’s play" }).click();
  await expect(
    page.getByRole("heading", { name: "Save your recovery code" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I’ve saved my code" }).click();
  await expect(page.getByTestId("balance")).toHaveText("10,000");
  return username;
}
test("accounts, casino games, progression, profiles and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const username = await join(page, "Casino");
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: "Baccarat", exact: false })
    .click();
  for (let hand = 0; hand < 5; hand++) {
    await page.getByRole("button", { name: "Deal cards" }).click();
    await expect(page.locator(".round-message")).toContainText("wins");
    await expect(
      page.getByRole("button", { name: "Deal cards" }),
    ).toBeEnabled();
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Progression" })
    .click();
  await expect(
    page.getByRole("button", { name: "Collect reward" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Collect reward" }).click();
  await expect(
    page.getByRole("button", { name: "Reward collected" }),
  ).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: "Blackjack" })
    .click();
  await page.getByRole("button", { name: "Deal cards" }).click();
  // Naturals can complete immediately; otherwise standing must finish the hand.
  await expect
    .poll(async () => await page.locator(".round-message").textContent())
    .not.toBe("");
  if (await page.getByRole("button", { name: "Stand", exact: true }).count())
    await page.getByRole("button", { name: "Stand", exact: true }).click();
  await expect(page.getByRole("button", { name: "Deal cards" })).toBeEnabled();
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: "Ultimate Hold’em" })
    .click();
  await page.getByRole("button", { name: "Deal cards" }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(".board-zone .table-label")).toHaveText("FLOP");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "Play 1×" }).click();
  await expect(page.getByRole("button", { name: "Deal cards" })).toBeEnabled();
  await page.getByRole("button", { name: "Open your profile" }).click();
  await page.getByRole("button", { name: "Avatar 3", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Avatar 3", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Leaderboards" })
    .click();
  await expect(page.locator(".leaderboard")).toContainText(username);
  await page.getByRole("button", { name: "Fun Gambling home" }).click();
  await page.screenshot({
    path: "test-results/lobby-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/lobby-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open your profile" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("two humans play poker, reconnect, use chat and private invitations", async ({
  browser,
}) => {
  const contextA = await browser.newContext(),
    contextB = await browser.newContext();
  const a = await contextA.newPage(),
    b = await contextB.newPage();
  const alice = await join(a, "Alice"),
    bob = await join(b, "Bobby");
  for (const page of [a, b]) {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Poker room" })
      .click();
    await page.getByRole("button", { name: /Emerald 10\/20/ }).click();
  }
  await a.getByRole("button", { name: "Seat 1", exact: false }).click();
  await b.getByRole("button", { name: "Seat 2", exact: false }).click();
  await expect(a.locator(".poker-controls")).toContainText("Your move");
  await expect(b.locator(".poker-controls")).toContainText(
    "Waiting for the table",
  );
  await a.getByRole("button", { name: "Call 10", exact: true }).click();
  await b.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    a.locator(".poker-board .cards [aria-label='Face-down card']"),
  ).toHaveCount(2);
  await b.getByLabel("Message", { exact: true }).fill("Good luck 👋");
  await b.getByRole("button", { name: "Send", exact: true }).click();
  await expect(a.getByRole("log")).toContainText("Good luck 👋");
  await a.reload();
  await a.getByRole("button", { name: "Resume table" }).click();
  await expect(a.locator(".poker-controls")).toContainText(
    "Waiting for the table",
  );
  await b.getByRole("button", { name: "Fold", exact: true }).click();
  await expect(a.locator(".poker-message")).toContainText("receives");
  await a.screenshot({
    path: "test-results/poker-desktop.png",
    fullPage: true,
  });
  for (const page of [a, b]) {
    await page
      .getByRole("button", { name: "Leave table", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Friends" })
      .click();
  }
  await a.getByLabel("Find a player").fill(bob);
  await a.getByRole("button", { name: "Add friend" }).click();
  await b.getByLabel("Find a player").fill(alice);
  await b.getByRole("button", { name: "Accept request" }).click();
  await a
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Poker room" })
    .click();
  await a.getByLabel("Table name").fill("Our private table");
  await a
    .getByRole("combobox", { name: "Game", exact: true })
    .selectOption("plo");
  await a.getByRole("button", { name: "Create private table" }).click();
  await a.getByLabel("Invite a friend").selectOption({ label: bob });
  await a.getByRole("button", { name: "Invite to table" }).click();
  await b
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Poker room" })
    .click();
  await expect(
    b.getByRole("button", { name: /Our private table/ }),
  ).toBeVisible();
  await b.getByRole("button", { name: /Our private table/ }).click();
  await a.getByRole("button", { name: "Seat 1", exact: false }).click();
  await b.getByRole("button", { name: "Seat 2", exact: false }).click();
  await expect(a.locator(".seat-0 .playing-card")).toHaveCount(4);
  await expect(a.locator(".seat-1 .card-back")).toHaveCount(4);
  await a.getByRole("button", { name: "Call 10", exact: true }).click();
  await b.getByRole("button", { name: "Check", exact: true }).click();
  for (let street = 0; street < 3; street++) {
    await b.getByRole("button", { name: "Check", exact: true }).click();
    await a.getByRole("button", { name: "Check", exact: true }).click();
  }
  await expect(a.locator(".poker-message")).toContainText("receives");
  await a.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      a.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await a.screenshot({ path: "test-results/poker-mobile.png", fullPage: true });
  await a.getByRole("button", { name: "Leave table", exact: true }).click();
  await b.getByRole("button", { name: "Leave table", exact: true }).click();
  await contextA.close();
  await contextB.close();
});
test("HTTP rejects CSRF and replayed wagers, ignores forged authority, and revokes logout", async ({
  request,
}) => {
  const origin = { Origin: "http://localhost:3100" };
  const auth = await request.post("/api/auth", {
    headers: origin,
    data: {
      action: "register",
      username: `API_${randomUUID().slice(0, 8)}`,
      password: "api-test-password-123",
      role: "admin",
      balance: 99999999,
    },
  });
  expect(auth.status()).toBe(200);
  expect(auth.headers()["set-cookie"]).toContain("HttpOnly");
  expect(auth.headers()["set-cookie"].toLowerCase()).toContain(
    "samesite=strict",
  );
  const initial = await (await request.get("/api/state")).json();
  expect(initial.me.role).toBe("player");
  expect(initial.me.balance).toBe(1000000);
  expect(initial.me.password).toBeUndefined();
  const payload = {
    id: randomUUID(),
    command: "deal",
    data: { kind: "baccarat", bet: 10, deck: [], returned: 99999999 },
  };
  const denied = await request.post("/api/action", {
    headers: { Origin: "https://untrusted.example" },
    data: payload,
  });
  expect(denied.status()).toBe(403);
  const requests = await Promise.all([
    request.post("/api/action", { headers: origin, data: payload }),
    request.post("/api/action", { headers: origin, data: payload }),
  ]);
  expect(requests.map((r) => r.status()).sort()).toEqual([200, 409]);
  const state = await (await request.get("/api/state")).json();
  expect(state.me.games).toBe(1);
  expect(state.round.returned).toBeLessThanOrEqual(9000);
  expect(state.round.deck).toBeUndefined();
  const admin = await request.post("/api/action", {
    headers: origin,
    data: {
      id: randomUUID(),
      command: "admin",
      data: {
        action: "announcement",
        text: "forged",
        reason: "Unauthorized attempt",
      },
    },
  });
  expect(admin.status()).toBe(403);
  await request.post("/api/auth", {
    headers: origin,
    data: { action: "logout" },
  });
  expect((await request.get("/api/state")).status()).toBe(401);
});
test("admin dashboard applies audited changes and publishes configuration", async ({
  page,
}) => {
  const username = await join(page, "Admin");
  execFileSync(process.execPath, ["scripts/admin.mjs", username], {
    env: { ...process.env, DATABASE_PATH: process.env.E2E_DATABASE_PATH },
  });
  await page.getByRole("button", { name: "Administration" }).click();
  const support = page
    .locator("section.panel")
    .filter({ has: page.getByRole("heading", { name: "Player support" }) });
  const me = await (await page.request.get("/api/state")).json();
  await support
    .getByRole("combobox", { name: "Player", exact: true })
    .selectOption(me.me.id);
  await support
    .getByRole("combobox", { name: "Action", exact: true })
    .selectOption("balance");
  await support.getByLabel("Chip adjustment (balance action only)").fill("75");
  await support
    .getByLabel("Reason for audit log")
    .fill("Browser verified support adjustment");
  await support.getByRole("button", { name: "Apply & record" }).click();
  await expect(page.getByTestId("balance")).toHaveText("10,075");
  await expect(page.locator(".admin-section").last()).toContainText(
    "Browser verified support adjustment",
  );
  const announce = page
    .locator("form")
    .filter({ has: page.getByLabel("Lobby announcement") });
  await announce
    .getByLabel("Lobby announcement")
    .fill("Welcome to the tables!");
  await announce
    .getByLabel("Reason", { exact: true })
    .fill("Browser validation announcement");
  await announce.getByRole("button", { name: "Publish announcement" }).click();
  await expect(page.locator(".announcement")).toContainText(
    "Welcome to the tables!",
  );
  const gameState = await (await page.request.get("/api/state")).json();
  await page.request.post("/api/action", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      id: randomUUID(),
      command: "chat",
      data: {
        tableId: gameState.tables[0].id,
        body: "Message for moderation test",
      },
    },
  });
  const message = page
    .locator(".report")
    .filter({ hasText: "Message for moderation test" });
  await message.getByLabel("Removal reason").fill("Remove this test message");
  await message.getByRole("button", { name: "Remove message" }).click();
  await expect(message).toHaveCount(0);
  await expect(page.locator(".admin-section").last()).toContainText(
    "Remove this test message",
  );
});

test("paced table deals, flips, audio and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = AudioBufferSourceNode.prototype.start;
    Object.assign(window, { cardSounds: 0 });
    AudioBufferSourceNode.prototype.start = function (...args) {
      const tracker = window as unknown as { cardSounds: number };
      tracker.cardSounds++;
      return original.apply(this, args);
    };
  });
  await join(page, "Deal");
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: "Baccarat" })
    .click();
  // Effects default on and unlock during account interaction.
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(page.locator(".round-message")).toHaveText("Dealing...");
  await expect(page.locator(".bet-form > button")).toBeDisabled();
  await expect(page.locator('.dealt-card[data-face-up="true"]')).toHaveCount(1);
  await expect(page.locator(".round-message")).toContainText("wins");
  const cardCount = await page.locator(".dealt-card").count();
  await expect(page.locator('.dealt-card[data-face-up="true"]')).toHaveCount(
    cardCount,
  );
  const sounds = await page.evaluate(
    () => (window as unknown as { cardSounds: number }).cardSounds,
  );
  expect(sounds).toBe(cardCount * 2);
  await page.getByRole("button", { name: "Audio settings" }).click();
  await page
    .getByRole("checkbox", { name: "Enable game / sound effects" })
    .uncheck();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(page.locator(".round-message")).toHaveText("Dealing...");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Deal cards" })).toBeEnabled();
  expect(
    await page.evaluate(
      () => (window as unknown as { cardSounds: number }).cardSounds,
    ),
  ).toBe(sounds);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/table-deal-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("felt chip placement, limits, undo and a collective Ultimate flop", async ({
  page,
}) => {
  await join(page, "Chips");
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: /Ultimate/ })
    .click();
  await page.getByRole("button", { name: "Clear bets" }).click();
  await expect(page.getByRole("button", { name: "Deal cards" })).toBeDisabled();
  await page
    .getByRole("button", { name: "25 chip", exact: true })
    .dragTo(page.locator('[data-bet-spot="bet"]'));
  await expect(page.locator('[data-bet-spot="bet"]')).toHaveAttribute(
    "aria-label",
    "Ante: 25 chips",
  );
  await expect(page.locator('[data-bet-spot="blind"]')).toHaveAttribute(
    "aria-label",
    "Blind: 25 chips",
  );
  await page.getByRole("button", { name: "5 chip", exact: true }).click();
  await page.locator('[data-bet-spot="side"]').click();
  await expect(page.locator(".table-bankroll")).toContainText("55");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-bet-spot="side"]')).toHaveAttribute(
    "aria-label",
    "Trips: 0 chips",
  );
  await page.getByRole("button", { name: "1000 chip", exact: true }).click();
  await page.locator('[data-bet-spot="side"]').click();
  await expect(page.locator(".bet-error")).toContainText("maximum 100 chips");
  await page.getByRole("button", { name: "5 chip", exact: true }).click();
  await page.locator('[data-bet-spot="side"]').click();
  await page.screenshot({
    path: "test-results/ultimate-chip-table-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
  const state = await (await page.request.get("/api/state")).json();
  expect(state.round.bet).toBe(2500);
  expect(state.round.side).toBe(500);
  expect(state.round.wagered).toBe(5500);
  await expect(page.locator('[data-bet-spot="bet"]')).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(".board-zone .flop-card")).toHaveCount(3);
  const spread = await page
    .locator(".board-zone .flop-card")
    .evaluateAll((nodes) => {
      const frames = nodes.map((node) => node.getAnimations()[0]);
      frames.forEach((frame) => {
        frame.pause();
        frame.currentTime = 600;
      });
      const stacked = nodes.map((node) => node.getBoundingClientRect().x);
      frames.forEach((frame) => {
        frame.currentTime = 1250;
      });
      const settled = nodes.map((node) => node.getBoundingClientRect().x);
      frames.forEach((frame) => {
        frame.currentTime = 850;
      });
      const spreading = nodes.map((node) => node.getBoundingClientRect().x);
      frames.forEach((frame) => frame.play());
      return { stacked, settled, spreading };
    });
  expect(Math.abs(spread.stacked[0] - spread.settled[0])).toBeLessThan(1);
  expect(spread.stacked[2] - spread.stacked[0]).toBeLessThan(6);
  expect(spread.spreading[1]).toBeGreaterThan(spread.stacked[1]);
  expect(spread.spreading[2]).toBeGreaterThan(spread.stacked[2]);
  expect(spread.spreading[2]).toBeLessThan(spread.settled[2]);

  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeDisabled();
  await expect(page.locator('.board-zone [data-face-up="true"]')).toHaveCount(
    3,
  );
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/ultimate-flop-desktop.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: /Play 1/ }).click();
  await expect(page.getByRole("button", { name: "Deal cards" })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/ultimate-chip-table-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "25 chip", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-bet-spot="blind"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-bet-spot="bet"]')).toHaveAttribute(
    "aria-label",
    "Ante: 50 chips",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: "Blackjack" })
    .click();
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(page.locator('.player-zone [data-face-up="true"]')).toHaveCount(
    2,
  );
  const dealer = await page.locator(".dealer-zone").boundingBox();
  const player = await page.locator(".player-zone").boundingBox();
  expect(player!.y - (dealer!.y + dealer!.height)).toBeGreaterThan(70);
  expect(
    (await page.locator(".player-zone .dealt-card").first().boundingBox())!
      .width,
  ).toBeLessThan(60);
  await page.screenshot({
    path: "test-results/blackjack-table-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/blackjack-table-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("win presentation waits for the reveal, excludes pushes and losses, and never replays", async ({
  page,
}) => {
  await join(page, "WinUI");
  const snapshot = await (await page.request.get("/api/state")).json();
  // Presentation fixtures only: no game outcomes or balances are changed on the server.
  await page.route("**/api/state*", (route) =>
    route.fulfill({ json: snapshot }),
  );
  await page.addInitScript(() => {
    class SnapshotEvents extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      timer = setInterval(async () => {
        const data = await (await fetch("/api/state")).json();
        this.onmessage?.(
          new MessageEvent("message", { data: JSON.stringify(data) }),
        );
      }, 150);
      close() {
        clearInterval(this.timer);
      }
    }
    Object.defineProperty(window, "EventSource", { value: SnapshotEvents });
  });
  let hand = 0;
  const returns = [20000, 10000, 5000, 20000];
  await page.route("**/api/action", (route) => {
    snapshot.serverTime++;
    snapshot.round = {
      id: "presentation-" + hand,
      revision: 0,
      kind: "baccarat",
      stage: "done",
      player: [
        { rank: 10, suit: "h" },
        { rank: 9, suit: "s" },
      ],
      dealer: [
        { rank: 5, suit: "c" },
        { rank: 2, suit: "d" },
      ],
      board: [],
      hands: [],
      active: 0,
      bet: 10000,
      side: 0,
      side2: 0,
      target: "player",
      wagered: 10000,
      returned: returns[hand++],
      message: "Presentation fixture",
      play: 0,
      created: Date.now(),
    };
    return route.fulfill({ json: { result: true } });
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: "Baccarat" })
    .click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(page.locator(".round-message")).toHaveText("Dealing...");
  await expect(page.getByTestId("win-celebration")).toHaveCount(0);
  await expect(page.getByTestId("win-celebration")).toBeVisible();
  await expect(page.locator(".win-amount")).toHaveAttribute(
    "aria-label",
    "You won 100 chips net",
  );
  await expect(page.locator(".win-breakdown")).toHaveText(
    "200 returned \u00b7 100 wagered",
  );
  await page.screenshot({
    path: "test-results/win-celebration-desktop.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("win-celebration")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Deal cards" }).click();
    await expect(
      page.getByRole("button", { name: "Deal cards" }),
    ).toBeEnabled();
    await expect(page.getByTestId("win-celebration")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(page.getByTestId("win-celebration")).toBeVisible();
  expect(
    await page
      .locator(".win-panel")
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.screenshot({
    path: "test-results/win-celebration-mobile.png",
    fullPage: true,
  });
  await expect(page.getByTestId("win-celebration")).toHaveCount(0, {
    timeout: 5000,
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: "Baccarat" })
    .click();
  await expect(page.locator(".round-message")).toHaveText(
    /Presentation fixture/,
  );
  await expect(page.getByTestId("win-celebration")).toHaveCount(0);
});

test("global audio defaults, persistent independent volumes, music continuity and loops", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const players: HTMLAudioElement[] = [];
    Object.defineProperty(window, "testMusic", { value: players });
    Object.defineProperty(window, "Audio", {
      value: function (src?: string) {
        const element = new NativeAudio(src);
        players.push(element);
        return element;
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await join(page, "Audio");
  const playing = () =>
    page.evaluate(() =>
      (window as unknown as { testMusic: HTMLAudioElement[] }).testMusic
        .filter((a) => !a.paused && a.readyState >= 2)
        .map((a) => ({ src: a.src, position: a.currentTime })),
    );
  await expect
    .poll(async () =>
      (await playing()).some((a) => a.src.includes("lobby-time")),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Audio settings" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Enable game / sound effects" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Enable background music" }),
  ).toBeChecked();
  await page
    .getByRole("slider", { name: "Game / sound effects volume", exact: true })
    .fill("37");
  await page
    .getByRole("slider", { name: "Background music volume", exact: true })
    .fill("18");
  await expect(
    page.getByRole("slider", {
      name: "Game / sound effects volume",
      exact: true,
    }),
  ).toHaveValue("37");
  await page
    .getByRole("checkbox", { name: "Enable game / sound effects" })
    .uncheck();
  await expect.poll(async () => (await playing()).length).toBe(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const first = await page.evaluate(() => {
    const player = (
      window as unknown as { testMusic: HTMLAudioElement[] }
    ).testMusic.find((a) => !a.paused)!;
    player.currentTime = 25;
    return player.src;
  });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Leaderboards" })
    .click();
  expect((await playing())[0].src).toBe(first);
  expect((await playing())[0].position).toBeGreaterThanOrEqual(25);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { testMusic: HTMLAudioElement[] }).testMusic
          .length,
    ),
  ).toBe(1);
  await page
    .getByRole("navigation", { name: "Casino games" })
    .getByRole("button", { name: "Blackjack" })
    .click();
  await expect
    .poll(async () =>
      (await playing()).some((a) => a.src.includes("airport-lounge")),
    )
    .toBe(true);
  await expect.poll(async () => (await playing()).length).toBe(1);
  await page.getByRole("button", { name: "Fun Gambling home" }).click();
  await expect
    .poll(async () =>
      (await playing()).some(
        (a) => a.src.includes("lobby-time") && a.position >= 25,
      ),
    )
    .toBe(true);
  await expect.poll(async () => (await playing()).length).toBe(1);
  // Advance into the measured tail: a fresh opening overlaps before silence.
  const beforeLoop = await page.evaluate(() => {
    const players = (window as unknown as { testMusic: HTMLAudioElement[] })
      .testMusic;
    players.find((a) => !a.paused)!.currentTime = 187;
    return players.length;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { testMusic: HTMLAudioElement[] }).testMusic
            .length,
      ),
    )
    .toBeGreaterThan(beforeLoop);
  await expect.poll(async () => (await playing()).length).toBe(1);
  expect((await playing())[0].position).toBeLessThan(10);
  await page.getByRole("button", { name: "Audio settings" }).click();
  await page
    .getByRole("checkbox", { name: "Enable background music" })
    .uncheck();
  await expect.poll(async () => (await playing()).length).toBe(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Audio settings" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Enable game / sound effects" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Enable background music" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("slider", {
      name: "Game / sound effects volume",
      exact: true,
    }),
  ).toHaveValue("37");
  await expect(
    page.getByRole("slider", { name: "Background music volume", exact: true }),
  ).toHaveValue("18");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/audio-settings-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("audio autoplay and download failures preserve enabled preferences and recover on interaction", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { testBlockAudio: true });
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () {
      if ((window as unknown as { testBlockAudio: boolean }).testBlockAudio)
        return Promise.reject(
          new DOMException("Autoplay blocked", "NotAllowedError"),
        );
      return resume.call(this);
    };
  });
  await page.route("**/audio/music/*.mp3", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Audio settings" }).click();
  await expect(page.getByRole("button", { name: "Start audio" })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Enable background music" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Enable game / sound effects" }),
  ).toBeChecked();
  await page.evaluate(() => {
    (window as unknown as { testBlockAudio: boolean }).testBlockAudio = false;
  });
  await page.getByRole("button", { name: "Start audio" }).click();
  await expect(page.getByRole("button", { name: "Retry audio" })).toBeVisible();
  await page.unroute("**/audio/music/*.mp3");
  await page.getByRole("button", { name: "Retry audio" }).click();
  await expect(page.locator(".audio-now-playing")).toContainText("NOW PLAYING");
  await expect(
    page.getByRole("checkbox", { name: "Enable background music" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("button", { name: "Join the fun" }),
  ).toBeEnabled();
});
