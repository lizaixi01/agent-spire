import { afterEach, describe, expect, it, vi } from "vitest";
import { GameAudio } from "../src/audio";
import type { Impact } from "../src/impact";

function audioDevice() {
  const tones: { stop: ReturnType<typeof vi.fn> }[] = [];
  const percussion: { stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> }[] = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const context = {
    currentTime: 0,
    state: "suspended",
    destination: {},
    sampleRate: 48000,
    createWaveShaper: () => ({ curve: null, oversample: "none", connect: vi.fn() }),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => {
      const node = { buffer: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
      percussion.push(node); return node;
    },
    createBiquadFilter: () => ({ type: "bandpass", frequency: parameter(), Q: parameter(), connect: vi.fn(), disconnect: vi.fn() }),
    createDynamicsCompressor: vi.fn(() => ({ threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(), connect: vi.fn() })),
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    suspend: vi.fn(async () => {
      context.state = "suspended";
    }),
    createGain: () => ({
      gain: parameter(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createOscillator: () => {
      const node = {
        frequency: parameter(),
        type: "sine",
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      tones.push(node);
      return node;
    },
  };
  const create = vi.fn(() => context as unknown as AudioContext);
  return { context, create, tones, percussion };
}
afterEach(() => vi.useRealTimers());

describe("游戏音乐与音效", () => {
  it("等待首次操作才启动音乐；多次操作不会叠加播放循环", async () => {
    vi.useFakeTimers();
    const device = audioDevice();
    const audio = new GameAudio(
      { music: true, effects: true, volume: 0.3 },
      device.create,
    );
    expect(device.create).not.toHaveBeenCalled();
    await audio.unlock();
    expect(device.tones.length).toBeGreaterThan(0);
    const count = device.tones.length;
    await audio.unlock();
    expect(device.tones).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(1);
    audio.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("静音与隐藏页面立即停音，恢复时重启一条旋律", async () => {
    vi.useFakeTimers();
    const device = audioDevice();
    const audio = new GameAudio(
      { music: true, effects: true, volume: 0.3 },
      device.create,
    );
    await audio.unlock();
    audio.setVisible(false);
    expect(device.context.suspend).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await audio.setVisible(true);
    expect(vi.getTimerCount()).toBe(1);
    await audio.configure({ music: false, effects: false, volume: 0.3 });
    const count = device.tones.length;
    audio.cue("attack");
    expect(device.tones).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(0);
    audio.dispose();
  });
  it("关闭背景音乐仍可保留出牌音效，零音量也不会被意外还原", async () => {
    vi.useFakeTimers();
    const device = audioDevice();
    const audio = new GameAudio(
      { music: false, effects: true, volume: 0 },
      device.create,
    );
    await audio.unlock();
    expect(vi.getTimerCount()).toBe(0);
    audio.cue("block");
    expect(device.tones.length).toBeGreaterThan(0);
    expect(audio.settings.volume).toBe(0);
    audio.dispose();
  });
  it("受击、格挡与通关有独立音效；完美通关的分层音符多于普通命中", async () => {
    const device = audioDevice();
    const audio = new GameAudio({ music: false, effects: true, volume: .3 }, device.create);
    await audio.unlock();
    const counts: number[] = [];
    for (const cue of ["impact", "hurt", "guard", "debuff", "trial", "perfect"] as const) {
      const before = device.tones.length;
      audio.cue(cue);
      counts.push(device.tones.length - before);
    }
    expect(counts.every(n => n >= 2)).toBe(true);
    expect(counts[5]).toBeGreaterThan(counts[0]);
    expect(counts[1]).toBeGreaterThanOrEqual(4);
    audio.dispose();
  });
  it("三段打击的冲击声在对应命中时间播放，并在静音时取消尚未播放的声音", async () => {
    const device = audioDevice();
    const audio = new GameAudio({ music: false, effects: true, volume: .3 }, device.create);
    await audio.unlock();
    audio.combat({ beats: [120, 240, 360].map(at => ({ at, cue: "impact", damage: 3 })), cue: "impact" } as Impact);
    expect(device.percussion.map(p => p.start.mock.calls[0][0])).toEqual([.12, .24, .36]);
    expect(device.context.createDynamicsCompressor).toHaveBeenCalledOnce();
    await audio.configure({ music: false, effects: false, volume: .3 });
    expect(device.percussion.every(p => p.stop.mock.calls.length >= 2)).toBe(true);
    audio.dispose();
  });
});
