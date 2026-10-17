async (page) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
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
  await page.locator('[data-action="select-character"][data-id="scholar"]').click();
  if (!(await page.locator('.character-detail').innerText()).includes('Banked Reset')) throw new Error('Reset rules missing from selection');
  await page.getByRole("textbox", { name: "远征种子（可选）" }).fill("42");
  await page.getByRole("button", { name: "踏入尖塔", exact: true }).click();
  await page.locator('[data-action="node"]:not(:disabled)').first().click();
  const reset = page.locator('[data-action="reset"]');
  if (!await reset.isDisabled()) throw new Error('Reset bypasses decision or full HP gate');
  await page.locator('[data-action="lab-choice"]').nth(correct['scholar'][0]).click();
  await page.locator('[data-action="lab-choice"]').nth(correct['scholar'][1]).click();
  await page.locator('[data-action="end-turn"]').click();
  await reset.waitFor({ state: 'visible' });
  if (await reset.isDisabled()) throw new Error('Injured green cannot reset');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/green-reset-mobile.png' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error('Reset button causes mobile overflow');
  const beforeReset = await page.evaluate(() => JSON.parse(localStorage.getItem('agent-spire.run.v1')).player);
  await reset.click();
  const afterReset = await page.evaluate(() => JSON.parse(localStorage.getItem('agent-spire.run.v1')).player);
  if (afterReset.hp !== Math.min(beforeReset.maxHp, beforeReset.hp + 30)) throw new Error('Reset did not restore capped 30 HP');
  if (!await reset.isDisabled() || !(await reset.innerText()).includes('0/1')) throw new Error('Reset charge not consumed');
  await page.reload();
  await page.getByRole('button', { name: '继续学习', exact: true }).click();
  if (!(await reset.innerText()).includes('0/1')) throw new Error('Reload restored reset charge');

  // A saved banked-card fixture isolates its UI from the long two-act journey.
  await page.evaluate(() => {
    const run = JSON.parse(localStorage.getItem('agent-spire.run.v1'));
    const card = { uid: 'banked-ui', defId: 'banked-reset', upgraded: false };
    run.deck.push(card);
    run.battle.hand.push(card);
    run.player.hp = 20;
    run.player.energy = 2;
    localStorage.setItem('agent-spire.run.v1', JSON.stringify(run));
  });
  await page.reload();
  await page.getByRole('button', { name: '继续学习', exact: true }).click();
  await page.locator('[data-action="end-turn"]').click();
  const banked = page.locator('[data-action="play"][data-id="banked-ui"]');
  if (!await banked.count()) throw new Error('Banked reset was discarded at turn end');
  if (!(await banked.innerText()).includes('保留')) throw new Error('Retain rule missing from card');
  await banked.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/green-banked-reset-mobile.png' });
  const beforeBanked = await page.evaluate(() => JSON.parse(localStorage.getItem('agent-spire.run.v1')).player);
  await banked.click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('agent-spire.run.v1')));
  if (saved.player.hp !== Math.min(beforeBanked.maxHp, beforeBanked.hp + 30) || saved.deck.some(c => c.uid === 'banked-ui')) throw new Error('Banked reset failed capped heal or permanent removal');
  if (!saved.battle.exhaust.some(c => c.uid === 'banked-ui')) throw new Error('Consumed reset missing from exhaust');
  await page.reload();
  await page.getByRole('button', { name: '继续学习', exact: true }).click();
  if (await page.locator('[data-action="play"][data-id="banked-ui"]').count()) throw new Error('Reload restored consumed reset card');
  if (errors.length) throw new Error(errors.join('\n'));
  return 'PASS: reset gate, capped 30 HP heal, spent charge reload, mobile controls, retained banked card and permanent removal.';
}
