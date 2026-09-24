import { atomic, database, type DB } from "./db";
import { dailyReset } from "./economy";
import { tickTables } from "./games";
export function maintain(db: DB, now = Date.now()) {
  atomic(db, () => {
    dailyReset(db, now);
    tickTables(db, now);
    const yesterday = now - 86400_000;
    db.prepare("DELETE FROM sessions WHERE expires<=?").run(now);
    db.prepare("DELETE FROM actions WHERE created<?").run(yesterday);
    db.prepare("DELETE FROM chat WHERE created<?").run(yesterday);
    db.prepare("DELETE FROM rate_limits WHERE until<=?").run(now);
    db.prepare("DELETE FROM rounds WHERE json_extract(data,'$.created')<?").run(
      yesterday,
    );
    db.prepare(
      "DELETE FROM poker_tables WHERE json_extract(data,'$.private')=1 AND json_extract(data,'$.created')<? AND NOT EXISTS (SELECT 1 FROM json_each(json_extract(data,'$.seats')) WHERE value IS NOT NULL)",
    ).run(yesterday);
  });
}
const runtime = globalThis as typeof globalThis & {
  funTimer?: ReturnType<typeof setInterval>;
};
export function startMaintenance() {
  if (runtime.funTimer) return;
  const tick = () => {
    try {
      maintain(database());
    } catch (error) {
      console.error("Maintenance failed", error);
    }
  };
  tick();
  runtime.funTimer = setInterval(tick, 1000);
  runtime.funTimer.unref();
}
