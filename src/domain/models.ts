export type User = {
  id: string;
  username: string;
  avatar: number;
  created: number;
  lastSeen: number;
  balance: number;
  cycle: string;
  xp: number;
  games: number;
  dailyGames: number;
  won: number;
  lost: number;
  rewards: number;
  achievements: string[];
  dailyClaimed: boolean;
  role: "player" | "admin";
  bannedUntil: number;
  mutedUntil: number;
};
export type Profile = Pick<
  User,
  | "id"
  | "username"
  | "avatar"
  | "created"
  | "xp"
  | "games"
  | "won"
  | "lost"
  | "achievements"
> & {
  balance: number;
  profit: number;
  net: number;
  rank: number;
  online: boolean;
};
export const avatars = ["🦊", "🐼", "🐸", "🦉", "🐯", "🐙", "🦋", "🐲"];
export const achievements = [
  {
    id: "first",
    name: "First hand",
    description: "Complete your first hand",
    games: 1,
    xp: 50,
    chips: 100,
  },
  {
    id: "regular",
    name: "Finding your rhythm",
    description: "Complete 25 hands",
    games: 25,
    xp: 200,
    chips: 300,
  },
  {
    id: "century",
    name: "Century club",
    description: "Complete 100 hands",
    games: 100,
    xp: 500,
    chips: 500,
  },
];
export const levelFor = (xp: number) => Math.floor(Math.sqrt(xp / 100)) + 1;
export const chips = (amount: number) =>
  (amount / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 });
