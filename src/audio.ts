import type { Impact } from "./impact";
export interface AudioSettings {
  music: boolean;
  effects: boolean;
  volume: number;
}
export type AudioCue =
  | "attack"
  | "block"
  | "skill"
  | "power"
  | "turn"
  | "reward"
  | "click"
  | "impact"
  | "critical"
  | "combo"
  | "break"
  | "kill"
  | "victory"
  | "hurt" | "guard" | "debuff" | "trial" | "perfect";

export function audioSettings(saved: unknown): AudioSettings {
  const value =
    saved && typeof saved === "object" ? (saved as Partial<AudioSettings>) : {};
  return {
    music: typeof value.music === "boolean" ? value.music : true,
    effects: typeof value.effects === "boolean" ? value.effects : true,
    volume:
      typeof value.volume === "number" && Number.isFinite(value.volume)
        ? Math.max(0, Math.min(1, value.volume))
        : 0.3,
  };
}

// Original 32-beat loop in A minor, softly voiced for reading and play.
const MELODY = [
  76, 0, 79, 81, 0, 79, 76, 74, 72, 0, 76, 79, 0, 76, 74, 72, 74, 0, 77, 79, 0,
  77, 74, 72, 71, 0, 74, 76, 0, 74, 71, 67, 72, 0, 76, 79, 0, 81, 79, 76, 74, 0,
  77, 79, 0, 77, 76, 72, 71, 0, 74, 76, 0, 79, 76, 74, 72, 0, 71, 67, 69, 0, 0,
  0,
];
const ROOTS = [45, 41, 48, 43, 45, 41, 43, 40];
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class GameAudio {
  settings: AudioSettings;
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private activated = false;
  private visible = true;
  private disposed = false;
  private generation = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  private musicNotes = new Set<OscillatorNode>();
  private effectNotes = new Set<AudioScheduledSourceNode>();
  private noiseBuffer: AudioBuffer | null = null;
  private duckUntil = 0;

  constructor(
    settings: AudioSettings,
    private createContext = () => new AudioContext(),
  ) {
    this.settings = audioSettings(settings);
  }

  async unlock(): Promise<void> {
    this.activated = true;
    await this.sync();
  }
  async configure(settings: AudioSettings): Promise<void> {
    this.settings = audioSettings(settings);
    if (!this.settings.music) this.stopMusic();
    if (!this.settings.effects) this.stopNotes(this.effectNotes);
    await this.sync();
  }
  async setVisible(visible: boolean): Promise<void> {
    this.visible = visible;
    await this.sync();
  }
  private async sync(): Promise<void> {
    const generation = ++this.generation;
    if (this.disposed || !this.activated) return;
    try {
      if (!this.visible || (!this.settings.music && !this.settings.effects)) {
        this.stopMusic();
        this.stopNotes(this.effectNotes);
        await this.context?.suspend();
        return;
      }
      if (!this.context) {
        this.context = this.createContext();
        this.musicBus = this.context.createGain();
        this.effectsBus = this.context.createGain();
        const output = this.context.createWaveShaper();
        const curve = new Float32Array(4096);
        for (let i = 0; i < curve.length; i++) {
          const x = i * 2 / (curve.length - 1) - 1, magnitude = Math.abs(x);
          curve[i] = magnitude <= .65 ? x : Math.sign(x) * (.65 + .25 * (1 - Math.exp(-(magnitude - .65) / .25)));
        }
        output.curve = curve;
        output.oversample = "2x";
        output.connect(this.context.destination);
        this.musicBus.connect(output);
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.knee.value = 10;
        limiter.ratio.value = 6;
        limiter.attack.value = .002;
        limiter.release.value = .14;
        this.effectsBus.connect(limiter);
        limiter.connect(output);
      }
      this.musicBus!.gain.value = this.settings.volume * 0.18;
      this.effectsBus!.gain.value = this.settings.volume * 1.1;
      await this.context.resume();
      if (generation !== this.generation || this.disposed || !this.visible)
        return;
      if (this.settings.music && this.timer === null) {
        this.next = this.context.currentTime + 0.04;
        this.step = 0;
        this.schedule();
        this.timer = setInterval(() => this.schedule(), 100);
      }
    } catch {
      // Audio restrictions or unavailable devices must never interrupt play.
    }
  }
  private schedule(): void {
    const context = this.context!;
    // Resume from a new bar rather than catching up after a stalled browser tab.
    if (this.next < context.currentTime - 0.5)
      this.next = context.currentTime + 0.04;
    while (this.next < context.currentTime + 0.25) {
      const i = this.step % MELODY.length;
      const root = ROOTS[Math.floor(i / 8)];
      if (MELODY[i])
        this.note(MELODY[i], this.next, 0.29, "triangle", 0.55, true);
      if (i % 4 === 0) this.note(root, this.next, 0.85, "triangle", 0.48, true);
      if (i % 8 === 0) {
        this.note(root + 19, this.next, 1.9, "sine", 0.16, true);
        this.note(root + 24, this.next, 1.9, "sine", 0.13, true);
      }
      this.step++;
      this.next += 60 / 92 / 2;
    }
  }
  private note(
    midi: number,
    at: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    music: boolean,
    slide?: number,
  ): void {
    const context = this.context!;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency(midi), at);
    if (slide !== undefined)
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency(slide),
        at + duration,
      );
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope);
    envelope.connect(music ? this.musicBus! : this.effectsBus!);
    const notes = music ? this.musicNotes : this.effectNotes;
    notes.add(oscillator);
    oscillator.onended = () => {
      notes.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
  }
  combat(impact: Impact, cast?: AudioCue): void {
    if (cast) this.cue(cast);
    for (const [i, beat] of impact.beats.entries()) this.cue(beat.cue, beat.at, Math.min(i, 4));
    if (impact.cue === "victory") this.cue("victory", (impact.beats.at(-1)?.at ?? 0) + 180);
    else if (!impact.beats.length && impact.cue) this.cue(impact.cue, 120);
  }
  cancelEffects(): void { this.stopNotes(this.effectNotes); }
  private percussion(at: number, duration: number, volume: number, cutoff: number): void {
    const context = this.context!;
    if (!this.noiseBuffer) {
      this.noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .6), context.sampleRate);
      const samples = this.noiseBuffer.getChannelData(0);
      let seed = 1337;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = seed / 0x80000000 - 1;
      }
    }
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass"; filter.frequency.value = cutoff; filter.Q.value = .65;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + .002);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.effectsBus!);
    this.effectNotes.add(source);
    source.onended = () => { this.effectNotes.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(at); source.stop(at + duration + .01);
  }
  private duck(at: number): void {
    if (!this.musicBus || !this.settings.music) return;
    const gain = this.musicBus.gain, now = this.context!.currentTime;
    this.duckUntil = Math.max(this.duckUntil, at + .4);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(this.settings.volume * .045, Math.max(now + .015, at));
    gain.setValueAtTime(this.settings.volume * .045, this.duckUntil - .16);
    gain.linearRampToValueAtTime(this.settings.volume * .18, this.duckUntil);
  }
  cue(cue: AudioCue, delayMs = 0, pitchStep = 0): void {
    if (
      !this.context ||
      this.context.state !== "running" ||
      !this.visible ||
      !this.settings.effects ||
      this.disposed
    )
      return;
    try {
      const now = this.context.currentTime + Math.max(0, delayMs) / 1000;
      if (cue === "trial" || cue === "perfect") {
        // Rising arpeggio, bass pulse, then a major chord: an audible reward arc.
        this.note(36, now, .3, "sine", .8, false, 24);
        const melody = cue === "perfect" ? [72,76,79,84,88,91,96] : [72,76,79,84];
        melody.forEach((pitch, i) => this.note(pitch, now + i * .075, .22, "square", .16, false));
        [60,64,67,72].forEach(pitch => this.note(pitch, now + .5, .8, "triangle", .16, false));
        return;
      }
      if (cue === "guard" || cue === "debuff") {
        this.percussion(now, .1, .48, cue === "guard" ? 4800 : 800);
        (cue === "guard" ? [88,95,100] : [61,58,53]).forEach((pitch,i) =>
          this.note(pitch, now + i * .045, .2, cue === "guard" ? "triangle" : "sawtooth", .25, false));
        this.note(cue === "guard" ? 55 : 40, now, .16, "sine", .5, false, 30);
        return;
      }
      if (
        [
          "impact",
          "critical",
          "combo",
          "break",
          "kill",
          "victory",
          "hurt",
        ].includes(cue)
      ) {
        const strong = cue !== "impact";
        this.duck(now);
        this.percussion(now, strong ? .22 : .12, strong ? .85 : .6, cue === "hurt" ? 950 : cue === "break" ? 3800 : 2100 + pitchStep * 400);
        this.note((strong ? 53 : 48) + pitchStep, now, strong ? .28 : .19, "sine", .95, false, 22);
        this.note(
          (cue === "hurt" ? 49 : 88) + pitchStep * 2,
          now,
          0.055,
          "square",
          0.25,
          false,
          35,
        );
        this.note(94, now + .012, .07, "sawtooth", .16, false, 38);
        if (cue === "hurt") {
          this.note(44, now + .035, .25, "sawtooth", .23, false, 25);
          this.note(46, now + .07, .18, "square", .12, false, 29);
        }
        if (cue === "combo" || cue === "critical" || cue === "break")
          [76, 83, 88].forEach((pitch, i) =>
            this.note(pitch, now + i * 0.028, 0.14, "triangle", 0.22, false),
          );
        if (cue === "kill")
          this.note(72, now, 0.3, "sawtooth", 0.19, false, 36);
        if (cue === "victory")
          [72, 76, 79, 84, 79, 88].forEach((pitch, i) =>
            this.note(
              pitch,
              now + 0.08 + i * 0.07,
              0.24,
              "triangle",
              0.28,
              false,
            ),
          );
        return;
      }
      const pitches: Partial<Record<AudioCue, number[]>> = {
        attack: [45, 33],
        block: [64, 71, 76],
        skill: [76, 83],
        power: [69, 76, 81],
        turn: [52, 45],
        reward: [72, 76, 79, 84],
        click: [79],
      };
      if (cue === "attack") this.percussion(now, .09, .2, 3200);
      pitches[cue]!.forEach((pitch, i) =>
        this.note(
          pitch,
          now + i * 0.045,
          cue === "attack" ? 0.1 : 0.17,
          cue === "attack" ? "sawtooth" : "triangle",
          cue === "attack" ? 0.14 : 0.23,
          false,
        ),
      );
    } catch {
      /* Optional audio cannot block actions. */
    }
  }
  private stopNotes<T extends AudioScheduledSourceNode>(notes: Set<T>): void {
    for (const node of notes) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        /* Already ended. */
      }
    }
    notes.clear();
  }
  private stopMusic(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stopNotes(this.musicNotes);
  }
  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.stopMusic();
    this.stopNotes(this.effectNotes);
    void this.context?.suspend().catch(() => {});
  }
}
