import { z } from "zod";
import { ensure } from "@/domain/errors";
import { atomic, getUser, saveUser, type DB } from "./db";
import {
  casinoAction,
  createTable,
  deal,
  pokerAction,
  seatAction,
} from "./games";
import { adminAction, sendChat, setting, socialAction } from "./social";
import { reward } from "./economy";
import { maintain } from "./maintenance";
export const commandSchema = z.object({
  id: z.string().uuid(),
  command: z.enum([
    "deal",
    "casino",
    "poker",
    "seat",
    "createTable",
    "social",
    "chat",
    "admin",
    "profile",
    "claim",
  ]),
  data: z.unknown(),
});
export function command(
  db: DB,
  userId: string,
  input: unknown,
  now = Date.now(),
) {
  const request = commandSchema.parse(input);
  // Catch-up commits even when the subsequent action fails validation.
  maintain(db, now);
  return atomic(db, () => {
    const user = getUser(db, userId);
    ensure(user && user.bannedUntil <= now, "Please sign in again", 401);
    ensure(
      !db
        .prepare("SELECT 1 FROM actions WHERE user_id=? AND id=?")
        .get(userId, request.id),
      "This action was already processed. Your current state has been refreshed.",
      409,
    );
    db.prepare("INSERT INTO actions(user_id,id,created) VALUES(?,?,?)").run(
      userId,
      request.id,
      now,
    );
    user.lastSeen = now;
    saveUser(db, user);
    switch (request.command) {
      case "deal":
        return deal(db, user, request.data, now);
      case "casino":
        return casinoAction(db, user, request.data);
      case "poker":
        return pokerAction(db, user, request.data, now);
      case "seat":
        return seatAction(db, user, request.data, now);
      case "createTable":
        return createTable(db, user, request.data, now);
      case "social":
        return socialAction(db, user, request.data, now);
      case "chat":
        return sendChat(db, user, request.data, now);
      case "admin":
        return adminAction(db, user, request.data, now);
      case "profile": {
        const { avatar } = z
          .object({ avatar: z.number().int().min(0).max(7) })
          .parse(request.data);
        user.avatar = avatar;
        saveUser(db, user);
        return;
      }
      case "claim": {
        ensure(
          user.dailyGames >= 5 && !user.dailyClaimed,
          "Complete five hands to claim once per daily cycle",
        );
        user.dailyClaimed = true;
        user.xp += 100;
        reward(db, user, Number(setting(db, "dailyReward", "200")) * 100);
        saveUser(db, user);
        return;
      }
    }
  });
}
