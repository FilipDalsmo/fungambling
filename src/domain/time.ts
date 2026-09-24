const london = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});
export function cycleAt(now = new Date()): string {
  const parts = Object.fromEntries(
    london.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const date = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
  if (Number(parts.hour) < 12) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
export function periodStart(
  period: "daily" | "weekly" | "monthly" | "all-time",
  now = new Date(),
) {
  const cycle = cycleAt(now);
  if (period === "all-time") return "0000-00-00";
  if (period === "daily") return cycle;
  if (period === "monthly") return cycle.slice(0, 7) + "-01";
  const date = new Date(cycle + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export function nextReset(now = new Date()): string {
  const date = new Date(cycleAt(now) + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  const hour = Number(
    Object.fromEntries(london.formatToParts(date).map((p) => [p.type, p.value]))
      .hour,
  );
  date.setUTCHours(date.getUTCHours() - (hour - 12));
  return date.toISOString();
}
