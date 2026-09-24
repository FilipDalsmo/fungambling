import type { SoundEffect } from "./settings";

// Original synthesized Foley: brushed paper, rounded chip clinks, soft wood taps
// and warm musical cues. Each layer has a gentle attack and a natural tail.
export function playEffect(
  context: AudioContext,
  output: AudioNode,
  effect: SoundEffect,
) {
  const now = context.currentTime;
  function note(
    frequency: number,
    delay: number,
    duration: number,
    level: number,
    type: OscillatorType = "sine",
  ) {
    const source = context.createOscillator(),
      envelope = context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(frequency, now + delay);
    source.frequency.exponentialRampToValueAtTime(
      frequency * 0.985,
      now + delay + duration,
    );
    envelope.gain.setValueAtTime(0, now + delay);
    envelope.gain.linearRampToValueAtTime(level, now + delay + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    source.connect(envelope).connect(output);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
    };
    source.start(now + delay);
    source.stop(now + delay + duration + 0.02);
  }
  function brush(duration: number, frequency: number, level: number) {
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) {
      previous = previous * 0.65 + (Math.random() * 2 - 1) * 0.35;
      samples[i] = previous;
    }
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      envelope = context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.55;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(level, now + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(output);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(now);
    source.stop(now + duration);
  }
  if (effect === "deal" || effect === "fold" || effect === "flip") {
    brush(
      effect === "fold" ? 0.32 : 0.24,
      effect === "flip" ? 1600 : 950,
      0.32,
    );
    note(effect === "flip" ? 260 : 190, 0.06, 0.18, 0.035);
  } else if (effect === "chips") {
    [0, 0.055, 0.12].forEach((delay, i) => {
      note(1250 + i * 260 + Math.random() * 100, delay, 0.24, 0.04);
      note(420 + i * 30, delay, 0.19, 0.035);
    });
  } else if (effect === "check") {
    note(175, 0, 0.18, 0.09);
    note(210, 0.095, 0.22, 0.065);
  } else if (effect === "win" || effect === "reward") {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      note(f, i * 0.105, 0.7, 0.045);
      note(f / 2, i * 0.105, 0.55, 0.018);
    });
  } else if (effect === "loss") note(220, 0, 0.4, 0.025);
  else if (effect === "turn") {
    note(523.25, 0, 0.45, 0.035);
    note(659.25, 0.12, 0.5, 0.025);
  } else note(440, 0, 0.24, 0.025);
}
