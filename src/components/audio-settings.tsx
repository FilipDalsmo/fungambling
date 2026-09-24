"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CasinoAudio, type AudioStatus } from "@/audio/engine";
import {
  AUDIO_STORAGE_KEY,
  defaultAudio,
  parseAudioPreferences,
  tracks,
  type AudioPreferences,
  type AudioScene,
  type SoundEffect,
} from "@/audio/settings";
import { Modal } from "./ui";
import "./audio-settings.css";

export function useCasinoAudio(scene: AudioScene) {
  const engine = useRef<CasinoAudio | null>(null);
  const [preferences, setPreferences] =
    useState<AudioPreferences>(defaultAudio);
  const [status, setStatus] = useState<AudioStatus>("waiting");
  useEffect(() => {
    const audio = new CasinoAudio(setStatus);
    engine.current = audio;
    let saved = { ...defaultAudio };
    try {
      saved = parseAudioPreferences(localStorage.getItem(AUDIO_STORAGE_KEY));
    } catch {
      /* Private browsing can disable storage. */
    }
    // Hydrate browser-only preferences after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences(saved);
    audio.setPreferences(saved);
    audio.unlock();
    const gesture = (event: Event) => {
      if (event.isTrusted) audio.unlock();
    };
    const sync = (event: StorageEvent) => {
      if (event.key === AUDIO_STORAGE_KEY || event.key === null) {
        const next = parseAudioPreferences(event.newValue);
        setPreferences(next);
        audio.setPreferences(next);
      }
    };
    window.addEventListener("pointerdown", gesture, { capture: true });
    window.addEventListener("keydown", gesture, { capture: true });
    window.addEventListener("storage", sync);
    document.addEventListener("visibilitychange", audio.visibility);
    return () => {
      window.removeEventListener("pointerdown", gesture, true);
      window.removeEventListener("keydown", gesture, true);
      window.removeEventListener("storage", sync);
      document.removeEventListener("visibilitychange", audio.visibility);
      audio.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.setScene(scene);
  }, [scene]);
  const play = useCallback(
    (effect: SoundEffect) => engine.current?.play(effect),
    [],
  );
  const update = (next: AudioPreferences) => {
    setPreferences(next);
    engine.current?.setPreferences(next);
    engine.current?.unlock();
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Settings still work for this session. */
    }
  };
  return {
    preferences,
    status,
    update,
    play,
    retry: () => engine.current?.unlock(),
  };
}
export function AudioSettings({
  audio,
  scene,
}: {
  audio: ReturnType<typeof useCasinoAudio>;
  scene: AudioScene;
}) {
  const [open, setOpen] = useState(false);
  const { preferences, update } = audio;
  const muted = !preferences.effectsEnabled && !preferences.musicEnabled;
  return (
    <>
      <button
        className="sound-button"
        onClick={() => setOpen(true)}
        aria-label="Audio settings"
        aria-haspopup="dialog"
      >
        ♫ Audio <span>{muted ? "Muted" : "On"}</span>
      </button>
      {open && (
        <Modal title="Audio settings" close={() => setOpen(false)}>
          <div className="audio-settings">
            <p className="muted">
              Set the mood. Your settings follow you across the casino.
            </p>
            {(
              [
                [
                  "effects",
                  "Game / sound effects",
                  "Cards, chips, actions and celebrations",
                ],
                [
                  "music",
                  "Background music",
                  "A different lounge soundtrack for every game",
                ],
              ] as const
            ).map(([key, label, hint]) => {
              const enabled =
                key === "effects" ? "effectsEnabled" : "musicEnabled";
              return (
                <section className="audio-channel" key={key}>
                  <label className="audio-enable">
                    <span>
                      {label}
                      <small>{hint}</small>
                    </span>
                    <input
                      type="checkbox"
                      aria-label={`Enable ${label.toLowerCase()}`}
                      checked={preferences[enabled]}
                      onChange={(event) =>
                        update({
                          ...preferences,
                          [enabled]: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="audio-volume">
                    <span>{label} volume</span>
                    <output>{Math.round(preferences[key] * 100)}%</output>
                    <input
                      aria-label={`${label} volume`}
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(preferences[key] * 100)}
                      onChange={(event) =>
                        update({
                          ...preferences,
                          [key]: Number(event.target.value) / 100,
                        })
                      }
                      onPointerUp={() => {
                        if (key === "effects") audio.play("chips");
                      }}
                      onKeyUp={() => {
                        if (key === "effects") audio.play("chips");
                      }}
                    />
                  </label>
                </section>
              );
            })}
            <div className="audio-now-playing">
              <span className="eyebrow">
                {audio.status === "playing" ? "NOW PLAYING" : "SOUNDTRACK"}
              </span>
              <strong>{tracks[scene].title}</strong>
              <small>{tracks[scene].mood}</small>
            </div>
            {audio.status === "waiting" && (
              <p role="status">
                Audio starts after your first click or key press.{" "}
                <button className="text-button" onClick={audio.retry}>
                  Start audio
                </button>
              </p>
            )}
            {audio.status === "unavailable" && (
              <p role="status">
                Music could not load. Your game is ready to play.{" "}
                <button className="text-button" onClick={audio.retry}>
                  Retry audio
                </button>
              </p>
            )}
            <button
              className="button secondary"
              onClick={() =>
                update({
                  ...preferences,
                  effectsEnabled: muted,
                  musicEnabled: muted,
                })
              }
            >
              {muted ? "Enable all audio" : "Mute all audio"}
            </button>
            <details className="audio-credits">
              <summary>Music credits & licenses</summary>
              <p>
                Music by{" "}
                <a
                  href="https://incompetech.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Kevin MacLeod (incompetech.com)
                </a>
                , licensed under{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Creative Commons Attribution 4.0
                </a>
                . Playback trims silence and applies volume leveling, crossfades
                and overlapping loops.
              </p>
              <ul>
                {Object.values(tracks).map((track) => (
                  <li key={track.isrc}>
                    <a
                      href={`https://incompetech.com/music/royalty-free/index.html?isrc=${track.isrc}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {track.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </Modal>
      )}
    </>
  );
}
