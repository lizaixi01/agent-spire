async (page) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const expected = {
    scholar: { hp: 100, energy: 2, hand: 5 },
    engineer: { hp: 72, energy: 3, hand: 5 },
    weaver: { hp: 68, energy: 5, hand: 9 },
  };
  for (const [id, stats] of Object.entries(expected)) {
    await page.goto('http://127.0.0.1:5173/');
  const correct = await page.evaluate(async () => {
    const { createRun, enterNode, availableNodes } = await import('/src/engine.ts');
    const { caseForBattle, transferFor } = await import('/src/learning-cases.ts');
    return Object.fromEntries(['scholar', 'engineer', 'weaver'].map(hero => {
      const base = createRun(hero, 42);
      const run = enterNode(base, availableNodes(base)[0].id);
      const c = caseForBattle(run);
      return [hero, [c.correct, transferFor(c).correct]];
    }));
  });
  await page.goto("http://127.0.0.1:4173/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.getByRole("button", { name: "开始学习", exact: true }).click();
    await page.locator(`[data-action="select-character"][data-id="${id}"]`).click();
    await page.getByRole("textbox", { name: "远征种子（可选）" }).fill("42");
    await page.screenshot({ path: `output/character-${id}-selection.png` });
    await page.getByRole("button", { name: "踏入尖塔", exact: true }).click();
    await page.locator('[data-action="node"]:not(:disabled)').first().click();
    if (Number(await page.locator(".energy-orb b").innerText()) !== stats.energy) throw new Error(`${id}: energy mismatch`);
    if (await page.locator(".hand .game-card").count() !== stats.hand) throw new Error(`${id}: hand mismatch`);
    if (!(await page.locator(".player-fighter .health-bar").innerText()).includes(`${stats.hp} / ${stats.hp}`)) throw new Error(`${id}: HP mismatch`);
    if (await page.locator(".hand .game-card:not(:disabled)").count()) throw new Error("Decision gate was bypassed");
    await page.locator('[data-action="lab-choice"]').nth(correct[id][0]).click();
    await page.locator('[data-action="lab-choice"]').nth(correct[id][1]).click();
    if (id === "engineer") {
      const attacks = await page.locator('.hand .game-card.attack .card-description').allTextContents();
      if (!attacks.some(text => text.includes('14 点伤害'))) throw new Error('Orange strength is absent from card preview');
    }
    if (id === "weaver") {
      for (const size of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(size);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        if (overflow) throw new Error('Blue hand overflows page');
        for (const selector of ['.energy-orb', '[data-action="end-turn"]']) {
          await page.waitForFunction(selector => {
            const e = document.querySelector(selector);
            if (!e) return false;
            const r = e.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return hit === e || e.contains(hit);
          }, selector, { timeout: 5000 });
        }
        await page.screenshot({ path: `output/character-weaver-${size.width}.png` });
      }
      await page.setViewportSize({ width: 1440, height: 960 });
      for (let i = 0; i < 6; i++) {
        const skills = page.locator('.hand .game-card.skill:not(:disabled)');
        const playable = await skills.count() ? skills : page.locator('.hand .game-card:not(:disabled)');
        if (!await playable.count()) throw new Error(`Blue cannot play card ${i + 1}`);
        await playable.first().click();
      }
    }
    await page.screenshot({ path: `output/character-${id}-battle.png` });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return "PASS: three character rules, decision gate, orange damage preview and blue six-card turn verified on desktop/mobile.";
}
