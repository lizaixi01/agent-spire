async function combatAudioCheck(page) {
  await page.goto('http://127.0.0.1:5173/');
  return await page.evaluate(async () => {
    const { GameAudio } = await import('/src/audio.ts');
    async function render(muted, volley = 1) {
      const context = new OfflineAudioContext(1, 48000 * 2, 48000);
      const device = { currentTime: 0, state: 'running', destination: context.destination, sampleRate: context.sampleRate,
        resume: async () => {}, suspend: async () => {} };
      for (const method of ['createGain', 'createBuffer', 'createBufferSource', 'createBiquadFilter', 'createDynamicsCompressor', 'createWaveShaper', 'createOscillator']) device[method] = context[method].bind(context);
      const audio = new GameAudio({ music: false, effects: true, volume: 1 }, () => device);
      await audio.unlock();
      for (let j = 0; j < volley; j++) audio.combat({ beats: [120, 240, 360].map((at, i) => ({ at: at + j * 30, cue: i === 2 ? 'critical' : 'impact' })), cue: 'impact' });
      if (muted) await audio.configure({ music: false, effects: false, volume: 1 });
      const buffer = await context.startRendering(), samples = buffer.getChannelData(0);
      let peak = 0, sum = 0;
      for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; }
      const energy = (start, end) => samples.slice(start * 48000, end * 48000).reduce((n, x) => n + x * x, 0);
      const result = { peak, rms: Math.sqrt(sum / samples.length), beforeFirstHit: energy(0, .12),
        strikes: [[.13,.21],[.25,.33],[.37,.45]].map(([a,b]) => energy(a,b)) };
      audio.dispose(); return result;
    }
    const active = await render(false), muted = await render(true), rapid = await render(false, 6);
    if (active.peak >= .99 || active.rms < .01 || active.beforeFirstHit !== 0 || active.strikes.some(e => e < 1)) throw Error('Invalid impact waveform: ' + JSON.stringify(active));
    if (muted.peak !== 0) throw Error('Scheduled sound leaks after mute');
    if (rapid.peak >= .99) throw Error('Rapid full-volume attacks clip: ' + rapid.peak);
    return { result: 'PASS: real browser PCM, three scheduled strikes, rapid full-volume attacks below clipping, zero pre-hit sound, mute cancels future sounds.', active, muted, rapid };
  });
}
