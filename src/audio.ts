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
  private effectNotes = new Set<OscillatorNode>();

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
        this.musicBus.connect(this.context.destination);
        this.effectsBus.connect(this.context.destination);
      }
      this.musicBus!.gain.value = this.settings.volume * 0.18;
      this.effectsBus!.gain.value = this.settings.volume * 0.85;
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
  cue(cue: AudioCue): void {
    if (
      !this.context ||
      this.context.state !== "running" ||
      !this.visible ||
      !this.settings.effects ||
      this.disposed
    )
      return;
    try {
      const now = this.context.currentTime;
      if (cue === "trial" || cue === "perfect") {
        // Rising arpeggio, bass pulse, then a major chord: an audible reward arc.
        this.note(36, now, .3, "sine", .8, false, 24);
        const melody = cue === "perfect" ? [72,76,79,84,88,91,96] : [72,76,79,84];
        melody.forEach((pitch, i) => this.note(pitch, now + i * .075, .22, "square", .16, false));
        [60,64,67,72].forEach(pitch => this.note(pitch, now + .5, .8, "triangle", .16, false));
        return;
      }
      if (cue === "guard" || cue === "debuff") {
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
        this.note(strong ? 53 : 48, now, strong ? .24 : .16, "sine", .85, false, 22);
        this.note(
          cue === "hurt" ? 49 : 88,
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
  private stopNotes(notes: Set<OscillatorNode>): void {
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
