import { playEffect } from "./effects";
import {
  defaultAudio,
  tracks,
  type AudioPreferences,
  type AudioScene,
  type SoundEffect,
} from "./settings";
type Voice = {
  scene: AudioScene;
  element: HTMLAudioElement;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
  retiring?: ReturnType<typeof setTimeout>;
  looping: boolean;
};
export type AudioStatus = "waiting" | "playing" | "muted" | "unavailable";
const FADE = 1.4;

/** One app-lifetime mixer. Media elements stream only selected tracks, not a decoded album. */
export class CasinoAudio {
  private context?: AudioContext;
  private effects?: GainNode;
  private music?: GainNode;
  private voices = new Set<Voice>();
  private current?: Voice;
  private pending?: Voice;
  private positions = new Map<AudioScene, number>();
  private preferences = { ...defaultAudio };
  private scene: AudioScene = "lobby";
  private disposed = false;
  private generation = 0;
  private lastEffect = -1;
  private lastEffectName?: SoundEffect;
  private status: AudioStatus = "waiting";
  constructor(private notify: (status: AudioStatus) => void) {}
  private report(status: AudioStatus) {
    if (!this.disposed && status !== this.status) {
      this.status = status;
      this.notify(status);
    }
  }
  private initialize() {
    if (this.context || this.disposed) return;
    const context = new AudioContext();
    this.context = context;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 4;
    limiter.release.value = 0.25;
    this.effects = context.createGain();
    this.music = context.createGain();
    this.effects.gain.value = 0;
    this.music.gain.value = 0;
    this.effects.connect(limiter);
    this.music.connect(limiter);
    limiter.connect(context.destination);
    this.applyVolumes();
  }
  private ramp(parameter: AudioParam, value: number, seconds = 0.08) {
    const time = this.context!.currentTime;
    parameter.cancelAndHoldAtTime(time);
    parameter.linearRampToValueAtTime(value, time + seconds);
  }
  private applyVolumes() {
    if (!this.context) return;
    this.ramp(
      this.effects!.gain,
      this.preferences.effectsEnabled ? this.preferences.effects : 0,
    );
    this.ramp(
      this.music!.gain,
      this.preferences.musicEnabled ? this.preferences.music : 0,
    );
  }
  private cancelPending() {
    if (this.pending && this.pending !== this.current)
      this.remove(this.pending);
    this.pending = undefined;
    if (this.current) this.current.looping = false;
  }
  setPreferences(preferences: AudioPreferences) {
    this.preferences = preferences;
    this.applyVolumes();
    if (!preferences.musicEnabled || preferences.music === 0) {
      this.generation++;
      this.cancelPending();
      for (const voice of this.voices) {
        this.positions.set(voice.scene, voice.element.currentTime);
        voice.element.pause();
      }
      this.report("muted");
    } else if (this.context?.state === "running") void this.switchMusic();
    else this.report("waiting");
  }
  setScene(scene: AudioScene) {
    if (scene === this.scene) return;
    this.scene = scene;
    this.generation++;
    this.cancelPending();
    if (this.context?.state === "running") void this.switchMusic();
  }
  // Attempt on mount, then retry directly from a trusted pointer/keyboard gesture.
  // A blocked resume never changes the user's saved default-on preference.
  unlock = () => {
    if (this.disposed || document.hidden) return;
    try {
      this.initialize();
      void this.context!.resume()
        .then(() => {
          if (!this.disposed) void this.switchMusic();
        })
        .catch(() => this.report("waiting"));
    } catch {
      this.report("unavailable");
    }
  };
  play(effect: SoundEffect) {
    if (
      !this.context ||
      this.context.state !== "running" ||
      document.hidden ||
      !this.preferences.effectsEnabled ||
      !this.preferences.effects
    )
      return;
    const now = this.context.currentTime;
    if (effect === this.lastEffectName && now - this.lastEffect < 0.055) return;
    this.lastEffect = now;
    this.lastEffectName = effect;
    playEffect(this.context, this.effects!, effect);
  }
  private remove(voice: Voice) {
    if (!this.voices.has(voice)) return;
    clearTimeout(voice.retiring);
    voice.element.pause();
    voice.element.removeAttribute("src");
    voice.element.load();
    voice.source.disconnect();
    voice.gain.disconnect();
    this.voices.delete(voice);
  }
  private retire(voice: Voice) {
    if (voice.retiring) return;
    this.positions.set(voice.scene, voice.element.currentTime);
    this.ramp(voice.gain.gain, 0, FADE);
    voice.retiring = setTimeout(() => this.remove(voice), FADE * 1000 + 80);
  }
  private create(scene: AudioScene, position: number): Voice {
    const element = new Audio(`/audio/music/${tracks[scene].file}.mp3`);
    element.preload = "auto";
    element.loop = true;
    const source = this.context!.createMediaElementSource(element),
      gain = this.context!.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.music!);
    const voice: Voice = { scene, element, source, gain, looping: false };
    this.voices.add(voice);
    element.addEventListener(
      "loadedmetadata",
      () => {
        const start =
          position > 0 && position < tracks[scene].end - 2
            ? position
            : tracks[scene].start;
        if (start > 0) element.currentTime = start;
      },
      { once: true },
    );
    element.addEventListener("timeupdate", () => {
      // Overlap the tail and opening on separate elements; native loop is a fallback
      // if timeupdate is delayed. No timer tries to guess a song's duration.
      if (
        this.current === voice &&
        !voice.looping &&
        !element.paused &&
        element.duration > 5 &&
        element.currentTime >= Math.min(element.duration, tracks[scene].end) - 2
      ) {
        voice.looping = true;
        void this.switchMusic(true);
      }
    });
    return voice;
  }
  private async switchMusic(loop = false) {
    if (this.disposed || document.hidden || this.context?.state !== "running")
      return;
    if (!this.preferences.musicEnabled || !this.preferences.music) {
      this.report("muted");
      return;
    }
    if (this.pending) return;
    if (
      !loop &&
      this.current?.scene === this.scene &&
      !this.current.element.paused
    ) {
      this.report("playing");
      return;
    }
    const generation = ++this.generation;
    const scene = this.scene;
    let voice = !loop
      ? [...this.voices].find((v) => v.scene === scene && !v.looping)
      : undefined;
    if (voice) {
      clearTimeout(voice.retiring);
      voice.retiring = undefined;
    } else
      voice = this.create(scene, loop ? 0 : (this.positions.get(scene) ?? 0));
    this.pending = voice;
    try {
      await voice.element.play();
      if (this.disposed || generation !== this.generation || document.hidden) {
        if (voice !== this.current) this.remove(voice);
        return;
      }
      this.current = voice;
      this.ramp(voice.gain.gain, tracks[scene].gain, FADE);
      for (const old of this.voices) if (old !== voice) this.retire(old);
      this.report("playing");
    } catch (error) {
      if (voice !== this.current) this.remove(voice);
      if (generation === this.generation)
        this.report(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "waiting"
            : "unavailable",
        );
    } finally {
      if (this.pending === voice) this.pending = undefined;
    }
  }
  visibility = () => {
    if (document.hidden) {
      this.generation++;
      this.cancelPending();
      for (const voice of this.voices) voice.element.pause();
      void this.context?.suspend();
    } else this.unlock();
  };
  dispose() {
    this.disposed = true;
    this.generation++;
    for (const voice of this.voices) this.remove(voice);
    void this.context?.close();
  }
}
