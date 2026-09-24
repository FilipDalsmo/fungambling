import { casinoView } from "@/domain/casino";
import { pokerView } from "@/domain/poker";
import { nextReset, periodStart } from "@/domain/time";
import type { Profile, User } from "@/domain/models";
import { allTables, allUsers, getUser, saveUser, type DB } from "./db";
import { getRound, getTable, tableAccess } from "./games";
import { setting } from "./social";
export function snapshot(
  db: DB,
  userId: string,
  tableId?: string,
  now = Date.now(),
) {
  const user = getUser(db, userId)!;
  if (user.lastSeen < now - 10_000) {
    user.lastSeen = now;
    saveUser(db, user);
  }
  const users = allUsers(db),
    tables = allTables(db);
  const position = (u: User) =>
    u.balance +
    tables.reduce(
      (n, t) =>
        n +
        t.seats.reduce(
          (sum, s) =>
            sum +
            (s?.userId === u.id
              ? s.stack + (t.status === "playing" ? s.committed : 0)
              : 0),
          0,
        ),
      0,
    ) +
    ((r) => (r && r.stage !== "done" ? r.wagered : 0))(getRound(db, u.id));
  const periods = ["daily", "weekly", "monthly", "all-time"] as const;
  const leaderboard = Object.fromEntries(
    periods.map((period) => {
      const results = db
        .prepare(
          "SELECT user_id,SUM(profit) AS profit FROM stats WHERE cycle>=? GROUP BY user_id",
        )
        .all(periodStart(period, new Date(now))) as {
        user_id: string;
        profit: number;
      }[];
      const scores = new Map(results.map((r) => [r.user_id, r.profit]));
      return [
        period,
        users
          .filter((u) => u.bannedUntil <= now)
          .map((u) => ({
            id: u.id,
            username: u.username,
            avatar: u.avatar,
            profit: scores.get(u.id) ?? 0,
          }))
          .sort(
            (a, b) =>
              b.profit - a.profit || a.username.localeCompare(b.username),
          )
          .map((u, index, rows) => ({
            ...u,
            rank: rows.findIndex((r) => r.profit === u.profit) + 1,
          })),
      ];
    }),
  ) as Record<
    (typeof periods)[number],
    {
      id: string;
      username: string;
      avatar: number;
      profit: number;
      rank: number;
    }[]
  >;
  const profiles: Profile[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    created: u.created,
    xp: u.xp,
    games: u.games,
    won: u.won,
    lost: u.lost,
    achievements: u.achievements,
    balance: position(u),
    profit: leaderboard.daily.find((r) => r.id === u.id)?.profit ?? 0,
    net: u.won - u.lost,
    rank: leaderboard["all-time"].find((r) => r.id === u.id)?.rank ?? 0,
    online: u.lastSeen > now - 45_000,
  }));
  const round = getRound(db, user.id);
  const t = tableId ? getTable(db, tableId, user.id) : undefined;
  const chat = t
    ? (db
        .prepare(
          `SELECT c.id,c.user_id AS userId,u.username,c.body,c.created FROM chat c JOIN users u ON u.id=c.user_id
    WHERE c.table_id=? AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.owner=? AND b.target=c.user_id) OR (b.owner=c.user_id AND b.target=? AND b.muted=0)) ORDER BY c.created DESC LIMIT 60`,
        )
        .all(t.id, user.id, user.id) as {
        id: string;
        userId: string;
        username: string;
        body: string;
        created: number;
      }[])
    : [];
  return {
    me: user,
    profiles,
    leaderboard,
    resetAt: nextReset(new Date(now)),
    serverTime: now,
    announcement: setting(db, "announcement", ""),
    dailyReward: Number(setting(db, "dailyReward", "200")),
    round: round ? casinoView(round) : null,
    tables: tables
      .filter((t) => tableAccess(db, t, user.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        variant: t.variant,
        bigBlind: t.bigBlind,
        private: t.private,
        owner: t.owner,
        players: t.seats.filter(Boolean).length,
        seated: t.seats.some((s) => s?.userId === user.id),
      })),
    table: t ? pokerView(t, user.id) : null,
    chat: chat.reverse(),
    friends: db
      .prepare(
        "SELECT sender,recipient,accepted FROM friends WHERE sender=? OR recipient=?",
      )
      .all(user.id, user.id) as {
      sender: string;
      recipient: string;
      accepted: number;
    }[],
    blocks: db
      .prepare("SELECT target,muted FROM blocks WHERE owner=?")
      .all(user.id) as { target: string; muted: number }[],
    admin:
      user.role === "admin"
        ? {
            users: users.map((u) => ({
              id: u.id,
              username: u.username,
              balance: u.balance,
              bannedUntil: u.bannedUntil,
              mutedUntil: u.mutedUntil,
            })),
            chat: db
              .prepare(
                "SELECT id,user_id AS userId,table_id AS tableId,body,created FROM chat ORDER BY created DESC LIMIT 100",
              )
              .all() as {
              id: string;
              userId: string;
              tableId: string;
              body: string;
              created: number;
            }[],
            reports: db
              .prepare("SELECT * FROM reports ORDER BY created DESC LIMIT 100")
              .all() as {
              id: string;
              reporter: string;
              target: string;
              reason: string;
              evidence: string;
              created: number;
              resolved: number;
            }[],
            audit: db
              .prepare("SELECT * FROM audit ORDER BY created DESC LIMIT 100")
              .all() as {
              id: string;
              actor: string;
              action: string;
              target: string;
              reason: string;
              detail: string;
              created: number;
            }[],
            tables: tables.map((t) => ({
              id: t.id,
              name: t.name,
              status: t.status,
              players: t.seats.filter(Boolean).length,
              hand: t.hand,
            })),
          }
        : null,
  };
}
export type AppState = ReturnType<typeof snapshot>;
