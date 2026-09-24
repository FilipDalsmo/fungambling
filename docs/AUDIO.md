# Casino audio

`src/audio/engine.ts` owns one Web Audio context for the lifetime of `CasinoApp`, independent of navigation and live snapshots. Two gain buses separate effects and music, followed by a gentle safety compressor. There are no new runtime dependencies or external streaming services.

Effects are original synthesis in `src/audio/effects.ts`: filtered paper brushes with soft impacts; layered, rounded chip clinks; double wood taps for checking; and warm, decaying notes for turns, rewards and wins. Envelopes remove harsh attacks and abrupt stops. Identical effects within 55ms are coalesced. Accepted commands trigger action cues; failed requests do not. Poker snapshots additionally cue new hands, community cards, opponents' actions, and the local player's turn, without replaying unchanged snapshots. Casino card cues still follow the presentation sequence.

## Controls and autoplay

The global Audio settings dialog is available before and after sign-in, on desktop and mobile. Effects default to 55%, music to 22%, both enabled. Each has an independent slider and enable switch, plus a combined mute control. `fun-gambling.audio.v1` in localStorage persists settings, with validated/clamped reads, storage-event synchronization between tabs, and a session-only fallback if storage is unavailable. Music playback positions are retained during navigation, not across full page reloads.

Initialization attempts browser-permitted playback. Trusted pointer and keyboard events retry `AudioContext.resume()` and media playback. Autoplay rejection keeps the saved/default-on preference intact; the settings panel explains that interaction is needed. Unsupported audio or missing music is nonfatal to gameplay and has a Retry control. Hidden tabs pause music and the audio context; returning resumes them. Unmount cancels fades and releases media/context resources.

## Music and transitions

Six original, unchanged MP3 downloads are bundled under `public/audio/music/`. They are streamed by HTML media elements, so only selected tracks load; the application does not download/decode an entire album on startup. The total source asset size is approximately 50 MB. No third-party requests occur during playback. Track selection and license identifiers are in `src/audio/settings.ts`. Community pages share the lobby track; Hold'em and Omaha have separate tracks. The poker room uses the Hold'em track.

Scene changes crossfade over 1.4 seconds. Returning to a track resumes its position; unrelated navigation and state refreshes leave the current element running. Retired elements release their source after the fade. Pending playback is cancelled on navigation/mute, avoiding stale-track races. Looping starts a second element before the audible end and overlaps its opening with the outgoing tail; native looping is a fallback for delayed media events.

The recording boundaries and gain adjustments below were measured with decoded 22.05kHz audio and short-window RMS analysis. They skip silent lead-in/trailing tails and bring differing source levels closer together. Original files remain unmodified. Playback changes, including trimming silence, volume leveling and crossfades, are disclosed in the credits.

| Scene     | Track                 | Start (s) | Audible end (s) | Gain |
| --------- | --------------------- | --------: | --------------: | ---: |
| Lobby     | Lobby Time            |      1.20 |          188.40 | 0.80 |
| Blackjack | Airport Lounge        |         0 |          302.80 | 0.72 |
| Baccarat  | BossaBossa            |         0 |          163.66 | 0.90 |
| Ultimate  | Bossa Antigua         |      0.38 |          281.12 | 1.45 |
| Hold'em   | Bass Walker           |      0.02 |          159.80 | 0.38 |
| Omaha     | George Street Shuffle |         0 |          262.80 | 0.65 |

## Attribution

All six tracks are by Kevin MacLeod, downloaded from his official Incompetech catalog, whose current track-page attribution specifies CC BY 4.0. These are attribution-required royalty-free recordings, not public-domain recordings. Artist, source and license links appear in the global audio dialog and in [bundled credits](../public/audio/CREDITS.md). Original-file SHA-256 checksums are in `public/audio/music-sha256.json`. Retain these credits when distributing the app.

Relevant browser documentation: [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
