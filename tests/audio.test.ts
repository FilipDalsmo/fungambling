import { describe, expect, it } from "vitest";
import {
  audioScene,
  commandSound,
  defaultAudio,
  parseAudioPreferences,
  tracks,
} from "../src/audio/settings";
describe("audio preferences and routing", () => {
  it("defaults both channels on at restrained volumes", () => {
    expect(parseAudioPreferences(null)).toEqual(defaultAudio);
    expect(defaultAudio.effectsEnabled && defaultAudio.musicEnabled).toBe(true);
    expect(defaultAudio.music).toBeLessThan(defaultAudio.effects);
  });
  it("preserves explicit mute and zero, rejects invalid storage, and clamps volumes", () => {
    expect(
      parseAudioPreferences('{"effects":0,"music":0.8,"effectsEnabled":false}'),
    ).toEqual({
      effects: 0,
      music: 0.8,
      effectsEnabled: false,
      musicEnabled: true,
    });
    expect(parseAudioPreferences('{"effects":-2,"music":100}')).toMatchObject({
      effects: 0,
      music: 1,
    });
    for (const value of ["invalid", "[]", "null", '{"music":"loud"}'])
      expect(parseAudioPreferences(value)).toEqual(defaultAudio);
  });
  it("keeps community navigation on the lobby track and gives every game a distinct track", () => {
    expect(audioScene("profile")).toBe("lobby");
    expect(audioScene("leaderboards")).toBe("lobby");
    expect(audioScene("poker", "nlhe")).toBe("nlhe");
    expect(audioScene("poker", "plo")).toBe("plo");
    expect(new Set(Object.values(tracks).map((track) => track.file)).size).toBe(
      6,
    );
  });
  it("uses physical action cues instead of one beep for every command", () => {
    expect(commandSound("poker", { action: "raise" })).toBe("chips");
    expect(commandSound("poker", { action: "check" })).toBe("check");
    expect(commandSound("poker", { action: "fold" })).toBe("fold");
    expect(commandSound("casino", { action: "hit" })).toBeNull();
    expect(commandSound("chat", {})).toBeNull();
    expect(commandSound("claim", {})).toBe("reward");
  });
});
