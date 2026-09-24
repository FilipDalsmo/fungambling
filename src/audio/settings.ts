export const AUDIO_STORAGE_KEY = "fun-gambling.audio.v1";
export type AudioPreferences = {
  effects: number;
  music: number;
  effectsEnabled: boolean;
  musicEnabled: boolean;
};
export const defaultAudio: AudioPreferences = {
  effects: 0.55,
  music: 0.22,
  effectsEnabled: true,
  musicEnabled: true,
};
export function parseAudioPreferences(raw: string | null): AudioPreferences {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return { ...defaultAudio };
    const volume = (key: "effects" | "music") =>
      typeof value[key] === "number" && Number.isFinite(value[key])
        ? Math.max(0, Math.min(1, value[key]))
        : defaultAudio[key];
    return {
      effects: volume("effects"),
      music: volume("music"),
      effectsEnabled:
        typeof value.effectsEnabled === "boolean" ? value.effectsEnabled : true,
      musicEnabled:
        typeof value.musicEnabled === "boolean" ? value.musicEnabled : true,
    };
  } catch {
    return { ...defaultAudio };
  }
}
export const tracks = {
  lobby: {
    title: "Lobby Time",
    file: "lobby-time",
    isrc: "USUAN1600054",
    mood: "Warm lounge jazz",
    start: 1.2,
    end: 188.4,
    gain: 0.8,
  },
  blackjack: {
    title: "Airport Lounge",
    file: "airport-lounge",
    isrc: "USUAN1100806",
    mood: "Light electric piano & vibes",
    start: 0,
    end: 302.8,
    gain: 0.72,
  },
  baccarat: {
    title: "BossaBossa",
    file: "bossabossa",
    isrc: "USUAN1600055",
    mood: "Mellow bossa nova",
    start: 0,
    end: 163.66,
    gain: 0.9,
  },
  ultimate: {
    title: "Bossa Antigua",
    file: "bossa-antigua",
    isrc: "USUAN1700069",
    mood: "Laid-back guitar lounge",
    start: 0.38,
    end: 281.12,
    gain: 1.45,
  },
  nlhe: {
    title: "Bass Walker",
    file: "bass-walker",
    isrc: "USUAN1200071",
    mood: "Smoky walking bass",
    start: 0.02,
    end: 159.8,
    gain: 0.38,
  },
  plo: {
    title: "George Street Shuffle",
    file: "george-street-shuffle",
    isrc: "USUAN1300035",
    mood: "Vibraphone jazz shuffle",
    start: 0,
    end: 262.8,
    gain: 0.65,
  },
} as const;
export type AudioScene = keyof typeof tracks;
export function audioScene(view: string, variant?: string): AudioScene {
  if (view === "poker") return variant === "plo" ? "plo" : "nlhe";
  if (view === "blackjack" || view === "baccarat" || view === "ultimate")
    return view;
  return "lobby";
}
export type SoundEffect =
  | "deal"
  | "flip"
  | "chips"
  | "check"
  | "fold"
  | "turn"
  | "win"
  | "loss"
  | "reward"
  | "ui";
export function commandSound(
  command: string,
  data: unknown,
): SoundEffect | null {
  const action =
    data && typeof data === "object" && "action" in data ? data.action : "";
  if (command === "poker")
    return action === "fold" ? "fold" : action === "check" ? "check" : "chips";
  if (command === "deal" || command === "seat") return "chips";
  if (command === "casino")
    return action === "fold"
      ? "fold"
      : action === "check" || action === "stand"
        ? "check"
        : action === "hit"
          ? null
          : "chips";
  if (command === "claim") return "reward";
  return command === "chat" ? null : "ui";
}
