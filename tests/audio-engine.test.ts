import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CasinoAudio } from "../src/audio/engine";
import { defaultAudio, tracks } from "../src/audio/settings";
import { playEffect } from "../src/audio/effects";
vi.mock("../src/audio/effects", () => ({ playEffect: vi.fn() }));
class Parameter {
  value = 1;
  cancelAndHoldAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}
class Node {
  gain = new Parameter();
  threshold = new Parameter();
  ratio = new Parameter();
  release = new Parameter();
  connect() {
    return this;
  }
  disconnect = vi.fn();
}
class Context {
  static instances: Context[] = [];
  state = "suspended";
  currentTime = 1;
  destination = new Node();
  gains: Node[] = [];
  constructor() {
    Context.instances.push(this);
  }
  createDynamicsCompressor() {
    return new Node();
  }
  createGain() {
    const node = new Node();
    this.gains.push(node);
    return node;
  }
  createMediaElementSource() {
    return new Node();
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}
class Media extends EventTarget {
  static instances: Media[] = [];
  static failure: string | null = null;
  currentTime = 0;
  duration = 400;
  paused = true;
  loop = false;
  preload = "";
  constructor(public src: string) {
    super();
    Media.instances.push(this);
  }
  play = vi.fn(async () => {
    if (Media.failure) throw new DOMException("Blocked", Media.failure);
    this.paused = false;
    this.dispatchEvent(new Event("loadedmetadata"));
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute() {
    this.src = "";
  }
  load() {}
}
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
let audio: CasinoAudio;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Context.instances = [];
  Media.instances = [];
  Media.failure = null;
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("Audio", Media);
  vi.stubGlobal("document", { hidden: false });
  audio = new CasinoAudio(vi.fn());
});
afterEach(() => {
  audio.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("persistent audio mixer", () => {
  it("keeps independent buses and never restarts an unchanged soundtrack", async () => {
    audio.unlock();
    await settle();
    const context = Context.instances[0],
      media = Media.instances[0];
    media.currentTime = 30;
    audio.setScene("lobby");
    audio.unlock();
    await settle();
    expect(Media.instances).toHaveLength(1);
    expect(media.play).toHaveBeenCalledTimes(1);
    audio.setPreferences({
      ...defaultAudio,
      effects: 0.1,
      music: 0.7,
      effectsEnabled: false,
    });
    expect(context.gains[0].gain.value).toBe(0);
    expect(context.gains[1].gain.value).toBe(0.7);
    audio.play("chips");
    expect(playEffect).not.toHaveBeenCalled();
    expect(media.currentTime).toBe(30);
  });
  it("crossfades tracks, releases old sources, and resumes their position", async () => {
    audio.unlock();
    await settle();
    const lobby = Media.instances[0];
    lobby.currentTime = 40;
    audio.setScene("blackjack");
    await settle();
    expect(Media.instances).toHaveLength(2);
    expect(lobby.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    expect(lobby.paused).toBe(true);
    audio.setScene("lobby");
    await settle();
    expect(Media.instances[2].currentTime).toBe(40);
  });
  it("overlaps the audible tail with a fresh opening before trailing silence", async () => {
    audio.unlock();
    await settle();
    const first = Media.instances[0];
    first.currentTime = tracks.lobby.end - 1.8;
    first.dispatchEvent(new Event("timeupdate"));
    await settle();
    expect(Media.instances).toHaveLength(2);
    expect(Media.instances[1].currentTime).toBe(tracks.lobby.start);
    expect(first.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    expect(first.paused).toBe(true);
  });
  it("keeps default-on preferences after an autoplay rejection and retries", async () => {
    Media.failure = "NotAllowedError";
    audio.unlock();
    await settle();
    Media.failure = null;
    audio.unlock();
    await settle();
    expect(Media.instances.at(-1)?.paused).toBe(false);
    audio.play("chips");
    expect(playEffect).toHaveBeenCalledTimes(1);
  });
  it("does not leak pending playback when navigating rapidly or muting", async () => {
    audio.unlock();
    await settle();
    audio.setScene("blackjack");
    audio.setScene("baccarat");
    audio.setScene("ultimate");
    await settle();
    audio.setPreferences({ ...defaultAudio, musicEnabled: false });
    await vi.advanceTimersByTimeAsync(1600);
    expect(Media.instances.every((media) => media.paused)).toBe(true);
    audio.setPreferences(defaultAudio);
    await settle();
    expect(
      Media.instances
        .filter((media) => !media.paused)
        .map((media) => media.src),
    ).toEqual(["/audio/music/bossa-antigua.mp3"]);
  });
});
